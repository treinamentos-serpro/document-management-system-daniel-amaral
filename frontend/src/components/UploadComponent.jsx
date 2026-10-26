import { useState } from 'react';

export default function UploadComponent({ onUpload }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.namedItem('file').files[0];
    if (!file) {
      setError('Escolha um arquivo para enviar.');
      return;
    }

    setError('');
    setIsUploading(true);
    try {
      await onUpload(file);
      form.reset();
      setFileName('');
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="upload-panel" onSubmit={handleSubmit}>
      <div className="upload-copy">
        <span className="eyebrow">ARQUIVO LOCAL</span>
        <h2>Adicionar documento</h2>
        <p>Selecione um arquivo para incluir no seu acervo.</p>
      </div>
      <div className="upload-controls">
        <label className="file-picker">
          <span>{fileName || 'Escolher arquivo'}</span>
          <input
            name="file"
            type="file"
            disabled={isUploading}
            aria-label="Arquivo para upload"
            onChange={(event) => setFileName(event.target.files[0]?.name || '')}
          />
        </label>
        <button className="primary-button" type="submit" disabled={isUploading}>
          {isUploading ? 'Enviando...' : 'Enviar documento'}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}