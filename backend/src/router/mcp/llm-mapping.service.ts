/**
 * LLM Mapping Service
 * Transforms Item data to target tool format using external LLM
 */

import type { Item } from '../../types/index.js';
import { config as appConfig } from '../../config/index.js';
import { logger } from '../../middleware/logger.js';

interface TransformOptions {
  instructions: string;
  targetSchema?: Record<string, unknown>;
  toolName?: string;
  allowFallback?: boolean;
}

interface TransformResult {
  data: Record<string, unknown>;
  reasoning?: string;
}

export class LLMMappingService {
  private config = appConfig;

  /**
   * Transform Item data to target format using LLM
   */
  async transform(
    item: Item,
    options: TransformOptions
  ): Promise<Record<string, unknown>> {
    const { instructions, targetSchema, toolName, allowFallback = true } = options;

    // Build the prompt
    const prompt = this.buildPrompt(item, instructions, targetSchema, toolName);

    try {
      // Call LLM API
      const result = await this.callLLM(prompt);

      // Parse and validate response
      const transformed = this.parseResponse(result);

      // Validate against schema if provided
      if (targetSchema) {
        this.validateSchema(transformed, targetSchema);
      }

      return transformed;
    } catch (error) {
      logger.error('LLM transformation failed:', error);

      // Fallback to simple mapping if allowed
      if (allowFallback) {
        logger.info('Falling back to simple field mapping');
        return this.simpleMapping(item);
      }

      throw error;
    }
  }

  /**
   * Preview transformation with reasoning
   */
  async preview(
    item: Item,
    options: TransformOptions
  ): Promise<TransformResult> {
    const { instructions, targetSchema, toolName } = options;

    const prompt = this.buildPrompt(item, instructions, targetSchema, toolName);
    const result = await this.callLLM(prompt);

    // Try to extract reasoning from response
    const reasoning = this.extractReasoning(result);

    return {
      data: this.parseResponse(result),
      reasoning
    };
  }

  /**
   * Build the LLM prompt
   */
  private buildPrompt(
    item: Item,
    instructions: string,
    targetSchema?: Record<string, unknown>,
    toolName?: string
  ): string {
    let prompt = `You are a data transformation expert. Convert the inbox item to the target format.\n\n`;

    prompt += `== User Instructions ==\n${instructions}\n\n`;

    prompt += `== Item Data ==\n`;
    prompt += `ID: ${item.id}\n`;
    prompt += `Content: ${item.originalContent}\n`;
    prompt += `Content Type: ${item.contentType}\n`;
    prompt += `Category: ${item.category}\n`;

    if (item.suggestedTitle) {
      prompt += `Title: ${item.suggestedTitle}\n`;
    }

    if (item.summary) {
      prompt += `Summary: ${item.summary}\n`;
    }

    if (item.entities) {
      const entities = JSON.stringify(item.entities, null, 2);
      prompt += `Entities: ${entities}\n`;
    }

    if (toolName) {
      prompt += `\nTarget Tool: ${toolName}\n`;
    }

    if (targetSchema) {
      const schema = JSON.stringify(targetSchema, null, 2);
      prompt += `\n== Target Schema ==\n${schema}\n`;
    }

    prompt += `\n== Output Format ==\n`;
    prompt += `Output ONLY a valid JSON object. No markdown, no code blocks, no explanations.\n`;
    prompt += `The JSON should match the target schema above.\n`;

    return prompt;
  }

  /**
   * Call LLM with chat history (stateful)
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
    }
  ): Promise<string> {
    const { llm } = this.config;
    const apiUrl = llm.baseUrl || 'https://api.openai.com/v1';

    const requestBody: Record<string, any> = {
      model: llm.model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? (llm.maxTokens || 2000)
    };

    // Add JSON mode if supported and requested
    // Note: OpenAI and compatible APIs usually support response_format: { type: "json_object" }
    if (options?.jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return content;
  }

  /**
   * Call the LLM API (stateless wrapper)
   */
  private async callLLM(prompt: string): Promise<string> {
    const { llm } = this.config;

    // Build request based on provider
    const apiUrl = llm.baseUrl || 'https://api.openai.com/v1';

    // For DeepSeek (OpenAI-compatible)
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.apiKey}`
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that converts data according to instructions. Always respond with valid JSON only, no markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: llm.maxTokens || 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return content;
  }

  /**
   * Parse LLM response to JSON
   */
  private parseResponse(response: string): Record<string, unknown> {
    // Try to extract JSON from response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Remove any leading/trailing whitespace
    jsonStr = jsonStr.trim();

    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
      throw new Error('Response is not an object');
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error}`);
    }
  }

  /**
   * Validate data against schema
   */
  private validateSchema(
    data: Record<string, unknown>,
    schema: Record<string, unknown>
  ): void {
    // Basic validation - check required fields
    if (schema.type === 'object' && schema.properties) {
      const properties = schema.properties as Record<string, Record<string, unknown>>;
      const required = schema.required as string[] || [];

      for (const field of required) {
        if (!(field in data)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
  }

  /**
   * Simple field mapping fallback
   */
  private simpleMapping(item: Item): Record<string, unknown> {
    return {
      title: item.suggestedTitle || item.originalContent.substring(0, 50),
      content: item.originalContent,
      category: item.category,
      properties: {
        Name: {
          title: [{
            text: {
              content: item.suggestedTitle || item.originalContent.substring(0, 50)
            }
          }]
        }
      }
    };
  }

  /**
   * Extract reasoning from LLM response
   */
  private extractReasoning(response: string): string | undefined {
    // Look for common reasoning patterns
    const patterns = [
      /```reasoning\n([\s\S]*?)\n```/,
      /Reasoning:\s*([^\n]*)/,
      /Thinking:\s*([^\n]*)/
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }
}

// Singleton instance
let llmMappingServiceInstance: LLMMappingService | null = null;

export const getLLMMappingService = (): LLMMappingService => {
  if (!llmMappingServiceInstance) {
    llmMappingServiceInstance = new LLMMappingService();
  }
  return llmMappingServiceInstance;
};
