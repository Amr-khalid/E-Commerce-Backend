import Joi from 'joi';

export const createProductSchema = Joi.object({
  name: Joi.string().trim().max(300).required(),
  description: Joi.string().trim().allow(''),
  shortDescription: Joi.string().trim().max(500).allow(''),
  sku: Joi.string().trim().uppercase().required(),
  brand: Joi.string().trim().allow('', null),
  price: Joi.number().min(0).required(),
  discountPrice: Joi.number().min(0).allow(null),
  cost: Joi.number().min(0).allow(null),
  taxRate: Joi.number().min(0).max(100).default(0),
  lowStockThreshold: Joi.number().min(0).default(5),
  categories: Joi.array().items(Joi.string().hex().length(24)),
  relatedProducts: Joi.array().items(Joi.string().hex().length(24)),
  attributes: Joi.array().items(
    Joi.object({
      key: Joi.string().required(),
      value: Joi.string().required(),
    }),
  ),
  videos: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      provider: Joi.string().valid('upload', 'youtube', 'vimeo').default('upload'),
    }),
  ),
  flags: Joi.object({
    featured: Joi.boolean(),
    newArrival: Joi.boolean(),
    bestSeller: Joi.boolean(),
    topPriority: Joi.boolean(),
  }),
  status: Joi.string().valid('draft', 'active', 'out_of_stock', 'archived'),
  isActive: Joi.boolean(),
  sortOrder: Joi.number().integer(),
  seo: Joi.object({
    title: Joi.string().allow(''),
    description: Joi.string().allow(''),
    keywords: Joi.array().items(Joi.string()),
  }),
});

export const updateProductSchema = createProductSchema.fork(
  ['name', 'sku', 'price'],
  (schema) => schema.optional(),
);

export const sortProductsSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().hex().length(24).required(),
        sortOrder: Joi.number().integer().required(),
      }),
    )
    .min(1)
    .required(),
});
