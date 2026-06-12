import ApiError from '../utils/ApiError.js';

/**
 * Joi validation middleware factory.
 * Validates request body, query, or params against a Joi schema.
 *
 * @param {import('joi').ObjectSchema} schema Joi schema
 * @param {string} [source='body'] Request property to validate: 'body', 'query', 'params'
 * @returns {Function} Express middleware
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,     // collect all errors
      stripUnknown: true,    // remove unknown fields
      convert: true,         // type coercion
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
      }));

      return next(ApiError.badRequest('Validation failed', errors));
    }

    // Replace request data with validated/sanitized values
    req[source] = value;
    next();
  };
};

export default validate;
