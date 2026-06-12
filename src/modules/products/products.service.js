import Product from '../../models/Product.js';
import QueryBuilder from '../../services/QueryBuilder.js';
import CacheService from '../../services/CacheService.js';
import { generateUniqueSlug } from '../../utils/slugify.js';
import ApiError from '../../utils/ApiError.js';
import config from '../../config/index.js';

class ProductService {
  static async list(query) {
    const qb = new QueryBuilder(Product);
    qb.fromQuery(query)
      .populate({ path: 'categories', select: 'name slug' });

    return qb.exec();
  }

  static async getBySlug(slug) {
    const cacheKey = CacheService.keys.productSlug(slug);
    return CacheService.getOrSet(
      cacheKey,
      async () => {
        const product = await Product.findOne({ slug, isActive: true })
          .populate('categories', 'name slug')
          .populate('relatedProducts', 'name slug price discountPrice images avgRating')
          .lean();
        if (!product) throw ApiError.notFound('Product not found');
        return product;
      },
      config.cache.ttlProducts,
    );
  }

  static async getById(id) {
    const product = await Product.findById(id)
      .populate('categories', 'name slug')
      .populate('relatedProducts', 'name slug price discountPrice images avgRating')
      .lean();
    if (!product) throw ApiError.notFound('Product not found');
    return product;
  }

  static async create(data) {
    data.slug = await generateUniqueSlug(data.name, Product);
    const product = await Product.create(data);
    CacheService.invalidateProductLists();
    return product;
  }

  static async update(id, data) {
    if (data.name) {
      data.slug = await generateUniqueSlug(data.name, Product);
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true },
    ).populate('categories', 'name slug');

    if (!product) throw ApiError.notFound('Product not found');

    CacheService.invalidateProduct(id);
    return product;
  }

  static async delete(id) {
    const product = await Product.findByIdAndDelete(id);
    if (!product) throw ApiError.notFound('Product not found');
    CacheService.invalidateProduct(id);
    return product;
  }

  static async addImages(id, images) {
    const product = await Product.findById(id);
    if (!product) throw ApiError.notFound('Product not found');

    // If no existing main image, set first new image as main
    const hasMain = product.images.some((img) => img.isMain);
    if (!hasMain && images.length > 0) {
      images[0].isMain = true;
    }

    product.images.push(...images);
    await product.save();
    CacheService.invalidateProduct(id);
    return product;
  }

  static async updateSortOrder(items) {
    const bulkOps = items.map(({ id, sortOrder }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder } },
      },
    }));

    await Product.bulkWrite(bulkOps);
    CacheService.invalidateProductLists();
  }

  static async getRelated(id) {
    const product = await Product.findById(id).select('relatedProducts categories').lean();
    if (!product) throw ApiError.notFound('Product not found');

    let related;
    if (product.relatedProducts && product.relatedProducts.length > 0) {
      related = await Product.find({
        _id: { $in: product.relatedProducts },
        isActive: true,
        status: 'active',
      })
        .select('name slug price discountPrice images avgRating reviewsCount')
        .limit(12)
        .lean();
    } else {
      // Auto-suggest from same categories
      related = await Product.find({
        _id: { $ne: id },
        categories: { $in: product.categories },
        isActive: true,
        status: 'active',
      })
        .select('name slug price discountPrice images avgRating reviewsCount')
        .sort({ salesCount: -1 })
        .limit(12)
        .lean();
    }

    return related;
  }

  static async incrementViews(id) {
    await Product.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } });
  }
}

export default ProductService;
