import mongoose from 'mongoose';
import config from './index.js';
import logger from './logger.js';

const connectDB = async () => {
  try {
    // Reuse existing connection in serverless environments
    if (mongoose.connection.readyState === 1) {
      logger.debug('Using existing MongoDB connection');
      return mongoose.connection;
    }

    const conn = await mongoose.connect(config.mongo.uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting reconnection...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Enable debug logging in development
    if (config.env === 'development') {
      mongoose.set('debug', (collectionName, method, query, doc) => {
        logger.debug(`Mongoose: ${collectionName}.${method}`, {
          query: JSON.stringify(query).substring(0, 200),
        });
      });
    }

    return conn;
  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error.message);
  }
};

export { connectDB, disconnectDB };
