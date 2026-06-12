import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${stack || message}`;
  const metaKeys = Object.keys(meta);
  if (metaKeys.length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  return log;
});

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || 'debug';
const logFile = process.env.LOG_FILE || 'logs/app.log';

const transports = [
  // Console transport — always on
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      consoleFormat,
    ),
  }),
];

// File transport — only in non-test environments
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    new winston.transports.File({
      filename: logFile,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json(),
      ),
    }),
    new winston.transports.File({
      filename: path.join(path.dirname(logFile), 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json(),
      ),
    }),
  );
}

const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'ecommerce-backend' },
  transports,
  // Don't exit on uncaught exceptions — let the process handler deal with it
  exitOnError: false,
});

export default logger;
