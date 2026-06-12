import { Router } from 'express';
import Coupon from '../../models/Coupon.js';
import CouponBatch from '../../models/CouponBatch.js';
import CouponUsage from '../../models/CouponUsage.js';
import DiscountRule from '../../models/DiscountRule.js';
import DiscountEngine from '../../services/DiscountEngine.js';
import { generateBulkCouponCodes } from '../../utils/generateCouponCode.js';
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { authorizePermission } from '../../middleware/rbac.js';
import validate from '../../middleware/validate.js';
import { PERMISSIONS } from '../../config/constants.js';
import logger from '../../config/logger.js';
import Joi from 'joi';

// ─── Validation ───────────────────────────────────────
const createCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().required(),
  description: Joi.string().trim().allow(''),
  type: Joi.string().valid('percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y').required(),
  value: Joi.number().min(0).required(),
  buyQuantity: Joi.number().integer().min(1).when('type', { is: 'buy_x_get_y', then: Joi.required() }),
  getQuantity: Joi.number().integer().min(1).when('type', { is: 'buy_x_get_y', then: Joi.required() }),
  getDiscountPercent: Joi.number().min(0).max(100).default(100),
  scope: Joi.string().valid('order', 'products', 'categories').default('order'),
  productIds: Joi.array().items(Joi.string().hex().length(24)),
  categoryIds: Joi.array().items(Joi.string().hex().length(24)),
  firstOrderOnly: Joi.boolean().default(false),
  startsAt: Joi.date().required(),
  expiresAt: Joi.date().greater(Joi.ref('startsAt')).required(),
  maxUses: Joi.number().integer().min(1).allow(null),
  maxUsesPerUser: Joi.number().integer().min(1).default(1),
  minOrderAmount: Joi.number().min(0).default(0),
  maxDiscountCap: Joi.number().min(0).allow(null),
  singleUse: Joi.boolean().default(false),
  assignedToUser: Joi.string().hex().length(24).allow(null),
  stackable: Joi.boolean().default(false),
  priority: Joi.number().integer().default(0),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const bulkGenerateSchema = Joi.object({
  name: Joi.string().trim().required(),
  prefix: Joi.string().trim().uppercase().allow(''),
  count: Joi.number().integer().min(1).max(10000).required(),
  template: Joi.object({
    type: Joi.string().valid('percentage', 'fixed_amount', 'free_shipping').required(),
    value: Joi.number().min(0).required(),
    scope: Joi.string().valid('order', 'products', 'categories').default('order'),
    startsAt: Joi.date().required(),
    expiresAt: Joi.date().required(),
    maxUsesPerUser: Joi.number().integer().default(1),
    minOrderAmount: Joi.number().min(0).default(0),
    maxDiscountCap: Joi.number().allow(null),
    singleUse: Joi.boolean().default(true),
  }).required(),
});

const validateCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().required(),
  cartItems: Joi.array().items(
    Joi.object({
      product: Joi.string().hex().length(24).required(),
      quantity: Joi.number().integer().min(1).required(),
    }),
  ),
});

const createDiscountRuleSchema = Joi.object({
  name: Joi.string().trim().required(),
  description: Joi.string().trim().allow(''),
  type: Joi.string().valid('spend_threshold', 'bulk_discount', 'scheduled', 'flagged_products').required(),
  conditions: Joi.object({
    minSpend: Joi.number().min(0),
    minQuantity: Joi.number().integer().min(1),
    productIds: Joi.array().items(Joi.string().hex().length(24)),
    categoryIds: Joi.array().items(Joi.string().hex().length(24)),
    flagsRequired: Joi.array().items(Joi.string()),
  }),
  discount: Joi.object({
    kind: Joi.string().valid('percentage', 'fixed').required(),
    value: Joi.number().min(0).required(),
    cap: Joi.number().min(0).allow(null),
  }).required(),
  startsAt: Joi.date().allow(null),
  expiresAt: Joi.date().allow(null),
  priority: Joi.number().integer().default(0),
  stackable: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
});

const router = Router();

// ─── Customer: Validate Coupon ────────────────────────
router.post('/validate',
  authenticate,
  validate(validateCouponSchema),
  asyncHandler(async (req, res) => {
    const { code, cartItems } = req.body;
    // Use discount engine's internal validation
    const result = await DiscountEngine.calculate({
      items: cartItems || [],
      couponCode: code,
      userId: req.user._id,
    });

    ApiResponse.success(res, {
      data: {
        valid: result.couponValidation?.valid || false,
        message: result.couponValidation?.message || '',
        discount: result.couponDiscount,
      },
    });
  }),
);

