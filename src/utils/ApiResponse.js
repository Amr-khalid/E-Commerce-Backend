/**
 * Standardized API response wrapper.
 * Ensures consistent response format across all endpoints.
 */
class ApiResponse {
  /**
   * Success response
   * @param {object} res Express response
   * @param {object} options
   * @param {number} [options.statusCode=200]
   * @param {string} [options.message='Success']
   * @param {*} [options.data]
   * @param {object} [options.meta] Pagination, counts, etc.
   */
  static success(res, { statusCode = 200, message = 'Success', data = null, meta = null } = {}) {
    const response = {
      success: true,
      message,
    };

    if (data !== null) response.data = data;
    if (meta !== null) response.meta = meta;

    return res.status(statusCode).json(response);
  }

  /**
   * Created response (201)
   */
  static created(res, { message = 'Created successfully', data = null } = {}) {
    return ApiResponse.success(res, { statusCode: 201, message, data });
  }

  /**
   * No content response (204)
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Paginated response
   * @param {object} res Express response
   * @param {object} options
   * @param {Array} options.data
   * @param {object} options.pagination
   * @param {string} [options.message='Success']
   */
  static paginated(res, { data, pagination, message = 'Success' } = {}) {
    return res.status(200).json({
      success: true,
      message,
      data,
      meta: {
        pagination,
      },
    });
  }

  /**
   * Error response
   * @param {object} res Express response
   * @param {object} options
   * @param {number} [options.statusCode=500]
   * @param {string} [options.message='Error']
   * @param {string} [options.code] Machine-readable error code
   * @param {Array} [options.errors] Validation errors
   */
  static error(res, { statusCode = 500, message = 'Error', code = null, errors = [] } = {}) {
    const response = {
      success: false,
      message,
    };

    if (code) response.code = code;
    if (errors.length > 0) response.errors = errors;

    return res.status(statusCode).json(response);
  }
}

export default ApiResponse;
