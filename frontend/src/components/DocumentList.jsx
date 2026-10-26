import DownloadButton from './DownloadButton.jsx';

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function DocumentList({ documents, isLoading, downloadingId, onDownload }) {
  if (isLoading) return <div className="list-state">Carregando documentos...</div>;
  if (documents.length === 0) {
    return (
      <div className="list-state empty-state">
        <span className="empty-mark" aria-hidden="true">+</span>
        <h3>Nenhum documento por aqui</h3>
        <p>Os arquivos enviados para este usuário aparecerão nesta lista.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Documento</th><th>Tamanho</th><th>Enviado em</th><th><span className="visually-hidden">Ação</span></th></tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>
                <div className="document-name">
                  <span className="file-mark" aria-hidden="true">DOC</span>
                  <span title={document.originalName}>{document.originalName}</span>
                </div>
              </td>
              <td>{formatSize(document.size)}</td>
              <td>{formatDate(document.uploadedAt)}</td>
              <td className="action-cell">
                <DownloadButton
                  document={document}
                  downloadingId={downloadingId}
                  onDownload={onDownload}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}