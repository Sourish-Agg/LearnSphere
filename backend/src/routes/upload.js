const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const AuthMiddleware = require('../middleware/auth');
const ErrorHandler = require('../middleware/errorHandler');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
fs.ensureDirSync(uploadDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subdirectories based on file type
    const fileType = file.mimetype.split('/')[0];
    let subDir = 'others';
    
    if (fileType === 'video') {
      subDir = 'videos';
    } else if (fileType === 'application' && file.mimetype.includes('pdf')) {
      subDir = 'pdfs';
    } else if (fileType === 'image') {
      subDir = 'images';
    }
    
    const targetDir = path.join(uploadDir, subDir);
    fs.ensureDirSync(targetDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + uuidv4();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// File filter to validate file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/webm',
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
    files: 5 // Max 5 files at once
  }
});

// Upload single file
router.post('/single',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  upload.single('file'),
  ErrorHandler.asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ 
        detail: 'No file uploaded' 
      });
    }

    const fileInfo = {
      id: uuidv4(),
      original_name: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploaded_by: req.user.id,
      uploaded_at: new Date(),
      url: `/api/uploads/serve/${req.file.filename}`
    };

    logger.info(`File uploaded: ${req.file.originalname} by ${req.user.email}`);

    res.status(201).json({
      message: 'File uploaded successfully',
      file: fileInfo
    });
  })
);

// Upload multiple files
router.post('/multiple',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  upload.array('files', 5),
  ErrorHandler.asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        detail: 'No files uploaded' 
      });
    }

    const filesInfo = req.files.map(file => ({
      id: uuidv4(),
      original_name: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      uploaded_by: req.user.id,
      uploaded_at: new Date(),
      url: `/api/uploads/serve/${file.filename}`
    }));

    logger.info(`${req.files.length} files uploaded by ${req.user.email}`);

    res.status(201).json({
      message: 'Files uploaded successfully',
      files: filesInfo
    });
  })
);

// Serve uploaded files
router.get('/serve/:filename',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const { filename } = req.params;
    
    // Search for file in all subdirectories
    const subDirs = ['videos', 'pdfs', 'images', 'others'];
    let filePath = null;
    
    for (const subDir of subDirs) {
      const testPath = path.join(uploadDir, subDir, filename);
      if (await fs.pathExists(testPath)) {
        filePath = testPath;
        break;
      }
    }
    
    if (!filePath) {
      return res.status(404).json({ 
        detail: 'File not found' 
      });
    }

    // Set appropriate headers based on file type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (['.mp4', '.avi', '.mov', '.wmv', '.webm'].includes(ext)) {
      contentType = `video/${ext.substring(1)}`;
    } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      contentType = `image/${ext.substring(1)}`;
    }

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=31536000'
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  })
);

// Get uploaded file info
router.get('/info/:filename',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const { filename } = req.params;
    
    // Search for file in all subdirectories
    const subDirs = ['videos', 'pdfs', 'images', 'others'];
    let filePath = null;
    let fileType = null;
    
    for (const subDir of subDirs) {
      const testPath = path.join(uploadDir, subDir, filename);
      if (await fs.pathExists(testPath)) {
        filePath = testPath;
        fileType = subDir;
        break;
      }
    }
    
    if (!filePath) {
      return res.status(404).json({ 
        detail: 'File not found' 
      });
    }

    const stats = await fs.stat(filePath);
    const fileInfo = {
      filename,
      size: stats.size,
      type: fileType,
      created_at: stats.birthtime,
      modified_at: stats.mtime,
      url: `/api/uploads/serve/${filename}`
    };

    res.json(fileInfo);
  })
);

// Delete uploaded file
router.delete('/:filename',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { filename } = req.params;
    
    // Search for file in all subdirectories
    const subDirs = ['videos', 'pdfs', 'images', 'others'];
    let filePath = null;
    
    for (const subDir of subDirs) {
      const testPath = path.join(uploadDir, subDir, filename);
      if (await fs.pathExists(testPath)) {
        filePath = testPath;
        break;
      }
    }
    
    if (!filePath) {
      return res.status(404).json({ 
        detail: 'File not found' 
      });
    }

    await fs.remove(filePath);
    
    logger.info(`File deleted: ${filename} by ${req.user.email}`);

    res.json({ 
      message: 'File deleted successfully' 
    });
  })
);

// Get storage statistics
router.get('/stats',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const subDirs = ['videos', 'pdfs', 'images', 'others'];
    const stats = {};
    
    for (const subDir of subDirs) {
      const dirPath = path.join(uploadDir, subDir);
      
      if (await fs.pathExists(dirPath)) {
        const files = await fs.readdir(dirPath);
        let totalSize = 0;
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const fileStat = await fs.stat(filePath);
          totalSize += fileStat.size;
        }
        
        stats[subDir] = {
          file_count: files.length,
          total_size: totalSize,
          size_formatted: formatBytes(totalSize)
        };
      } else {
        stats[subDir] = {
          file_count: 0,
          total_size: 0,
          size_formatted: '0 B'
        };
      }
    }

    res.json(stats);
  })
);

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router;