const crypto = require('node:crypto');
const path = require('node:path');
const documentRepository = require('../repositories/document.repository');

const storageDirectory = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, '../../storage'),
);

function toPublicDocument(document) {
  const { storageName, ...publicDocument } = document;
  return publicDocument;
}

async function createDocument(file, owner) {
  const document = {
    id: crypto.randomUUID(),
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    storageName: file.filename,
    mimeType: file.mimetype,
  };

  documentRepository.save(document);
  return toPublicDocument(document);
}

function listDocuments(owner) {
  return documentRepository.findByOwner(owner).map(toPublicDocument);
}

function getDocumentForOwner(id, owner) {
  const document = documentRepository.findById(id);
  if (!document || document.owner !== owner) {
    return null;
  }

  return {
    ...toPublicDocument(document),
    storagePath: path.join(storageDirectory, document.storageName),
  };
}

module.exports = { createDocument, listDocuments, getDocumentForOwner };