/**
 * Dispatcher Service - Unified MCP distribution logic
 *
 * This service extracts the common distribution logic used by both:
 * 1. Test dispatch (SSE streaming) - POST /v1/rules/test-dispatch
 * 2. Actual distribution (simple result) - RouterService.distributeItem()
 */

import { v4 as uuidv4 } from 'uuid';
import type { Item } from '../types/index.js';
import { mcpAdapter } from './adapters/mcp-adapter.js';
import { getLLMMappingService } from './mcp/llm-mapping.service.js';
import { getDatabase } from '../storage/database.js';
import { logger } from '../middleware/logger.js';
import { config as appConfig } from '../config/index.js';

/**
 * Helper to safely resolve a positive integer from unknown value
 */
const resolvePositiveInt = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
};

const extractJsonString = (content: string): string => {
  // Try to find a complete JSON object using bracket matching
  const firstBrace = content.indexOf('{');
  if (firstBrace === -1) {
    return content; // No JSON found
  }

  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = firstBrace; i < content.length; i++) {
    const char = content[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          // Found matching closing brace
          return content.substring(firstBrace, i + 1);
        }
      }
    }
  }

  // Fallback: return from first brace to end
  return content.substring(firstBrace);
};

const parsePlannerOutput = async (content: string): Promise<any> => {
  // Remove <thinking>...</thinking> tags before extracting JSON (Claude thinking mode)
  const cleanedContent = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

  // Check if content is empty after removing thinking tags
  if (!cleanedContent) {
    console.error('[dispatcher] LLM returned empty content after removing <thinking> tags');
    return { done: true, lastResultStatus: 'error' }; // Fail safe
  }

  const jsonStr = extractJsonString(cleanedContent);

  // Check if extracted JSON is empty
  if (!jsonStr || jsonStr.length < 10) {
    console.error('[dispatcher] Extracted JSON is too short or empty');
    return { done: true, lastResultStatus: 'error' }; // Fail safe
  }

  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[dispatcher] LLM JSON parse failed:', error);
    return { done: true, lastResultStatus: 'error' }; // Fail safe
  }
};

export interface DispatchResult {
  success: boolean;
  steps?: Array<{
    step: number;
    toolName: string;
    toolArgs: Record<string, unknown>;
    toolResponse?: unknown;
    error?: string;
    llmDecision?: {
      lastResultStatus: 'success' | 'error' | 'none';
      tool: string | null;
      arguments: Record<string, unknown> | null;
      done: boolean;
      plan?: string[];
    };
  }>;
  error?: string;
}

export interface DispatchOptions {
  item: Item;
  mcpAdapterId: string;
  toolName?: string;
  instructions?: string;
  params?: Record<string, unknown>;
  onProgress?: (event: string, data: unknown) => void;
}

