/**
 * Webhook Adapter - Distribute items via HTTP webhook
 */

import { BaseAdapter } from '../adapter.interface.js';
import type { Item, DistributionResult } from '../../types/index.js';
import { AdapterType } from '../../types/index.js';
import { logger } from '../../middleware/logger.js';
import axios from 'axios';

export class WebhookAdapter extends BaseAdapter {
  readonly type: AdapterType = AdapterType.WEBHOOK;
  readonly name = 'Webhook Adapter';

  /**
   * Validate webhook configuration
   */
  validate(config: Record<string, unknown>): boolean {
    return (
      typeof config.url === 'string' &&
      config.url.length > 0
    );
  }

  /**
   * Distribute item via webhook
   */
  async distribute(item: Item): Promise<DistributionResult> {
    this.ensureInitialized();

    const url = this.config.url as string;
    const method = (this.config.method as string) ?? 'POST';
    const headers = (this.config.headers as Record<string, string>) ?? {};
    const includeRaw = (this.config.includeRaw as boolean) ?? true;

    try {
      // Prepare payload
      const payload = {
        id: item.id,
        intent: item.intent,
        content: item.originalContent,
        summary: item.summary,
        entities: item.entities,
        suggestedTitle: item.suggestedTitle,
        metadata: includeRaw ? item : undefined
      };

      logger.info(`Sending webhook to ${url}`);

      const response = await axios({
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        data: payload,
        timeout: (this.config.timeout as number) ?? 30000
      });

      logger.info(`Webhook succeeded: ${response.status}`);

      return this.createResult(url, 'success', {
        externalId: response.headers['x-request-id'] as string ?? undefined,
        externalUrl: url
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = `Webhook failed: ${error.message}`;
        logger.error(errorMessage);
        return this.createResult(url, 'failed', {
          error: errorMessage
        });
      }
      throw error;
    }
  }

  /**
   * Health check for webhook
   */
  async healthCheck(): Promise<boolean> {
    try {
      this.ensureInitialized();
      const url = this.config.url as string;

      // Try a simple GET request if healthCheckUrl is not configured
      const healthUrl = (this.config.healthCheckUrl as string) ?? url;

      await axios.get(healthUrl, {
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });

      return true;
    } catch {
      return false;
    }
  }
}

export const webhookAdapter = new WebhookAdapter();
