import ProductService from './products.service.js';
import UploadService from '../../services/UploadService.js';
import ApiResponse from '../../utils/ApiResponse.js';
import asyncHandler from '../../middleware/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const { data, pagination } = await ProductService.list(req.query);
  ApiResponse.paginated(res, { data, pagination });
});

export const getBySlug = asyncHandler(async (req, res) => {
  const product = await ProductService.getBySlug(req.params.slug);
  // Increment views (non-blocking)
  ProductService.incrementViews(product._id).catch(() => {});
  ApiResponse.success(res, { data: product });
});

export const getById = asyncHandler(async (req, res) => {
  const product = await ProductService.getById(req.params.id);
  ApiResponse.success(res, { data: product });
});

export const create = asyncHandler(async (req, res) => {
  const product = await ProductService.create(req.body);
  ApiResponse.created(res, { message: 'Product created', data: product });
});

export const update = asyncHandler(async (req, res) => {
  const product = await ProductService.update(req.params.id, req.body);
  ApiResponse.success(res, { message: 'Product updated', data: product });
});

export const remove = asyncHandler(async (req, res) => {
  await ProductService.delete(req.params.id);
  ApiResponse.success(res, { message: 'Product deleted' });
});

export const uploadImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return ApiResponse.error(res, { statusCode: 400, message: 'No images uploaded' });
  }

  const images = await UploadService.processImages(req.files, { subfolder: 'products' });
  const product = await ProductService.addImages(req.params.id, images);
  ApiResponse.success(res, { message: 'Images uploaded', data: product.images });
});

export const updateSortOrder = asyncHandler(async (req, res) => {
  await ProductService.updateSortOrder(req.body.items);
  ApiResponse.success(res, { message: 'Sort order updated' });
});

export const getRelated = asyncHandler(async (req, res) => {
  const related = await ProductService.getRelated(req.params.id);
  ApiResponse.success(res, { data: related });
});