export class DispatcherService {
  /**
   * Core distribution logic - shared by test-dispatch and actual distribution
   */
  async dispatchToMCP(options: DispatchOptions): Promise<DispatchResult> {
    const { item, mcpAdapterId, toolName, instructions, params, onProgress } = options;
    const userId = item.userId;

    // Progress callback (noop if not provided)
    const progress = onProgress || (() => {});

    try {
      // 1. Load MCP adapter configuration
      const db = getDatabase();
      const adapterRow = db.database.prepare(`
        SELECT * FROM mcp_adapter_configs
        WHERE id = ? AND user_id = ?
      `).get(mcpAdapterId, userId) as any;

      if (!adapterRow) {
        throw new Error(`MCP adapter not found: ${mcpAdapterId}`);
      }

      // 2. Parse env if stored as JSON string
      let env: Record<string, string> | undefined = undefined;
      if (adapterRow.env) {
        try {
          env = JSON.parse(adapterRow.env);
        } catch {
          env = undefined;
        }
      }

      // 3. Build adapter config (complete)
      const adapterConfig: Record<string, unknown> = {
        name: adapterRow.name,
        serverUrl: adapterRow.server_url,
        serverType: adapterRow.server_type,
        transportType: adapterRow.transport_type || 'http',
        command: adapterRow.command,
        env,
        authType: adapterRow.auth_type,
        apiKey: adapterRow.api_key,
        oauthAccessToken: adapterRow.oauth_access_token,
        oauthProvider: adapterRow.oauth_provider,
        oauthRefreshToken: adapterRow.oauth_refresh_token,
        timeout: adapterRow.timeout || 180000,
        maxRetries: adapterRow.max_retries || 3
      };

      // 4. Initialize adapter
      await mcpAdapter.initialize(adapterConfig);
      progress('init', { status: 'ready', message: 'MCP adapter initialized' });

      // 5. Determine tool name
      const defaultToolName = typeof toolName === 'string' && toolName.trim()
        ? toolName.trim()
        : adapterRow.default_tool_name
        || (adapterRow.server_type === 'notion' ? 'API-patch-block-children' : 'create-resource');

      // 6. Get tools and schemas
      const tools = await mcpAdapter.listTools(true);
      const toolSchemas = tools
        .filter((tool: { name?: string }) => typeof tool?.name === 'string')
        .reduce<Record<string, Record<string, unknown>>>((acc, tool: { name?: string; inputSchema?: Record<string, unknown> }) => {
          if (tool.name) {
            acc[tool.name] = tool.inputSchema || {};
          }
          return acc;
        }, {});

      progress('tools', {
        defaultToolName,
        availableTools: tools.map((t: { name?: string }) => t?.name).filter(Boolean),
        toolCount: tools.length
      });

      // 7. Prepare instructions (use default if not provided)
      const processingInstructions = instructions || this.getDefaultInstructions(adapterRow.server_type);

      // 8. Get LLM config
      const userLlmConfig = db.getUserLlmConfig(userId);
      const effectiveMaxTokens = resolvePositiveInt(
        userLlmConfig.maxTokens,
        resolvePositiveInt(appConfig.llm.maxTokens, 2000)
      );
      const maxChunkLength = Math.max(1000, Math.floor(effectiveMaxTokens * 3.5));

      // 9. Build context for LLM
      const context = {
        params: params || {},
        defaultToolName,
        availableTools: tools.map((tool: { name?: string }) => tool?.name).filter(Boolean),
        toolSchemas
      };

      // 10. Build system prompt (same as test-dispatch)
      const serializedSchemas = JSON.stringify(context.toolSchemas, null, 2);
      const systemPrompt = this.buildSystemPrompt(context);

      // 11. Initialize chat history
      const messages: Array<{ role: string; content: string }> = [];
      messages.push({ role: 'system', content: systemPrompt });

      // 12. Build initial user message
      const initialUserMessage = this.buildInitialUserMessage(processingInstructions, item);
      messages.push({ role: 'user', content: initialUserMessage });

      // 13. Generate session ID for LLM service
      const sessionId = uuidv4();
      const sessionType = 'distribution';

      // 14. Multi-round LLM conversation loop
      const llmService = getLLMMappingService();
      const steps: DispatchResult['steps'] = [];
      let consecutiveErrors = 0;
      let finalStatus: 'success' | 'failed' = 'success';
      let currentPlan: string[] | undefined = undefined;

      // Maximum 10 steps to prevent infinite loops
      for (let stepIndex = 0; stepIndex < 10; stepIndex += 1) {
        progress('step:start', { step: stepIndex + 1, status: 'planning' });

        // Call LLM with chat history
        const responseContent = await llmService.chat(messages, {
          jsonMode: true,
          temperature: 0,
          maxTokens: effectiveMaxTokens,
          userId,
          sessionId,
          sessionType
        });

        // Parse LLM response
        const plannerOutput = await parsePlannerOutput(responseContent);

        // Add Assistant response to history
        messages.push({ role: 'assistant', content: responseContent });

        // Update current plan if LLM provided one
        if (plannerOutput.plan && Array.isArray(plannerOutput.plan)) {
          currentPlan = plannerOutput.plan;
        }

        // Build LLM decision object
        const currentLlmDecision = {
          lastResultStatus: plannerOutput.lastResultStatus as 'success' | 'error' | 'none',
          tool: plannerOutput.tool || null,
          arguments: plannerOutput.arguments || null,
          done: plannerOutput.done === true,
          ...(currentPlan && { plan: currentPlan })
        };

        const currentLlmRaw = {
          input: JSON.stringify(messages, null, 2),
          output: plannerOutput
        };

        progress('step:planned', {
          step: stepIndex + 1,
          llmDecision: currentLlmDecision,
          llmRaw: currentLlmRaw
        });

        // Track consecutive errors
        const llmStatus = plannerOutput.lastResultStatus as string;
        if (llmStatus === 'error') {
          consecutiveErrors += 1;
          if (steps.length > 0) {
            const lastStep = steps[steps.length - 1];
            lastStep.error = 'LLM detected error in response';
            progress('step:error', { ...lastStep, status: 'error' });
          }
          logger.info(`[Dispatcher] LLM judged last result as error (${consecutiveErrors} consecutive)`);
        } else if (llmStatus === 'success') {
          consecutiveErrors = 0;
        }

        // Stop if too many consecutive errors
        if (consecutiveErrors >= 3) {
          logger.info('[Dispatcher] Too many consecutive errors, stopping');
          finalStatus = 'failed';
          break;
        }

        // Check if done
        const done = plannerOutput.done === true;
        const nextTool = plannerOutput.tool;
        const nextArgs = plannerOutput.arguments;

        if (done) {
          if (nextTool && typeof nextTool === 'string' && nextTool.trim()) {
            // LLM set done=true but still provided a tool - execute it first
            logger.info('[Dispatcher] LLM set done=true but provided tool, executing it first');
          } else {
            // Truly done
            const stepData = {
              step: stepIndex + 1,
              toolName: 'done',
              toolArgs: {},
              toolResponse: null
            };
            steps.push({
              ...stepData,
              llmDecision: currentLlmDecision,
              llmRaw: currentLlmRaw
            });
            progress('step:complete', { ...stepData, status: 'done' });
            if (consecutiveErrors > 0) {
              finalStatus = 'failed';
            }
            break;
          }
        }

        // Validate tool name
        if (typeof nextTool !== 'string' || !nextTool.trim()) {
          const stepData = {
            step: stepIndex + 1,
            toolName: 'unknown',
            toolArgs: {},
            error: 'Planner did not return a tool name'
          };
          steps.push({
            ...stepData,
            llmDecision: currentLlmDecision,
            llmRaw: currentLlmRaw
          });
          progress('step:error', stepData);
          finalStatus = 'failed';
          break;
        }

        // Validate tool arguments
        if (!nextArgs || typeof nextArgs !== 'object') {
          const stepData = {
            step: stepIndex + 1,
            toolName: nextTool,
            toolArgs: {},
            error: 'Planner did not return tool arguments'
          };
          steps.push({
            ...stepData,
            llmDecision: currentLlmDecision,
            llmRaw: currentLlmRaw
          });
          progress('step:error', stepData);
          finalStatus = 'failed';
          break;
        }

        // Send executing event
        progress('step:executing', {
          step: stepIndex + 1,
          toolName: nextTool,
          toolArgs: nextArgs
        });

        // Execute tool
        try {
          const toolResult = await mcpAdapter.callTool(nextTool, nextArgs as Record<string, unknown>);

          logger.info(`[Dispatcher] Tool result: ${JSON.stringify(toolResult?.content || '').substring(0, 500)}`);

          const stepData = {
            step: stepIndex + 1,
            toolName: nextTool,
            toolArgs: nextArgs as Record<string, unknown>,
            toolResponse: toolResult?.content
          };
          steps.push({
            ...stepData,
            llmDecision: currentLlmDecision,
            llmRaw: currentLlmRaw
          });
          progress('step:complete', { ...stepData, status: 'success' });

          // Add tool result to chat history
          const toolOutput = toolResult?.content ? JSON.stringify(toolResult.content) : 'Success (no content)';
          const resultMessage = `Result of tool "${nextTool}":\n${toolOutput}`;

          // Split long results into chunks
          const chunks: string[] = [];
          if (toolOutput.length > maxChunkLength) {
            const totalChunks = Math.ceil(toolOutput.length / maxChunkLength);
            for (let i = 0; i < totalChunks; i++) {
              const start = i * maxChunkLength;
              const end = Math.min((i + 1) * maxChunkLength, toolOutput.length);
              const chunk = toolOutput.substring(start, end);
              chunks.push(`Result of tool "${nextTool}" [Part ${i + 1}/${totalChunks}]:\n${chunk}`);
            }
          } else {
            chunks.push(resultMessage);
          }

          // Add chunks to chat history
          if (currentPlan) {
            const formattedPlan = currentPlan.join('\n');
            messages.push({
              role: 'user',
              content: `Current Plan:\n${formattedPlan}\n\n${chunks[0]}`
            });
            for (let i = 1; i < chunks.length; i++) {
              messages.push({
                role: 'user',
                content: chunks[i]
              });
            }
          } else {
            chunks.forEach(chunk => {
              messages.push({
                role: 'user',
                content: chunk
              });
            });
          }

        } catch (error) {
          // Tool execution failed
          const errorMessage = error instanceof Error ? error.message : String(error);
          const stepData = {
            step: stepIndex + 1,
            toolName: nextTool,
            toolArgs: nextArgs as Record<string, unknown>,
            error: errorMessage
          };
          steps.push({
            ...stepData,
            llmDecision: currentLlmDecision,
            llmRaw: currentLlmRaw
          });
          progress('step:error', stepData);

          // Add error to chat history
          let errorContent = `Error executing tool "${nextTool}": ${errorMessage}`;
          if (errorMessage.includes('Notion-Version') || errorMessage.includes('should be not present')) {
            errorContent += '\n\nIMPORTANT: Do NOT include HTTP headers (Notion-Version, Authorization, Content-Type) in tool arguments. Only use the parameters defined in the tool schema.';
          }
          messages.push({
            role: 'user',
            content: errorContent
          });
        }
      }

      // Cleanup adapter resources
      mcpAdapter.cleanup();

      // Send final event
      progress('complete', {
        success: finalStatus === 'success',
        steps,
        toolName: defaultToolName,
        toolSchemas: context.toolSchemas
      });

      return {
        success: finalStatus === 'success',
        steps
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[Dispatcher] Failed to distribute item ${item.id}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        steps
      };
    }
  }

