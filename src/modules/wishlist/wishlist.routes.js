import { Router } from 'express';
import Wishlist from '../../models/Wishlist.js';
import ApiResponse from '../../utils/ApiResponse.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    let wishlist = await Wishlist.findOne({ user: req.user._id })
      .populate('products', 'name slug price discountPrice images avgRating stock isActive');

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }

    // Filter out inactive products
    if (wishlist.products) {
      wishlist.products = wishlist.products.filter((p) => p.isActive);
    }

    ApiResponse.success(res, { data: wishlist });
  }),
);

router.post('/:productId',
  authenticate,
  asyncHandler(async (req, res) => {
    let wishlist = await Wishlist.findOne({ user: req.user._id });
    if (!wishlist) {
      wishlist = new Wishlist({ user: req.user._id, products: [] });
    }

    const exists = wishlist.products.some(
      (p) => p.toString() === req.params.productId,
    );
    if (!exists) {
      wishlist.products.push(req.params.productId);
      await wishlist.save();
    }

    ApiResponse.success(res, { message: 'Added to wishlist' });
  }),
);

router.delete('/:productId',
  authenticate,
  asyncHandler(async (req, res) => {
    await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { products: req.params.productId } },
    );
    ApiResponse.success(res, { message: 'Removed from wishlist' });
  }),
);

export default router;
