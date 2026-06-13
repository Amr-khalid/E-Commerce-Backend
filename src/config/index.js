import dotenv from 'dotenv';
dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  mongo: {
    uri: process.env.NODE_ENV === 'test'
      ? process.env.MONGO_URI_TEST
      : process.env.MONGO_URI,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
    maxFiles: parseInt(process.env.MAX_FILES, 10) || 10,
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@store.com',
  },

  cache: {
    ttlProducts: parseInt(process.env.CACHE_TTL_PRODUCTS, 10) || 300,
    ttlCategories: parseInt(process.env.CACHE_TTL_CATEGORIES, 10) || 600,
    ttlSettings: parseInt(process.env.CACHE_TTL_SETTINGS, 10) || 3600,
  },

  shipping: {
    defaultCost: parseFloat(process.env.DEFAULT_SHIPPING_COST) || 25,
    freeThreshold: parseFloat(process.env.FREE_SHIPPING_THRESHOLD) || 500,
  },

  tax: {
    defaultRate: parseFloat(process.env.DEFAULT_TAX_RATE) || 15,
  },

  sla: {
    firstResponseHours: parseInt(process.env.SLA_FIRST_RESPONSE_HOURS, 10) || 4,
    resolutionHours: parseInt(process.env.SLA_RESOLUTION_HOURS, 10) || 24,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
};

// ─── Validate Required Config ─────────────────────────
const requiredVars = [
  ['mongo.uri', config.mongo.uri],
  ['jwt.accessSecret', config.jwt.accessSecret],
  ['jwt.refreshSecret', config.jwt.refreshSecret],
];

const missing = requiredVars.filter(([, value]) => !value);
if (missing.length > 0) {
  const names = missing.map(([name]) => name).join(', ');
  console.error(`❌ Missing required environment variables: ${names}`);
  console.error('   Copy .env.example to .env and fill in the values.');
  if (config.isProduction) {
    process.exit(1);
  }
}

export default config;
