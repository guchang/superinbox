/**
 * Todoist Adapter - Distribute items to Todoist
 *
 * This adapter directly calls Todoist REST API using @doist/todoist-api-typescript.
 * For MCP-based integration, use MCPAdapter with server_url="https://ai.todoist.net/mcp".
 *
 * Configuration example:
 * {
 *   apiKey: "your-todoist-api-token",
 *   projectId: "optional-project-id",
 *   defaultPriority: 4  // 1=low, 2=medium, 3=high, 4=urgent
 * }
 *
 * @see https://developer.todoist.com/rest/v2/
 * @since 0.2.0
 */

import { BaseAdapter } from '../adapter.interface.js';
import type { Item, DistributionResult } from '../../types/index.js';
import { AdapterType, Priority } from '../../types/index.js';
import { logger } from '../../middleware/logger.js';
import axios from 'axios';

/**
 * Todoist API response for task creation
 */
interface TodoistTaskResponse {
  id: string;
  assignee_id: string;
  assigner_id: string;
  comment_count: number;
  is_completed: boolean;
  content: string;
  description: string;
  due?: {
    date: string;
    is_recurring: boolean;
    lang: string;
    string: string;
  };
  duration?: {
    unit: string;
    amount: number;
  };
  labels: string[];
  order: number;
  parent_id?: string;
  priority: number;
  project_id: string;
  section_id?: string;
  url: string;
  created_at: string;
}

export class TodoistAdapter extends BaseAdapter {
  readonly type = AdapterType.TODOIST;
  readonly name = 'Todoist Adapter';

  private readonly TODOIST_API_BASE = 'https://api.todoist.com/rest/v2';

  /**
   * Priority mapping from SuperInbox to Todoist
   */
  private readonly PRIORITY_MAP: Record<Priority, number> = {
    [Priority.LOW]: 1,
    [Priority.MEDIUM]: 2,
    [Priority.HIGH]: 3,
    [Priority.URGENT]: 4
  };

  /**
   * Validate Todoist configuration
   */
  validate(config: Record<string, unknown>): boolean {
    return (
      typeof config.apiKey === 'string' &&
      config.apiKey.length > 0
    );
  }

  /**
   * Initialize Todoist adapter
   */
  async initialize(config: Record<string, unknown>): Promise<void> {
    await super.initialize(config);

    this.client = axios.create({
      baseURL: this.TODOIST_API_BASE,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: (config.timeout as number) ?? 30000
    });

    logger.info('Todoist Adapter initialized');
  }

  /**
   * Distribute item to Todoist
   */
  async distribute(item: Item): Promise<DistributionResult> {
    this.ensureInitialized();

    try {
      const taskData = this.buildTaskData(item);

      logger.info(`Creating Todoist task: ${taskData.content}`);

      const response = await this.client!.post<TodoistTaskResponse>(
        '/tasks',
        taskData
      );

      logger.info(`Todoist task created: ${response.data.id}`);

      return this.createResult(
        this.config.projectId as string ?? 'inbox',
        'success',
        {
          externalId: response.data.id,
          externalUrl: response.data.url
        }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = `Todoist API error: ${error.response?.data ?? error.message}`;
        logger.error(errorMessage);
        return this.createResult(
          this.config.projectId as string ?? 'inbox',
          'failed',
          { error: errorMessage }
        );
      }
      throw error;
    }
  }

  /**
   * Build Todoist task data from item
   */
  private buildTaskData(item: Item): Record<string, unknown> {
    const taskData: Record<string, unknown> = {
      content: item.suggestedTitle ?? item.originalContent.substring(0, 200)
    };

    // Add description if content is different from title
    if (item.originalContent.length > 200 ||
        (item.suggestedTitle && item.originalContent !== item.suggestedTitle)) {
      taskData.description = item.originalContent;
    }

    // Map priority
    taskData.priority = this.PRIORITY_MAP[item.priority] ??
      (this.config.defaultPriority as number) ?? 2;

    // Add due date if available
    if (item.entities.dueDate) {
      taskData.dueString = this.formatDueDate(item.entities.dueDate);
    } else if (this.config.defaultDueString as string) {
      taskData.dueString = this.config.defaultDueString as string;
    }

    // Add labels/tags
    if (item.entities.tags && item.entities.tags.length > 0) {
      taskData.labels = item.entities.tags;
    }

    // Add project ID from config
    if (this.config.projectId) {
      taskData.projectId = this.config.projectId as string;
    }

    // Add description if summary exists
    if (item.summary && !taskData.description) {
      taskData.description = item.summary;
    }

    return taskData;
  }

  /**
   * Format date for Todoist due string
   */
  private formatDueDate(date: Date): string {
    // Todoist accepts natural language dates or ISO format
    // Try to use natural language for better UX
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays === -1) return 'yesterday';

    // For other dates, use ISO format
    return targetDate.toISOString().split('T')[0];
  }

  /**
   * Health check for Todoist
   */
  async healthCheck(): Promise<boolean> {
    try {
      this.ensureInitialized();
      await this.client!.get('/tasks', {
        timeout: 5000,
        params: { limit: 1 }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get projects (helper method for configuration)
   */
  async getProjects(): Promise<unknown[]> {
    this.ensureInitialized();
    const response = await this.client!.get('/projects');
    return response.data;
  }

  /**
   * Get labels (helper method for configuration)
   */
  async getLabels(): Promise<unknown[]> {
    this.ensureInitialized();
    const response = await this.client!.get('/labels');
    return response.data;
  }
}

export const todoistAdapter = new TodoistAdapter();
