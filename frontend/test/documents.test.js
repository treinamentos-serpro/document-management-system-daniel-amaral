import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/documents.js';

test('lista documentos via /api com o identificador do usuário', async (t) => {
  const documents = [{ id: 'document-1', originalName: 'nota.txt' }];
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(documents));

  assert.deepEqual(await listDocuments('usuario-1'), documents);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/documents');
  assert.equal(options.headers['X-User-Id'], 'usuario-1');
});

test('envia o arquivo como multipart sem sobrescrever Content-Type', async (t) => {
  const file = new File(['documento'], 'nota.txt', { type: 'text/plain' });
  const document = { id: 'document-1', originalName: file.name };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => (
    Response.json(document, { status: 201 })
  ));

  assert.deepEqual(await uploadDocument('usuario-1', file), document);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/upload');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['X-User-Id'], 'usuario-1');
  assert.equal(new Headers(options.headers).has('Content-Type'), false);
  assert.ok(options.body instanceof FormData);
  assert.deepEqual([...options.body.keys()], ['file']);
  const uploadedFile = options.body.get('file');
  assert.equal(uploadedFile.name, file.name);
  assert.equal(await uploadedFile.text(), await file.text());
});

test('baixa conteúdo binário e codifica o identificador do documento', async (t) => {
  const content = new Uint8Array([0, 1, 127, 255]);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => (
    new Response(content, { headers: { 'Content-Type': 'application/octet-stream' } })
  ));

  const blob = await downloadDocument('usuario-1', 'id/com espaço');
  assert.ok(blob instanceof Blob);
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), content);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/documents/id%2Fcom%20espa%C3%A7o/download');
  assert.equal(options.headers['X-User-Id'], 'usuario-1');
});

test('propaga mensagens de erro do backend em todas as operações', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(
    { error: { message: 'Operação não permitida.' } },
    { status: 400 },
  ));

  const file = new File(['documento'], 'nota.txt');
  for (const operation of [
    () => listDocuments('usuario-1'),
    () => uploadDocument('usuario-1', file),
    () => downloadDocument('usuario-1', 'document-1'),
  ]) {
    await assert.rejects(operation, { message: 'Operação não permitida.' });
  }
});

test('informa falha HTTP mesmo quando a resposta não contém JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Bad Gateway', { status: 502 }));

  await assert.rejects(() => listDocuments('usuario-1'), {
    message: 'Não foi possível concluir a operação.',
  });
});

test('propaga falhas de rede', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Falha de rede.'); });

  await assert.rejects(() => listDocuments('usuario-1'), { message: 'Falha de rede.' });
});
