import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import Inventory from '../../models/Inventory.js';
import User from '../../models/User.js';
import CouponUsage from '../../models/CouponUsage.js';
import Review from '../../models/Review.js';
import SupportTicket from '../../models/SupportTicket.js';
import CacheService from '../../services/CacheService.js';
import ApiResponse from '../../utils/ApiResponse.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { authorizePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../config/constants.js';

const router = Router();

// ─── Dashboard Summary ───────────────────────────────
router.get('/dashboard',
  authenticate,
  authorizePermission(PERMISSIONS.ADMIN_DASHBOARD),
  asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalOrders,
      pendingOrders,
      todayOrders,
      totalRevenue,
      totalCustomers,
      lowStockCount,
      pendingReviews,
      openTickets,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } },
      ]),
      User.countDocuments({ isActive: true }),
      Inventory.countDocuments({ $expr: { $lte: ['$quantity', '$lowStockThreshold'] } }),
      Review.countDocuments({ status: 'pending_moderation' }),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    ]);

    ApiResponse.success(res, {
      data: {
        totalOrders,
        pendingOrders,
        todayOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalCustomers,
        lowStockCount,
        pendingReviews,
        openTickets,
      },
    });
  }),
);

// ─── Revenue Report ───────────────────────────────────
router.get('/reports/revenue',
  authenticate,
  authorizePermission(PERMISSIONS.REPORTS_VIEW),
  asyncHandler(async (req, res) => {
    const period = req.query.period || 'daily'; // daily, weekly, monthly
    const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = req.query.to ? new Date(req.query.to) : new Date();

    let dateFormat;
    switch (period) {
      case 'monthly': dateFormat = '%Y-%m'; break;
      case 'weekly': dateFormat = '%Y-W%V'; break;
      default: dateFormat = '%Y-%m-%d';
    }

    const revenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          paymentStatus: { $in: ['paid'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          revenue: { $sum: '$grandTotal' },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: '$grandTotal' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const summary = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$grandTotal' },
          totalDiscount: { $sum: '$totalDiscount' },
        },
      },
    ]);

    ApiResponse.success(res, {
      data: {
        period,
        from,
        to,
        summary: summary[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, totalDiscount: 0 },
        breakdown: revenue,
      },
    });
  }),
);

// ─── Top Products ─────────────────────────────────────
router.get('/reports/top-products',
  authenticate,
  authorizePermission(PERMISSIONS.REPORTS_VIEW),
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;

    const topProducts = await Product.find({ isActive: true })
      .sort({ salesCount: -1 })
      .limit(limit)
      .select('name sku price salesCount avgRating reviewsCount stock images')
      .lean();

    ApiResponse.success(res, { data: topProducts });
  }),
);

// ─── Coupon Performance ───────────────────────────────
router.get('/reports/coupons',
  authenticate,
  authorizePermission(PERMISSIONS.REPORTS_VIEW),
  asyncHandler(async (req, res) => {
    const couponStats = await CouponUsage.aggregate([
      {
        $group: {
          _id: '$coupon',
          totalUses: { $sum: 1 },
          totalDiscount: { $sum: '$discountApplied' },
          uniqueUsers: { $addToSet: '$user' },
        },
      },
      {
        $lookup: {
          from: 'coupons',
          localField: '_id',
          foreignField: '_id',
          as: 'coupon',
          pipeline: [{ $project: { code: 1, type: 1, value: 1 } }],
        },
      },
      { $unwind: '$coupon' },
      {
        $project: {
          coupon: 1,
          totalUses: 1,
          totalDiscount: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
        },
      },
      { $sort: { totalUses: -1 } },
      { $limit: 20 },
    ]);

    ApiResponse.success(res, { data: couponStats });
  }),
);

// ─── Ticket SLA Report ───────────────────────────────
router.get('/reports/tickets-sla',
  authenticate,
  authorizePermission(PERMISSIONS.REPORTS_VIEW),
  asyncHandler(async (req, res) => {
    const [slaStats, statusBreakdown, avgTimes] = await Promise.all([
      SupportTicket.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            breached: { $sum: { $cond: ['$slaBreached', 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          },
        },
      ]),
      SupportTicket.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SupportTicket.aggregate([
        { $match: { firstResponseAt: { $exists: true } } },
        {
          $project: {
            responseTime: { $subtract: ['$firstResponseAt', '$createdAt'] },
            resolutionTime: {
              $cond: {
                if: '$resolvedAt',
                then: { $subtract: ['$resolvedAt', '$createdAt'] },
                else: null,
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' },
            avgResolutionTime: { $avg: '$resolutionTime' },
          },
        },
      ]),
    ]);

    ApiResponse.success(res, {
      data: {
        sla: slaStats[0] || { total: 0, breached: 0, resolved: 0 },
        statusBreakdown,
        avgResponseTimeHours: avgTimes[0] ? Math.round(avgTimes[0].avgResponseTime / 3600000 * 10) / 10 : 0,
        avgResolutionTimeHours: avgTimes[0] ? Math.round((avgTimes[0].avgResolutionTime || 0) / 3600000 * 10) / 10 : 0,
      },
    });
  }),
);

export default router;
