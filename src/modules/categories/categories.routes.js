import { Router } from 'express';
import Category from '../../models/Category.js';
import CacheService from '../../services/CacheService.js';
import { generateUniqueSlug } from '../../utils/slugify.js';
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { authorizePermission } from '../../middleware/rbac.js';
import validate from '../../middleware/validate.js';
import { PERMISSIONS } from '../../config/constants.js';
import config from '../../config/index.js';
import Joi from 'joi';

// ─── Validation ───────────────────────────────────────
const createCategorySchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  description: Joi.string().trim().allow(''),
  parent: Joi.string().hex().length(24).allow(null),
  image: Joi.string().allow('', null),
  sortOrder: Joi.number().integer().default(0),
  isActive: Joi.boolean().default(true),
  seo: Joi.object({
    title: Joi.string().allow(''),
    description: Joi.string().allow(''),
    keywords: Joi.array().items(Joi.string()),
  }),
});

const updateCategorySchema = createCategorySchema.fork(['name'], (s) => s.optional());

// ─── Controller ───────────────────────────────────────
const getTree = asyncHandler(async (req, res) => {
  const tree = await CacheService.getOrSet(
    CacheService.keys.categoryTree(),
    () => Category.buildTree(),
    config.cache.ttlCategories,
  );
  ApiResponse.success(res, { data: tree });
});

const getById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id).lean();
  if (!category) throw ApiError.notFound('Category not found');
  ApiResponse.success(res, { data: category });
});

const create = asyncHandler(async (req, res) => {
  req.body.slug = await generateUniqueSlug(req.body.name, Category);
  const category = await Category.create(req.body);
  CacheService.invalidateCategories();
  ApiResponse.created(res, { data: category });
});

const update = asyncHandler(async (req, res) => {
  if (req.body.name) {
    req.body.slug = await generateUniqueSlug(req.body.name, Category);
  }
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true },
  );
  if (!category) throw ApiError.notFound('Category not found');
  CacheService.invalidateCategories();
  ApiResponse.success(res, { data: category });
});

const remove = asyncHandler(async (req, res) => {
  // Check for children
  const children = await Category.countDocuments({ parent: req.params.id });
  if (children > 0) {
    throw ApiError.badRequest('Cannot delete category with subcategories');
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  CacheService.invalidateCategories();
  ApiResponse.success(res, { message: 'Category deleted' });
});

// ─── Routes ───────────────────────────────────────────
const router = Router();

router.get('/', getTree);
router.get('/:id', getById);
router.post('/', authenticate, authorizePermission(PERMISSIONS.CATEGORIES_CREATE), validate(createCategorySchema), create);
router.patch('/:id', authenticate, authorizePermission(PERMISSIONS.CATEGORIES_UPDATE), validate(updateCategorySchema), update);
router.delete('/:id', authenticate, authorizePermission(PERMISSIONS.CATEGORIES_DELETE), remove);

export default router;
