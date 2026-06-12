import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: { type: String, trim: true },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    // Materialized path for fast ancestor/descendant queries
    // Format: ",root_id,parent_id,this_id,"
    path: { type: String, index: true, default: '' },
    depth: { type: Number, default: 0 },
    image: { type: String },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    seo: {
      title: String,
      description: String,
      keywords: [String],
    },
    productCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ─── Compound Indexes ─────────────────────────────────
CategorySchema.index({ parent: 1, isActive: 1, sortOrder: 1 });

// ─── Pre-save: Build materialized path ────────────────
CategorySchema.pre('save', async function (next) {
  if (this.isModified('parent')) {
    if (this.parent) {
      const parentCategory = await this.constructor.findById(this.parent).lean();
      if (parentCategory) {
        this.path = `${parentCategory.path}${parentCategory._id},`;
        this.depth = parentCategory.depth + 1;
      }
    } else {
      this.path = ',';
      this.depth = 0;
    }
  }
  next();
});

// ─── Methods ──────────────────────────────────────────
/**
 * Get all ancestor IDs from path
 */
CategorySchema.methods.getAncestorIds = function () {
  return this.path
    .split(',')
    .filter((id) => id.length > 0);
};

// ─── Statics ──────────────────────────────────────────
/**
 * Get all descendants of a category
 */
CategorySchema.statics.getDescendants = function (categoryId) {
  return this.find({
    path: { $regex: `,${categoryId},` },
    isActive: true,
  }).lean();
};

/**
 * Build full category tree
 */
CategorySchema.statics.buildTree = async function (filter = { isActive: true }) {
  const categories = await this.find(filter)
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const map = {};
  const tree = [];

  // First pass: create map
  for (const cat of categories) {
    map[cat._id.toString()] = { ...cat, children: [] };
  }

  // Second pass: build tree
  for (const cat of categories) {
    const node = map[cat._id.toString()];
    if (cat.parent && map[cat.parent.toString()]) {
      map[cat.parent.toString()].children.push(node);
    } else {
      tree.push(node);
    }
  }

  return tree;
};

const Category = mongoose.model('Category', CategorySchema);
export default Category;
