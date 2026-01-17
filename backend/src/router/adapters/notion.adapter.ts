/**
 * Notion Adapter - Distribute items to Notion
 */

import { BaseAdapter } from '../adapter.interface.js';
import type { Item, DistributionResult } from '../../types/index.js';
import { AdapterType } from '../../types/index.js';
import { logger } from '../../middleware/logger.js';
import axios from 'axios';

export class NotionAdapter extends BaseAdapter {
  readonly type: AdapterType = AdapterType.NOTION;
  readonly name = 'Notion Adapter';

  /**
   * Validate Notion configuration
   */
  validate(config: Record<string, unknown>): boolean {
    return (
      typeof config.apiKey === 'string' &&
      config.apiKey.length > 0 &&
      typeof config.databaseId === 'string' &&
      config.databaseId.length > 0
    );
  }

  /**
   * Initialize Notion adapter
   */
  async initialize(config: Record<string, unknown>): Promise<void> {
    await super.initialize(config);

    this.client = axios.create({
      baseURL: 'https://api.notion.com/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Notion-Version': (config.notionVersion as string) ?? '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Distribute item to Notion
   */
  async distribute(item: Item): Promise<DistributionResult> {
    this.ensureInitialized();

    const databaseId = this.config.databaseId as string;
    const properties = this.buildProperties(item);

    try {
      logger.info(`Creating Notion page in database ${databaseId}`);

      const response = await this.client!.post('/pages', {
        parent: {
          type: 'database_id',
          database_id: databaseId
        },
        properties
      });

      logger.info(`Notion page created: ${response.data.id}`);

      return this.createResult(databaseId, 'success', {
        externalId: response.data.id,
        externalUrl: response.data.url
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = `Notion API error: ${error.response?.data?.message ?? error.message}`;
        logger.error(errorMessage);
        return this.createResult(databaseId, 'failed', {
          error: errorMessage
        });
      }
      throw error;
    }
  }

  /**
   * Build Notion page properties from item
   */
  private buildProperties(item: Item): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    // Title
    const titleProperty = (this.config.titleProperty as string) ?? 'Name';
    properties[titleProperty] = {
      title: [
        {
          text: {
            content: item.suggestedTitle ?? item.originalContent.substring(0, 50)
          }
        }
      ]
    };

    // Content
    const contentProperty = this.config.contentProperty as string;
    if (contentProperty) {
      properties[contentProperty] = {
        rich_text: [
          {
            text: {
              content: item.originalContent
            }
          }
        ]
      };
    }

    // Intent/Type
    const typeProperty = this.config.typeProperty as string;
    if (typeProperty) {
      properties[typeProperty] = {
        select: {
          name: item.intent
        }
      };
    }

    // Summary
    const summaryProperty = this.config.summaryProperty as string;
    if (summaryProperty && item.summary) {
      properties[summaryProperty] = {
        rich_text: [
          {
            text: {
              content: item.summary
            }
          }
        ]
      };
    }

    // Tags
    const tagsProperty = this.config.tagsProperty as string;
    if (tagsProperty && item.entities.tags && item.entities.tags.length > 0) {
      properties[tagsProperty] = {
        multi_select: item.entities.tags.map(tag => ({ name: tag }))
      };
    }

    // Due Date
    const dueDateProperty = this.config.dueDateProperty as string;
    if (dueDateProperty && item.entities.dueDate) {
      properties[dueDateProperty] = {
        date: {
          start: item.entities.dueDate.toISOString().split('T')[0]
        }
      };
    }

    // Status
    const statusProperty = this.config.statusProperty as string;
    if (statusProperty) {
      properties[statusProperty] = {
        select: {
          name: item.status
        }
      };
    }

    return properties;
  }

  /**
   * Health check for Notion
   */
  async healthCheck(): Promise<boolean> {
    try {
      this.ensureInitialized();
      await this.client!.get('/users/me', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

export const notionAdapter = new NotionAdapter();
