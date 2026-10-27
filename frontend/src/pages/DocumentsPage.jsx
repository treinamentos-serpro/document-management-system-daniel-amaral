import { useEffect, useRef, useState } from 'react';
import DocumentList from '../components/DocumentList.jsx';
import UploadComponent from '../components/UploadComponent.jsx';
import { downloadDocument, listDocuments, uploadDocument } from '../services/documents.js';
import './DocumentsPage.css';

const savedUserId = localStorage.getItem('dms-user-id') || 'usuario-1';

export default function DocumentsPage() {
  const [userIdDraft, setUserIdDraft] = useState(savedUserId);
  const [userId, setUserId] = useState(savedUserId);
  const activeUserId = useRef(savedUserId);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError('');
    listDocuments(userId)
      .then((result) => { if (isCurrent) setDocuments(result); })
      .catch((loadError) => { if (isCurrent) setError(loadError.message); })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [userId]);

  function handleUserSubmit(event) {
    event.preventDefault();
    const nextUserId = userIdDraft.trim();
    if (!nextUserId) {
      setError('Informe um identificador de usuário.');
      return;
    }
    localStorage.setItem('dms-user-id', nextUserId);
    if (nextUserId !== userId) {
      activeUserId.current = nextUserId;
      setDocuments([]);
      setIsLoading(true);
      setError('');
    }
    setUserId(nextUserId);
  }

  async function handleUpload(file) {
    const uploadUserId = userId;
    const document = await uploadDocument(uploadUserId, file);
    if (uploadUserId === activeUserId.current) {
      setDocuments((currentDocuments) => [document, ...currentDocuments]);
      setError('');
    }
  }

  async function handleDownload(document) {
    setDownloadingId(document.id);
    setError('');
    try {
      const blob = await downloadDocument(userId, document.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.originalName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setDownloadingId('');
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="DMS início">
          <span className="brand-stamp">D</span>
          <span>documentos<span className="wordmark-dot">.</span></span>
        </a>
        <form className="user-form" onSubmit={handleUserSubmit}>
          <label htmlFor="user-id">Usuário</label>
          <input
            id="user-id"
            value={userIdDraft}
            onChange={(event) => setUserIdDraft(event.target.value)}
            aria-label="Identificador do usuário"
          />
          <button type="submit" className="user-submit">Aplicar</button>
        </form>
      </header>

      <section className="page-heading">
        <div>
          <span className="eyebrow">ESPAÇO DE TRABALHO</span>
          <h1>Seus documentos<span className="heading-period">.</span></h1>
          <p>Um lugar simples para guardar e acessar seus arquivos.</p>
        </div>
        <div className="document-count" aria-live="polite">
          <strong>{documents.length.toString().padStart(2, '0')}</strong><span>arquivos</span>
        </div>
      </section>

      <UploadComponent onUpload={handleUpload} />

      <section className="library-section" aria-labelledby="library-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BIBLIOTECA</span>
            <h2 id="library-title">Arquivos recentes</h2>
          </div>
          <span className="user-indicator">{userId}</span>
        </div>
        {error && <p className="page-error" role="alert">{error}</p>}
        <DocumentList
          documents={documents}
          isLoading={isLoading}
          downloadingId={downloadingId}
          onDownload={handleDownload}
        />
      </section>

      <footer className="page-footer">
        <span>DMS <span className="footer-dot">/</span> armazenamento local</span>
        <span>Seus arquivos, organizados.</span>
      </footer>
    </main>
  );
}