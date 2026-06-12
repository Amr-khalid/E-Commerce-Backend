import { Router } from 'express';
import OrderService from './orders.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize, authorizePermission } from '../../middleware/rbac.js';
import validate from '../../middleware/validate.js';
import { PERMISSIONS } from '../../config/constants.js';
import Joi from 'joi';

// ─── Validation ───────────────────────────────────────
const createOrderSchema = Joi.object({
  shippingAddressId: Joi.string().hex().length(24).required(),
  billingAddressId: Joi.string().hex().length(24),
  paymentMethod: Joi.string().valid('cod', 'card', 'wallet', 'bank_transfer').required(),
  couponCode: Joi.string().trim().uppercase().allow('', null),
  customerNotes: Joi.string().trim().max(1000).allow('', null),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(
    'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned',
  ).required(),
  note: Joi.string().trim().max(500).allow(''),
  trackingNumber: Joi.string().trim().allow('', null),
});

const router = Router();

// ─── Customer Routes ──────────────────────────────────
router.post('/',
  authenticate,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await OrderService.createOrder({
      userId: req.user._id,
      ...req.body,
    });
    ApiResponse.created(res, { message: 'Order placed successfully', data: order });
  }),
);

router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await OrderService.getUserOrders(req.user._id, req.query);
    ApiResponse.paginated(res, result);
  }),
);

router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const isAdmin = ['admin', 'manager', 'staff'].includes(req.user.role);
    const order = await OrderService.getOrderDetails(
      req.params.id,
      isAdmin ? null : req.user._id,
    );
    ApiResponse.success(res, { data: order });
  }),
);

router.post('/:id/cancel',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await OrderService.cancelOrder(req.params.id, req.user._id);
    ApiResponse.success(res, { message: 'Order cancelled', data: order });
  }),
);

// ─── Admin Routes ─────────────────────────────────────
router.get('/admin/all',
  authenticate,
  authorizePermission(PERMISSIONS.ORDERS_VIEW_ALL),
  asyncHandler(async (req, res) => {
    const result = await OrderService.getAllOrders(req.query);
    ApiResponse.paginated(res, result);
  }),
);

router.patch('/admin/:id/status',
  authenticate,
  authorizePermission(PERMISSIONS.ORDERS_UPDATE_STATUS),
  validate(updateStatusSchema),
  asyncHandler(async (req, res) => {
    const order = await OrderService.updateStatus(
      req.params.id,
      req.body.status,
      req.user._id,
      req.body.note,
    );
    ApiResponse.success(res, { message: 'Order status updated', data: order });
  }),
);

export default router;
