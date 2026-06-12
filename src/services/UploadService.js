import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';

// Ensure upload directory exists
const ensureDir = async (dir) => {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

// ─── Multer Storage Configuration ─────────────────────
const storage = multer.memoryStorage(); // process in memory for Sharp

// ─── File Filter ──────────────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, GIF`), false);
  }
};

const videoFilter = (req, file, cb) => {
  const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest(`Invalid video type: ${file.mimetype}`), false);
  }
};

const anyFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest(`File type not allowed: ${file.mimetype}`), false);
  }
};

// ─── Multer Upload Instances ──────────────────────────
export const uploadImages = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFiles,
  },
});

export const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for video
    files: 1,
  },
});

export const uploadAttachments = multer({
  storage,
  fileFilter: anyFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 5,
  },
});

/**
 * Upload Service — processes and stores uploaded files.
 */
class UploadService {
  /**
   * Process and save uploaded images with optimization.
   * @param {Array} files Multer file objects
   * @param {Object} [options]
   * @param {string} [options.subfolder='products'] Upload subfolder
   * @param {number} [options.maxWidth=1200] Max image width
   * @param {number} [options.quality=80] JPEG/WebP quality
   * @returns {Array<{url: string, alt: string}>} Saved file info
   */
  static async processImages(files, options = {}) {
    const {
      subfolder = 'products',
      maxWidth = 1200,
      quality = 80,
    } = options;

    const uploadDir = path.join(config.upload.dir, subfolder);
    await ensureDir(uploadDir);

    const results = [];

    for (const file of files) {
      try {
        const filename = `${uuidv4()}.webp`;
        const filepath = path.join(uploadDir, filename);

        // Process with Sharp: resize + convert to WebP + optimize
        await sharp(file.buffer)
          .resize(maxWidth, null, {
            withoutEnlargement: true,
            fit: 'inside',
          })
          .webp({ quality })
          .toFile(filepath);

        // Also create thumbnail
        const thumbFilename = `thumb_${filename}`;
        const thumbPath = path.join(uploadDir, thumbFilename);

        await sharp(file.buffer)
          .resize(300, 300, {
            fit: 'cover',
            position: 'centre',
          })
          .webp({ quality: 70 })
          .toFile(thumbPath);

        results.push({
          url: `/${subfolder}/${filename}`,
          thumbnail: `/${subfolder}/${thumbFilename}`,
          alt: file.originalname.replace(/\.[^.]+$/, ''),
          isMain: false,
          sortOrder: results.length,
        });

        logger.debug(`Image processed: ${filename}`);
      } catch (error) {
        logger.error(`Failed to process image ${file.originalname}:`, error.message);
        throw ApiError.internal(`Failed to process image: ${file.originalname}`);
      }
    }

    return results;
  }

  /**
   * Save a video file.
   * @param {Object} file Multer file object
   * @param {string} [subfolder='videos']
   * @returns {Object} { url, provider }
   */
  static async processVideo(file, subfolder = 'videos') {
    const uploadDir = path.join(config.upload.dir, subfolder);
    await ensureDir(uploadDir);

    const ext = path.extname(file.originalname) || '.mp4';
    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    await fs.writeFile(filepath, file.buffer);

    return {
      url: `/${subfolder}/${filename}`,
      provider: 'upload',
    };
  }

  /**
   * Save attachment files (for support tickets, review images).
   * @param {Array} files Multer file objects
   * @param {string} [subfolder='attachments']
   * @returns {string[]} Array of URLs
   */
  static async processAttachments(files, subfolder = 'attachments') {
    const uploadDir = path.join(config.upload.dir, subfolder);
    await ensureDir(uploadDir);

    const urls = [];

    for (const file of files) {
      const ext = path.extname(file.originalname) || '';
      const filename = `${uuidv4()}${ext}`;
      const filepath = path.join(uploadDir, filename);

      // If it's an image, optimize it
      if (file.mimetype.startsWith('image/')) {
        await sharp(file.buffer)
          .resize(1200, null, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(filepath.replace(ext, '.webp'));

        urls.push(`/${subfolder}/${filename.replace(ext, '.webp')}`);
      } else {
        await fs.writeFile(filepath, file.buffer);
        urls.push(`/${subfolder}/${filename}`);
      }
    }

    return urls;
  }

  /**
   * Delete a file from storage.
   * @param {string} fileUrl Relative file URL
   */
  static async deleteFile(fileUrl) {
    try {
      const filepath = path.join(config.upload.dir, fileUrl.replace(/^\//, ''));
      await fs.unlink(filepath);
      logger.debug(`File deleted: ${fileUrl}`);
    } catch (error) {
      logger.warn(`Failed to delete file ${fileUrl}:`, error.message);
    }
  }
}

export default UploadService;
