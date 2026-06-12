import app from './app.js';
import config from './config/index.js';
import { connectDB, disconnectDB } from './config/database.js';
import logger from './config/logger.js';

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running in ${config.env} mode on port ${config.port}`);
      logger.info(`📍 API: http://localhost:${config.port}${config.apiPrefix}`);
      logger.info(`❤️  Health: http://localhost:${config.port}${config.apiPrefix}/health`);
    });

    // ─── Graceful Shutdown ────────────────────────────
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDB();
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ─── Unhandled Errors ─────────────────────────────
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Rejection:', err);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      shutdown('UNCAUGHT_EXCEPTION');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
