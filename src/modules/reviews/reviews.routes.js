import { Router } from 'express';
import Review from '../../models/Review.js';
import Question from '../../models/Question.js';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { authorizePermission } from '../../middleware/rbac.js';
import validate from '../../middleware/validate.js';
import { PERMISSIONS, REVIEW_STATUS } from '../../config/constants.js';
import Joi from 'joi';

// ─── Validation ───────────────────────────────────────
const createReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().trim().max(200).allow(''),
  body: Joi.string().trim().max(5000).required(),
  orderId: Joi.string().hex().length(24).allow(null),
});

const voteSchema = Joi.object({
  vote: Joi.string().valid('up', 'down').required(),
});

const reportSchema = Joi.object({
  reason: Joi.string().valid('abuse', 'misleading', 'spam', 'other').required(),
  note: Joi.string().trim().max(500).allow(''),
});

const replySchema = Joi.object({
  body: Joi.string().trim().max(2000).required(),
});

const moderateSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
});

const questionSchema = Joi.object({
  body: Joi.string().trim().max(2000).required(),
});

const answerSchema = Joi.object({
  body: Joi.string().trim().max(3000).required(),
});

const router = Router();

// ─── Product Reviews ──────────────────────────────────
// Get reviews for a product
router.get('/products/:productId/reviews',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(50, parseInt(req.query.per_page, 10) || 10);

    const filter = {
      product: req.params.productId,
      status: REVIEW_STATUS.APPROVED,
    };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('user', 'firstName lastName')
        .populate('replies.repliedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .lean(),
      Review.countDocuments(filter),
    ]);

    // Get rating distribution
    const distribution = await Review.aggregate([
      { $match: { product: Review.base.Types.ObjectId.createFromHexString(req.params.productId), status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    ApiResponse.paginated(res, {
      data: reviews,
      pagination: { total, per_page: perPage, current_page: page, last_page: Math.ceil(total / perPage) },
      meta: { ratingDistribution: distribution },
    });
  }),
);

// Create review
router.post('/products/:productId/reviews',
  authenticate,
  validate(createReviewSchema),
  asyncHandler(async (req, res) => {
    if (req.user.isReviewBanned) {
      throw ApiError.forbidden('You are banned from posting reviews');
    }

    // Check for duplicate
    const existing = await Review.findOne({ product: req.params.productId, user: req.user._id });
    if (existing) throw ApiError.conflict('You already reviewed this product');

    // Check verified purchase
    let verifiedPurchase = false;
    if (req.body.orderId) {
      const order = await Order.findOne({
        _id: req.body.orderId,
        user: req.user._id,
        status: 'delivered',
        'items.product': req.params.productId,
      });
      if (order) verifiedPurchase = true;
    }

    const review = await Review.create({
      product: req.params.productId,
      user: req.user._id,
      order: req.body.orderId,
      rating: req.body.rating,
      title: req.body.title,
      body: req.body.body,
      verifiedPurchase,
      status: REVIEW_STATUS.PENDING,
    });

    ApiResponse.created(res, { message: 'Review submitted for moderation', data: review });
  }),
);

// Vote on review
router.post('/reviews/:id/vote',
  authenticate,
  validate(voteSchema),
  asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);
    if (!review) throw ApiError.notFound('Review not found');

    // Check existing vote
    const existingVote = review.voters.find((v) => v.user.toString() === req.user._id.toString());
    if (existingVote) {
      if (existingVote.vote === req.body.vote) {
        throw ApiError.conflict('You already voted');
      }
      // Change vote
      existingVote.vote = req.body.vote;
      if (req.body.vote === 'up') { review.helpfulVotes++; review.notHelpfulVotes--; }
      else { review.helpfulVotes--; review.notHelpfulVotes++; }
    } else {
      review.voters.push({ user: req.user._id, vote: req.body.vote });
      if (req.body.vote === 'up') review.helpfulVotes++;
      else review.notHelpfulVotes++;
    }

    await review.save();
    ApiResponse.success(res, { message: 'Vote recorded' });
  }),
);

// Report review
router.post('/reviews/:id/report',
  authenticate,
  validate(reportSchema),
  asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);
    if (!review) throw ApiError.notFound('Review not found');

    const alreadyReported = review.reports.some(
      (r) => r.user.toString() === req.user._id.toString(),
    );
    if (alreadyReported) throw ApiError.conflict('Already reported');

    review.reports.push({ user: req.user._id, reason: req.body.reason, note: req.body.note });
    await review.save();

    ApiResponse.success(res, { message: 'Report submitted' });
  }),
);

// Reply to review
router.post('/reviews/:id/reply',
  authenticate,
  validate(replySchema),
  asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);
    if (!review) throw ApiError.notFound('Review not found');

    const isStaff = ['admin', 'manager', 'staff'].includes(req.user.role);

    review.replies.push({
      body: req.body.body,
      repliedBy: req.user._id,
      isStoreReply: isStaff,
    });

    await review.save();
    ApiResponse.success(res, { message: 'Reply added' });
  }),
);

// ─── Admin: Moderation Queue ──────────────────────────
router.get('/admin/queue',
  authenticate,
  authorizePermission(PERMISSIONS.REVIEWS_VIEW_QUEUE),
  asyncHandler(async (req, res) => {
    const filter = { status: REVIEW_STATUS.PENDING };
    if (req.query.has_reports === 'true') {
      filter['reports.0'] = { $exists: true };
    }

    const reviews = await Review.find(filter)
      .populate('user', 'firstName lastName email')
      .populate('product', 'name slug')
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    ApiResponse.success(res, { data: reviews });
  }),
);

// Moderate review
router.patch('/admin/:id/moderate',
  authenticate,
  authorizePermission(PERMISSIONS.REVIEWS_MODERATE),
  validate(moderateSchema),
  asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status === 'approved' ? REVIEW_STATUS.APPROVED : REVIEW_STATUS.REJECTED },
      { new: true },
    );
    if (!review) throw ApiError.notFound('Review not found');

    // Update product avg rating if approved
    if (req.body.status === 'approved') {
      const stats = await Review.aggregate([
        { $match: { product: review.product, status: 'approved' } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      if (stats.length > 0) {
        await Product.findByIdAndUpdate(review.product, {
          avgRating: Math.round(stats[0].avg * 10) / 10,
          reviewsCount: stats[0].count,
        });
      }
    }

    ApiResponse.success(res, { message: `Review ${req.body.status}`, data: review });
  }),
);

// ─── Product Q&A ──────────────────────────────────────
router.get('/products/:productId/questions',
  asyncHandler(async (req, res) => {
    const questions = await Question.find({ product: req.params.productId })
      .populate('user', 'firstName lastName')
      .populate('answers.user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();
    ApiResponse.success(res, { data: questions });
  }),
);

router.post('/products/:productId/questions',
  authenticate,
  validate(questionSchema),
  asyncHandler(async (req, res) => {
    const question = await Question.create({
      product: req.params.productId,
      user: req.user._id,
      body: req.body.body,
    });
    ApiResponse.created(res, { data: question });
  }),
);

router.post('/questions/:id/answers',
  authenticate,
  validate(answerSchema),
  asyncHandler(async (req, res) => {
    const question = await Question.findById(req.params.id);
    if (!question) throw ApiError.notFound('Question not found');

    const isStaff = ['admin', 'manager', 'staff'].includes(req.user.role);

    question.answers.push({
      user: req.user._id,
      body: req.body.body,
      isStoreAnswer: isStaff,
    });
    question.status = 'answered';
    await question.save();

    ApiResponse.success(res, { message: 'Answer added' });
  }),
);

export default router;
