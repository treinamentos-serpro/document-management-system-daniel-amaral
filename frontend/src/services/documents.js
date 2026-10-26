async function request(path, userId, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { ...options.headers, 'X-User-Id': userId },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || 'Não foi possível concluir a operação.');
  }
  return response;
}

export async function listDocuments(userId) {
  return (await request('/documents', userId)).json();
}

export async function uploadDocument(userId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return (await request('/upload', userId, { method: 'POST', body: formData })).json();
}

export async function downloadDocument(userId, documentId) {
  const response = await request(
    `/documents/${encodeURIComponent(documentId)}/download`,
    userId,
  );
  return response.blob();
}