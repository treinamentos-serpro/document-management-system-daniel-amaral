const express = require('express');
const multer = require('multer');
const documentRoutes = require('./routes/document.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.use('/', documentRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Endpoint não encontrado.',
    },
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'O arquivo excede o tamanho máximo permitido.',
      },
    });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: {
        code: 'INVALID_UPLOAD',
        message: 'Não foi possível processar o arquivo enviado.',
      },
    });
  }

  console.error('Erro inesperado na API:', error);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocorreu um erro interno.',
    },
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
