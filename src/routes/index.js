import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from '../modules/auth/auth.routes.js';
import productRoutes from '../modules/products/products.routes.js';
import categoryRoutes from '../modules/categories/categories.routes.js';
import orderRoutes from '../modules/orders/orders.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import cartRoutes from '../modules/cart/cart.routes.js';
import couponRoutes from '../modules/coupons/coupons.routes.js';
import reviewRoutes from '../modules/reviews/reviews.routes.js';
import ticketRoutes from '../modules/tickets/tickets.routes.js';
import wishlistRoutes from '../modules/wishlist/wishlist.routes.js';
import notificationRoutes from '../modules/notifications/notifications.routes.js';
import userRoutes from '../modules/users/users.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import webhookRoutes from '../modules/webhooks/webhooks.routes.js';
import ApiResponse from '../utils/ApiResponse.js';

const router = Router();

// Health check
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const isHealthy = dbState === 1;

  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    success: isHealthy,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: DB_STATES[dbState] || 'unknown',
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heap: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      },
    },
  });
});

// ─── Mount Routes ─────────────────────────────────────
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/orders', orderRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/cart', cartRoutes);
router.use('/coupons', couponRoutes);
router.use('/reviews', reviewRoutes);
router.use('/support/tickets', ticketRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/notifications', notificationRoutes);
router.use('/me/addresses', userRoutes);
router.use('/admin', adminRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
