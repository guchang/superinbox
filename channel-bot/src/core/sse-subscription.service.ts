/**
 * SSE Subscription Service
 *
 * Subscribes to SuperInbox Core SSE events for real-time updates.
 */

import { EventSource } from 'eventsource';
import type { CoreApiClient } from './core-api.client.js';

/**
 * SSE Event types from Core API
 */
export type SSEEventType =
  | 'ai.completed'
  | 'ai.failed'
  | 'routing.started'
  | 'routing.completed'
  | 'routing.failed'
  | 'item.created';

/**
 * SSE Event data
 */
export interface SSEEvent {
  type: SSEEventType;
  itemId: string;
  data: {
    category?: string;
    summary?: string;
    suggestedTitle?: string;
    confidence?: number;
    targets?: string[];
    failures?: Array<{ target: string; error: string }>;
    message?: string;
    error?: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

/**
 * SSE Event handler
 */
export type SSEEventHandler = (event: SSEEvent & { channelId: string }) => Promise<void> | void;

/**
 * SSE Subscription Service
 */
export class SSESubscriptionService {
  private subscriptions: Map<string, EventSource> = new Map();
  private handlers: Map<SSEEventType, SSEEventHandler[]> = new Map();
  private closingItemIds: Set<string> = new Set();

  constructor(
    private coreApiClient: CoreApiClient
  ) {
    this.initializeHandlers();
  }

  /**
   * Initialize event handlers
   */
  private initializeHandlers(): void {
    const eventTypes: SSEEventType[] = [
      'ai.completed',
      'ai.failed',
      'routing.completed',
      'routing.failed',
    ];

    for (const eventType of eventTypes) {
      this.handlers.set(eventType, []);
    }
  }

  /**
   * Register event handler
   */
  on(event: SSEEventType, handler: SSEEventHandler): void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  /**
   * Subscribe to item progress via SSE
   */
  subscribeToItem(itemId: string, channelId: string, apiKey: string): void {
    // Close existing subscription if any
    this.unsubscribe(itemId);

    try {
      // Get Core API base URL (keep /v1 prefix for SSE endpoint)
      const baseURL = this.coreApiClient['client'].defaults.baseURL || 'http://localhost:3001/v1';
      const url = `${baseURL}/inbox/${itemId}/routing-progress?token=${encodeURIComponent(apiKey)}`;

      console.info(`Subscribing to SSE for item ${itemId}`);
      console.debug(`SSE URL: ${url}`);

      const eventSource = new EventSource(url);
      const closeSubscription = (reason?: string) => {
        eventSource.close();
        if (this.subscriptions.get(itemId) === eventSource) {
          this.subscriptions.delete(itemId);
        }
        if (reason) {
          console.info(`SSE connection closed for item ${itemId} (${reason})`);
        }
      };
      const markClosing = () => {
        if (!this.closingItemIds.has(itemId)) {
          this.closingItemIds.add(itemId);
          setTimeout(() => {
            this.closingItemIds.delete(itemId);
          }, 10000);
        }
      };

      // Handle incoming messages for named events
      eventSource.addEventListener('ai.completed', (event: any) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent['data'];
          this.handleEvent(channelId, { type: 'ai.completed', itemId, data });
        } catch (error) {
          console.error(`Failed to parse SSE event: ${error}`);
        }
      });

      eventSource.addEventListener('ai.failed', (event: any) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent['data'];
          this.handleEvent(channelId, { type: 'ai.failed', itemId, data });
        } catch (error) {
          console.error(`Failed to parse SSE event: ${error}`);
        }
      });

      eventSource.addEventListener('routing:complete', (event: any) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent['data'];
          this.handleEvent(channelId, { type: 'routing.completed', itemId, data });
          markClosing();
          closeSubscription('routing:complete');
        } catch (error) {
          console.error(`Failed to parse SSE event: ${error}`);
        }
      });

      eventSource.addEventListener('routing:error', (event: any) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent['data'];
          this.handleEvent(channelId, { type: 'routing.failed', itemId, data });
          markClosing();
          closeSubscription('routing:error');
        } catch (error) {
          console.error(`Failed to parse SSE event: ${error}`);
        }
      });

      // Handle connection open
      eventSource.onopen = () => {
        console.info(`SSE connection opened for item ${itemId}`);
      };

      // Handle errors
      eventSource.onerror = (error: any) => {
        const readyState = (eventSource as any).readyState;
        const isStale = this.subscriptions.get(itemId) !== eventSource;
        const isClosing = this.closingItemIds.has(itemId);

        if (isClosing || isStale || readyState === EventSource.CLOSED) {
          closeSubscription();
          return;
        }

        console.error(`SSE connection error for item ${itemId}:`, error);
        closeSubscription();
      };

      this.subscriptions.set(itemId, eventSource);
    } catch (error) {
      console.error(`Failed to create SSE subscription for item ${itemId}:`, error);
    }
  }

  /**
   * Unsubscribe from item progress
   */
  unsubscribe(itemId: string): void {
    const eventSource = this.subscriptions.get(itemId);
    if (eventSource) {
      eventSource.close();
      this.subscriptions.delete(itemId);
      this.closingItemIds.delete(itemId);
      console.info(`Unsubscribed from item ${itemId}`);
    }
  }

  /**
   * Unsubscribe from all items
   */
  unsubscribeAll(): void {
    for (const [_itemId, eventSource] of this.subscriptions.entries()) {
      eventSource.close();
    }
    this.subscriptions.clear();
    this.closingItemIds.clear();
    console.log('Unsubscribed from all items');
  }

  /**
   * Handle incoming SSE event
   */
  private async handleEvent(channelId: string, event: SSEEvent): Promise<void> {
    console.log(`Received SSE event: ${event.type} for item ${event.itemId}`);

    // Get handlers for this event type
    const handlers = this.handlers.get(event.type) || [];

    // Execute all handlers
    for (const handler of handlers) {
      try {
        await handler({ ...event, channelId });
      } catch (error) {
        console.error(`Handler error for event ${event.type}:`, error);
      }
    }
  }

  /**
   * Get active subscriptions count
   */
  getActiveSubscriptionsCount(): number {
    return this.subscriptions.size;
  }
}
