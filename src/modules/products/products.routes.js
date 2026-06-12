import { Router } from 'express';
import * as productsCtrl from './products.controller.js';
import validate from '../../middleware/validate.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { authorizePermission } from '../../middleware/rbac.js';
import { uploadImages as multerUpload } from '../../services/UploadService.js';
import { createProductSchema, updateProductSchema, sortProductsSchema } from './products.validation.js';
import { PERMISSIONS } from '../../config/constants.js';

const router = Router();

// Public
router.get('/', optionalAuth, productsCtrl.list);
router.get('/:slug', productsCtrl.getBySlug);
router.get('/:id/related', productsCtrl.getRelated);

// Admin / Manager
router.post('/',
  authenticate,
  authorizePermission(PERMISSIONS.PRODUCTS_CREATE),
  validate(createProductSchema),
  productsCtrl.create,
);

router.patch('/:id',
  authenticate,
  authorizePermission(PERMISSIONS.PRODUCTS_UPDATE),
  validate(updateProductSchema),
  productsCtrl.update,
);

router.delete('/:id',
  authenticate,
  authorizePermission(PERMISSIONS.PRODUCTS_DELETE),
  productsCtrl.remove,
);

router.post('/:id/images',
  authenticate,
  authorizePermission(PERMISSIONS.PRODUCTS_UPDATE),
  multerUpload.array('images', 10),
  productsCtrl.uploadImages,
);

router.patch('/sort/order',
  authenticate,
  authorizePermission(PERMISSIONS.PRODUCTS_UPDATE),
  validate(sortProductsSchema),
  productsCtrl.updateSortOrder,
);

export default router;
