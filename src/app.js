import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestLogger } from './middleware/requestLogger.js';
import routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ─── Trust Proxy (Vercel / reverse proxy) ────────────
app.set('trust proxy', 1);

// ─── Security Headers ────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ────────────────────────────────────────────
const allowedOrigins = config.cors.origin
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (config.isProduction) {
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }

    // In development, allow all origins
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

// ─── Compression ─────────────────────────────────────
app.use(compression());

// ─── Body Parsing ────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Cookie Parser ───────────────────────────────────
app.use(cookieParser());

// ─── Mongo Sanitize (prevent NoSQL injection) ────────
app.use(mongoSanitize({
  replaceWith: '_',
}));

// ─── HTTP Parameter Pollution Protection ─────────────
app.use(hpp({
  whitelist: ['category_ids', 'brand_ids', 'flags', 'attributes'],
}));

// ─── Rate Limiting ───────────────────────────────────
app.use(config.apiPrefix, globalRateLimiter);

// ─── Request Logging ─────────────────────────────────
app.use(requestLogger);

// ─── Static Files (uploads) ──────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', config.upload.dir)));

// ─── API Routes ──────────────────────────────────────
app.use(config.apiPrefix, routes);

// ─── Root ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'E-Commerce API',
    version: '1.0.0',
    docs: `${config.apiPrefix}/health`,
  });
});

// ─── 404 Handler ─────────────────────────────────────
app.use(notFound);

// ─── Global Error Handler ────────────────────────────
app.use(errorHandler);

export default app;
