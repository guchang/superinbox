/**
 * Channel Bot Entry Point
 *
 * Main application entry point for Channel Bot service.
 */

import 'dotenv/config';
import express from 'express';
import type { ChannelType } from './core/index.js';
import { ChannelManager } from './core/channel-manager.js';
import { getUserMapper } from './core/user-mapper.service.js';
import { getCoreApiClient } from './core/core-api.client.js';
import { createApiRoutes } from './api/routes.js';
import { createTelegramChannel } from './channels/telegram/index.js';

/**
 * Application configuration from environment variables
 */
interface AppConfig {
  port: number;
  nodeEnv: string;
  coreApiUrl: string;
  coreApiKey: string;
  databasePath: string;
  enabledChannels: ChannelType[];
  telegramBotToken?: string;
}

/**
 * Load configuration from environment
 */
function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3002', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    coreApiUrl: process.env.CORE_API_URL || 'http://localhost:3001/v1',
    coreApiKey: process.env.CORE_API_KEY || '',
    databasePath: process.env.DATABASE_PATH,
    enabledChannels: (process.env.ENABLED_CHANNELS?.split(',') || [
      'telegram',
      'lark',
      'wework',
    ]) as ChannelType[],
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  };
}

/**
 * Validate configuration
 */
function validateConfig(config: AppConfig): void {
  if (!config.coreApiKey) {
    throw new Error('CORE_API_KEY is required');
  }

  if (!config.coreApiUrl) {
    throw new Error('CORE_API_URL is required');
  }
}

/**
 * Create and configure Express app
 */
function createApp(channelManager: ChannelManager): express.Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // API routes
  app.use('/api', createApiRoutes(channelManager));

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: '@superinbox/channel-bot',
      version: '1.0.0',
      status: 'running',
      channels: channelManager.getChannels(),
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
    });
  });

  // Error handler
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);

    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  });

  return app;
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(channelManager: ChannelManager, server: ReturnType<express.Express['listen']>): Promise<void> {
  console.log('Shutting down gracefully...');

  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Stop all channels
  await channelManager.stopAll();

  console.log('Shutdown complete');
  process.exit(0);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    // Load and validate configuration
    const config = loadConfig();
    validateConfig(config);

    console.log('Starting Channel Bot...');
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Port: ${config.port}`);
    console.log(`Core API: ${config.coreApiUrl}`);

    // Initialize services
    console.log('Initializing services...');

    const userMapper = getUserMapper(config.databasePath);
    const coreApiClient = getCoreApiClient({
      baseURL: config.coreApiUrl,
      apiKey: config.coreApiKey,
    });

    // Check Core API health
    console.log('Checking Core API health...');
    const isCoreHealthy = await coreApiClient.healthCheck();

    if (!isCoreHealthy) {
      console.warn('Warning: Core API is not accessible');
    } else {
      console.log('Core API is healthy');
    }

    // Create channel manager
    const channelManager = new ChannelManager({
      userMapper,
      coreApiClient,
    });

    // Register channels
    console.log('Registering channels...');

    if (config.enabledChannels.includes('telegram') && config.telegramBotToken) {
      const telegramChannel = createTelegramChannel({
        botToken: config.telegramBotToken,
      });
      channelManager.registerChannel(telegramChannel);
      console.log('  - Telegram channel registered');
    } else if (config.enabledChannels.includes('telegram')) {
      console.warn('  - Telegram channel enabled but TELEGRAM_BOT_TOKEN not set');
    }

    // TODO: Add Lark channel registration
    // TODO: Add Wework channel registration

    // Create Express app
    const app = createApp(channelManager);

    // Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`Channel Bot is listening on port ${config.port}`);
      console.log(`API endpoint: http://localhost:${config.port}/api`);
    });

    // Start all registered channels
    console.log('Starting channels...');
    await channelManager.startAll();

    // Display channel statuses
    const statuses = await channelManager.getChannelStatuses();
    console.log('Channel statuses:');
    for (const status of statuses) {
      console.log(`  - ${status.name}: ${status.status}`);
    }

    // Register graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown(channelManager, server));
    process.on('SIGINT', () => gracefulShutdown(channelManager, server));

  } catch (error) {
    console.error('Failed to start Channel Bot:', error);
    process.exit(1);
  }
}

// Start the application
main();
