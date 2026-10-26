export default function DownloadButton({ document, downloadingId, onDownload }) {
  const isDownloading = downloadingId === document.id;

  return (
    <button
      className="text-button"
      type="button"
      disabled={Boolean(downloadingId)}
      aria-label={`Baixar ${document.originalName}`}
      aria-busy={isDownloading}
      onClick={() => onDownload(document)}
    >
      {isDownloading ? 'Baixando...' : 'Baixar'}
    </button>
  );
}