// ─── Admin: Coupon CRUD ───────────────────────────────
router.get('/admin',
  authenticate,
  authorizePermission(PERMISSIONS.COUPONS_VIEW),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(50, parseInt(req.query.per_page, 10) || 20);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;

    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
      Coupon.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, {
      data: coupons,
      pagination: { total, per_page: perPage, current_page: page, last_page: Math.ceil(total / perPage) },
    });
  }),
);

router.post('/admin',
  authenticate,
  authorizePermission(PERMISSIONS.COUPONS_CREATE),
  validate(createCouponSchema),
  asyncHandler(async (req, res) => {
    req.body.createdBy = req.user._id;
    const coupon = await Coupon.create(req.body);
    ApiResponse.created(res, { data: coupon });
  }),
);

router.patch('/admin/:id',
  authenticate,
  authorizePermission(PERMISSIONS.COUPONS_UPDATE),
  asyncHandler(async (req, res) => {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!coupon) throw ApiError.notFound('Coupon not found');
    ApiResponse.success(res, { data: coupon });
  }),
);

router.get('/admin/:id/usages',
  authenticate,
  authorizePermission(PERMISSIONS.COUPONS_VIEW),
  asyncHandler(async (req, res) => {
    const usages = await CouponUsage.find({ coupon: req.params.id })
      .populate('user', 'firstName lastName email')
      .populate('order', 'orderNumber grandTotal')
      .sort({ usedAt: -1 })
      .lean();
    ApiResponse.success(res, { data: usages });
  }),
);

// ─── Bulk Generate ────────────────────────────────────
router.post('/admin/bulk-generate',
  authenticate,
  authorizePermission(PERMISSIONS.COUPONS_BULK_GENERATE),
  validate(bulkGenerateSchema),
  asyncHandler(async (req, res) => {
    const { name, prefix, count, template } = req.body;

    // Generate unique codes
    const codes = generateBulkCouponCodes(count, { prefix });

    // Create batch record
    const batch = await CouponBatch.create({
      name,
      prefix,
      count,
      generatedCount: count,
      template,
      createdBy: req.user._id,
    });

    // Bulk insert coupons
    const coupons = codes.map((code) => ({
      code,
      type: template.type,
      value: template.value,
      scope: template.scope || 'order',
      startsAt: template.startsAt,
      expiresAt: template.expiresAt,
      maxUsesPerUser: template.maxUsesPerUser || 1,
      minOrderAmount: template.minOrderAmount || 0,
      maxDiscountCap: template.maxDiscountCap,
      singleUse: template.singleUse !== false,
      batchId: batch._id,
      createdBy: req.user._id,
      status: 'active',
    }));

    await Coupon.insertMany(coupons, { ordered: false });

    logger.info(`Bulk generated ${count} coupons for batch: ${name}`);

    ApiResponse.created(res, {
      message: `${count} coupons generated`,
      data: { batchId: batch._id, sampleCodes: codes.slice(0, 5) },
    });
  }),
);

// ─── Discount Rules ───────────────────────────────────
router.get('/admin/rules',
  authenticate,
  authorizePermission(PERMISSIONS.DISCOUNT_RULES_VIEW),
  asyncHandler(async (req, res) => {
    const rules = await DiscountRule.find().sort({ priority: -1 }).lean();
    ApiResponse.success(res, { data: rules });
  }),
);

router.post('/admin/rules',
  authenticate,
  authorizePermission(PERMISSIONS.DISCOUNT_RULES_CREATE),
  validate(createDiscountRuleSchema),
  asyncHandler(async (req, res) => {
    req.body.createdBy = req.user._id;
    const rule = await DiscountRule.create(req.body);
    ApiResponse.created(res, { data: rule });
  }),
);

router.patch('/admin/rules/:id',
  authenticate,
  authorizePermission(PERMISSIONS.DISCOUNT_RULES_UPDATE),
  asyncHandler(async (req, res) => {
    const rule = await DiscountRule.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!rule) throw ApiError.notFound('Discount rule not found');
    ApiResponse.success(res, { data: rule });
  }),
);

export default router;