  /**
   * Build system prompt for LLM (aligned with test-dispatch)
   */
  private buildSystemPrompt(context: {
    availableTools: string[];
    toolSchemas: Record<string, Record<string, unknown>>;
  }): string {
    const serializedSchemas = JSON.stringify(context.toolSchemas, null, 2);

    return [
      '═══════════════════════════════════════════════════════════════',
      '  MCP TOOL ORCHESTRATOR',
      '═══════════════════════════════════════════════════════════════',
      '',
      'ROLE: Execute user requests by calling MCP tools sequentially.',
      'GOAL: Complete the task with minimal steps and verify results.',
      'OUTPUT: JSON object (see format below).',
      '',
      '─────────────────────────────────────────────────────────────',
      '  OUTPUT FORMAT (Required in EVERY response)',
      '─────────────────────────────────────────────────────────────',
      '',
      'Return ONLY this JSON structure:',
      '',
      '{',
      '  "lastResultStatus": "none" | "success" | "error",',
      '  "tool": "<tool-name> or null",',
      '  "arguments": { ... } or {},',
      '  "done": false | true,',
      '  "plan": ["[status] [tool] description", ...]',
      '}',
      '',
      '───── Field Definitions ─────',
      '',
      'lastResultStatus: Result of the PREVIOUS tool call',
      '  - "none"   → FIRST step only (no previous call)',
      '  - "success"→ Previous tool returned expected result',
      '  - "error"  → Previous tool failed (error message/4xx/5xx/empty)',
      '  Decision tree:',
      '  ① First response? → "none"',
      '  ② Got valid data/created resource? → "success"',
      '  ③ Got error message/failed validation? → "error"',
      '',
      'tool: Name of the next tool to call',
      '  - Must exist in available tools list',
      '  - Set to null when done=true',
      '',
      'arguments: Parameters for the tool (must match tool schema)',
      '  - Do NOT include HTTP headers (Authorization, Content-Type, etc.)',
      '  - Use actual IDs from previous results when needed',
      '',
      'done: Task completion flag',
      '  - false: More steps needed',
      '  - true:  ALL steps completed AND final verification passed',
      '',
      'plan: Array of ALL steps with progress markers',
      '  - REQUIRED in every response (including first)',
      '  - Format: "[status] [tool-name] description"',
      '  - Status options:',
      '    • "[Completed]"  = step finished',
      '    • "[In Progress]" = currently executing',
      '    • "[Pending]"    = not started yet',
      '  - CRITICAL: The LAST step MUST be verification (e.g., "Verify data was written")',
      '',
      '─────────────────────────────────────────────────────────────',
      '  EXECUTION FLOW',
      '─────────────────────────────────────────────────────────────',
      '',
      'Step 1: Analyze request and create execution plan',
      '   - Break down task into 3-7 steps',
      '   - Last step MUST be verification/validation',
      '   - Set lastResultStatus="none"',
      '',
      'Step 2: Execute first tool',
      '   - Set tool to first tool name',
      '   - Set arguments with required parameters',
      '   - Mark first step as "[In Progress]" in plan',
      '',
      'Step 3: After each tool result, assess and decide:',
      '   ✓ SUCCESS → update plan, proceed to next step',
      '   ✗ ERROR   → adjust strategy, try alternative (DO NOT retry same call)',
      '',
      'Step 4: Continue until:',
      '   - All steps completed AND verification passed → done=true',
      '   - OR 3+ consecutive errors → done=true with error',
      '',
      '─────────────────────────────────────────────────────────────',
      '  CRITICAL RULES (Priority Order)',
      '─────────────────────────────────────────────────────────────',
      '',
      '🔴 RULE #1: Final Verification Step',
      '   - The LAST step in your plan MUST verify the result',
      '   - Examples: "Verify data was written", "Check if entry was created", "Confirm content is correct"',
      '   - Only set done=true AFTER verification succeeds',
      '',
      '🔴 RULE #2: No HTTP Headers in Tool Arguments',
      '   - Never include: Authorization, Content-Type, Notion-Version',
      '   - Only use schema parameters (block_id, page_id, etc.)',
      '',
      '🔴 RULE #3: Update Plan Progress in EVERY Response',
      '   - First step: "[In Progress] [tool] action"',
      '   - After success: "[Completed] [tool] action", "[In Progress] [next-tool] action"',
      '   - After error: keep error step visible, show adjusted next step',
      '',
      '🔴 RULE #4: Error Handling',
      '   - If error: DO NOT retry with same tool + same arguments',
      '   - Try alternative approach or give up after 2-3 consecutive errors',
      '   - Update lastResultStatus="error" when tool fails',
      '',
      '─────────────────────────────────────────────────────────────',
      '  AVAILABLE TOOLS (Reference)',
      '─────────────────────────────────────────────────────────────',
      '',
      `Tools: ${JSON.stringify(context.availableTools)}`,
      '',
      `Tool Schemas: ${serializedSchemas}`,
      '',
      '═══════════════════════════════════════════════════════════════'
    ].join('\n');
  }

  /**
   * Build initial user message for LLM
   */
  private buildInitialUserMessage(instructions: string, item: Item): string {
    let message = `== User Instructions ==\n${instructions.trim()}\n\n`;
    message += `== Item Data ==\n`;
    message += `Content: ${item.originalContent}\n`;

    if (item.category) {
      message += `Category: ${item.category}\n`;
    }

    return message;
  }

  /**
   * Get default instructions for a server type
   */
  private getDefaultInstructions(serverType: string): string {
    const defaults: Record<string, string> = {
      notion: 'Append the content as a new block in the user\'s default Notion page.',
      todoist: 'Create a new Todoist task with the content as the task name.',
      obsidian: 'Append the content to the user\'s daily Obsidian note.',
      github: 'Create a new GitHub issue with the content.',
      'default': 'Process the content using the available tools.'
    };

    return defaults[serverType] || defaults.default;
  }
}

// Singleton instance
let dispatcherServiceInstance: DispatcherService | null = null;

export const getDispatcherService = (): DispatcherService => {
  if (!dispatcherServiceInstance) {
    dispatcherServiceInstance = new DispatcherService();
  }
  return dispatcherServiceInstance;
};
