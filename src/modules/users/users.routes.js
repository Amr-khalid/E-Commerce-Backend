import { Router } from 'express';
import Address from '../../models/Address.js';
import ApiResponse from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import asyncHandler from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.js';
import validate from '../../middleware/validate.js';
import Joi from 'joi';

const addressSchema = Joi.object({
  label: Joi.string().valid('home', 'work', 'other').default('home'),
  fullName: Joi.string().trim().required(),
  phone: Joi.string().trim().required(),
  country: Joi.string().trim().required(),
  city: Joi.string().trim().required(),
  area: Joi.string().trim().allow(''),
  street: Joi.string().trim().allow(''),
  building: Joi.string().trim().allow(''),
  apartment: Joi.string().trim().allow(''),
  postalCode: Joi.string().trim().allow(''),
  notes: Joi.string().trim().allow(''),
  isDefault: Joi.boolean().default(false),
});

const router = Router();

router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const addresses = await Address.find({ user: req.user._id })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
    ApiResponse.success(res, { data: addresses });
  }),
);

router.post('/',
  authenticate,
  validate(addressSchema),
  asyncHandler(async (req, res) => {
    req.body.user = req.user._id;
    const address = await Address.create(req.body);
    ApiResponse.created(res, { data: address });
  }),
);

router.patch('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!address) throw ApiError.notFound('Address not found');
    ApiResponse.success(res, { data: address });
  }),
);

router.delete('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!address) throw ApiError.notFound('Address not found');
    ApiResponse.success(res, { message: 'Address deleted' });
  }),
);

export default router;
