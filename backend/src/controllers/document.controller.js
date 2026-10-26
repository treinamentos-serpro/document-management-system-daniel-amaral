const documentService = require('../services/document.service');

function requireUserId(req, res, next) {
  const userId = req.get('X-User-Id')?.trim();
  if (!userId) {
    return res.status(400).json({
      error: {
        code: 'USER_ID_REQUIRED',
        message: 'Informe o identificador do usuário no cabeçalho X-User-Id.',
      },
    });
  }

  req.userId = userId;
  return next();
}

async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({
      error: {
        code: 'FILE_REQUIRED',
        message: 'Envie um arquivo no campo file.',
      },
    });
  }

  const document = await documentService.createDocument(req.file, req.userId);
  return res.status(201).json(document);
}

function list(req, res) {
  return res.json(documentService.listDocuments(req.userId));
}

function download(req, res, next) {
  const document = documentService.getDocumentForOwner(req.params.id, req.userId);
  if (!document) {
    return res.status(404).json({
      error: {
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Documento não encontrado.',
      },
    });
  }

  return res.download(
    document.storagePath,
    document.originalName,
    (error) => {
      if (!error) {
        return;
      }

      if (error.code === 'ENOENT' && !res.headersSent) {
        return res.status(404).json({
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Documento não encontrado.',
          },
        });
      }

      return next(error);
    },
  );
}

module.exports = { requireUserId, upload, list, download };