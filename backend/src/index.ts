/**
 * SuperInbox Core - Main Application Entry Point
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { closeDatabase } from './storage/database.js';
import { runMigrations } from './storage/migrations/run.js';
import { initializeAdapters } from './router/index.js';
import { requestLogger, errorHandler, notFoundHandler, accessLogMiddleware } from './middleware/index.js';
import inboxRoutes from './capture/routes/inbox.routes.js';
import promptsRoutes from './intelligence/routes/prompts.routes.js';
import categoriesRoutes from './ai/routes/categories.routes.js';
import llmUsageRoutes from './ai/routes/llm-usage.routes.js';
import rulesRoutes from './router/routes/rules.routes.js';
import settingsRoutes from './settings/routes/settings.routes.js';
import authRoutes from './auth/auth.routes.js';
import oauthRoutes from './auth/routes/oauth.routes.js';
import logsRoutes from './auth/logs.routes.js';
import apiKeysRoutes from './api-keys/api-keys.routes.js';
import mcpAdaptersRoutes from './router/routes/mcp-adapters.routes.js';
import { logger } from './middleware/logger.js';

// Create Express app
const app = express();

// ============================================
// Security Middleware
// ============================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: config.server.nodeEnv === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// CORS
const corsOrigins = config.cors.origin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigin = corsOrigins.includes('*') ? true : corsOrigins;
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// ============================================
// Body Parser Middleware
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// ============================================
// Request Logging
// ============================================

app.use(requestLogger);

// Access log middleware (must come after body parsing)
app.use(accessLogMiddleware);

// ============================================
// Health Check
// ============================================

const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'healthy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

app.get('/health', healthHandler);
app.get('/v1/health', healthHandler);

app.get('/ping', (_req, res) => {
  res.json({ pong: true });
});

// ============================================
// API Routes
// ============================================

// API v1 routes
app.use('/v1/auth/oauth', oauthRoutes);
app.use('/v1/auth', authRoutes);
app.use('/v1/auth', logsRoutes); // Log routes under auth
app.use('/v1/auth/api-keys', apiKeysRoutes); // Documented path (Task 11)
app.use('/v1/mcp-adapters', mcpAdaptersRoutes);
app.use('/v1/intelligence', promptsRoutes);
app.use('/v1/categories', categoriesRoutes);
app.use('/v1/ai/usage', llmUsageRoutes);
app.use('/v1/routing', rulesRoutes);
app.use('/v1/settings', settingsRoutes);
app.use('/v1', inboxRoutes);

// API info endpoint
app.get('/api', (_req, res) => {
  res.json({
    name: 'SuperInbox Core API',
    version: '0.1.0',
    description: 'A unified entry point for digital information with AI-powered intelligent routing',
    documentation: '/docs',
    endpoints: {
      v1: '/v1',
      health: '/health'
    }
  });
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// Server Initialization
// ============================================

async function startServer(): Promise<void> {
  try {
    // Initialize database schema
    logger.info('Running database migrations...');
    await runMigrations();
    logger.info('Database migrations completed');

    // Initialize adapters
    logger.info('Initializing adapters...');
    initializeAdapters();
    logger.info('Adapters initialized');

    // Start server
    const server = app.listen(config.server.port, config.server.host, () => {
      logger.info({
        message: 'SuperInbox Core server started',
        host: config.server.host,
        port: config.server.port,
        environment: config.server.nodeEnv,
        api: `http://${config.server.host}:${config.server.port}/v1`
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close database connection
      closeDatabase();

      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start the HTTP server when this file is used as the actual entrypoint.
// This prevents test suites (which import the Express app) from accidentally
// starting a listener.
const currentFilePath = path.resolve(fileURLToPath(import.meta.url));
const isEntrypoint = process.argv.some((arg) => {
  // Ignore flags like "--watch"
  if (!arg || arg.startsWith('-')) return false;
  try {
    return path.resolve(arg) === currentFilePath;
  } catch {
    return false;
  }
});

if (isEntrypoint) {
  startServer();
}

export default app;
