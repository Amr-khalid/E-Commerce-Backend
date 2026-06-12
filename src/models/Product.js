import mongoose from 'mongoose';
import { PRODUCT_STATUS_LIST, VIDEO_PROVIDERS } from '../config/constants.js';

const ProductImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    isMain: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const ProductVideoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    provider: { type: String, enum: VIDEO_PROVIDERS, default: 'upload' },
  },
  { _id: false },
);

const ProductAttributeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // "color", "size", "weight"
    value: { type: String, required: true }, // "red", "XL", "500g"
  },
  { _id: false },
);

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 300,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: { type: String, trim: true },
    shortDescription: { type: String, trim: true, maxlength: 500 },

    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    brand: { type: String, trim: true, index: true },

    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      index: true,
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price cannot be negative'],
      default: null,
      index: true,
    },
    cost: { type: Number, min: 0 }, // for profit calculations
    taxRate: { type: Number, default: 0, min: 0, max: 100 },

    stock: { type: Number, default: 0, min: 0, index: true },
    lowStockThreshold: { type: Number, default: 5, min: 0 },

    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
      },
    ],
    relatedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    attributes: [ProductAttributeSchema],
    images: [ProductImageSchema],
    videos: [ProductVideoSchema],

    flags: {
      featured: { type: Boolean, default: false, index: true },
      newArrival: { type: Boolean, default: false, index: true },
      bestSeller: { type: Boolean, default: false, index: true },
      topPriority: { type: Boolean, default: false, index: true },
    },

    status: {
      type: String,
      enum: PRODUCT_STATUS_LIST,
      default: 'draft',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },

    // Computed stats (updated via hooks/services)
    avgRating: { type: Number, default: 0, min: 0, max: 5, index: true },
    reviewsCount: { type: Number, default: 0, min: 0 },
    salesCount: { type: Number, default: 0, min: 0, index: true },
    viewsCount: { type: Number, default: 0, min: 0 },

    seo: {
      title: String,
      description: String,
      keywords: [String],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Virtuals ─────────────────────────────────────────
ProductSchema.virtual('effectivePrice').get(function () {
  return this.discountPrice != null && this.discountPrice < this.price
    ? this.discountPrice
    : this.price;
});

ProductSchema.virtual('discountPercent').get(function () {
  if (this.discountPrice != null && this.discountPrice < this.price) {
    return Math.round(((this.price - this.discountPrice) / this.price) * 100);
  }
  return 0;
});

ProductSchema.virtual('mainImage').get(function () {
  const main = this.images?.find((img) => img.isMain);
  return main ? main.url : this.images?.[0]?.url || null;
});

ProductSchema.virtual('isOnSale').get(function () {
  return this.discountPrice != null && this.discountPrice < this.price;
});

ProductSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});

// ─── Compound Indexes ─────────────────────────────────
ProductSchema.index({ isActive: 1, status: 1, price: 1 });
ProductSchema.index({ categories: 1, isActive: 1, sortOrder: -1 });
ProductSchema.index({ 'attributes.key': 1, 'attributes.value': 1 });
ProductSchema.index({ 'flags.featured': 1, sortOrder: -1 });
ProductSchema.index({ avgRating: -1, reviewsCount: -1 });
ProductSchema.index({ salesCount: -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ brand: 1, isActive: 1 });

// Full-text search index (language: 'none' for Arabic support)
ProductSchema.index(
  { name: 'text', description: 'text' },
  {
    weights: { name: 10, description: 3 },
    default_language: 'none',
    name: 'product_text_search',
  },
);

// ─── Pre-validate: Ensure main image ──────────────────
ProductSchema.pre('validate', function (next) {
  if (this.images && this.images.length > 0) {
    const hasMain = this.images.some((img) => img.isMain);
    if (!hasMain) {
      this.images[0].isMain = true;
    }
  }
  next();
});

const Product = mongoose.model('Product', ProductSchema);
export default Product;
