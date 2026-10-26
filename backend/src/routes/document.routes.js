const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const documentController = require('../controllers/document.controller');

const router = express.Router();
const storageDirectory = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, '../../storage'),
);
const maxFileSizeBytes = Math.max(
  1,
  Number.parseInt(process.env.MAX_FILE_SIZE_BYTES, 10) || 10485760,
);

const storage = multer.diskStorage({
  destination(req, file, callback) {
    fs.mkdir(storageDirectory, { recursive: true }, (error) => {
      callback(error, storageDirectory);
    });
  },
  filename(req, file, callback) {
    callback(null, crypto.randomUUID());
  },
});

const upload = multer({
  storage,
  // O parser rejeita ao atingir o limite, inclusive; permita o tamanho máximo exato.
  limits: { fileSize: maxFileSizeBytes + 1, files: 1 },
});

router.post(
  '/upload',
  documentController.requireUserId,
  upload.single('file'),
  documentController.upload,
);
router.get('/documents', documentController.requireUserId, documentController.list);
router.get(
  '/documents/:id/download',
  documentController.requireUserId,
  documentController.download,
);

module.exports = router;