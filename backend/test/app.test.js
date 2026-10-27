const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const storageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-test-'));
process.env.STORAGE_DIR = storageDirectory;
process.env.MAX_FILE_SIZE_BYTES = '1024';
const app = require('../src/app');
let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await once(server, 'close');
  fs.rmSync(storageDirectory, { recursive: true, force: true });
});

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('faz upload, lista e baixa um documento do próprio usuário', async () => {
  const form = new FormData();
  form.append('file', new Blob(['conteúdo de teste'], { type: 'text/plain' }), 'nota.txt');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'usuario-teste' },
    body: form,
  });
  assert.equal(uploadResponse.status, 201);

  const uploadedDocument = await uploadResponse.json();
  assert.equal(uploadedDocument.originalName, 'nota.txt');
  assert.equal(uploadedDocument.owner, 'usuario-teste');
  assert.equal(uploadedDocument.size, Buffer.byteLength('conteúdo de teste'));
  assert.deepEqual(Object.keys(uploadedDocument).sort(), [
    'id', 'mimeType', 'originalName', 'owner', 'size', 'uploadedAt',
  ]);
  assert.equal(uploadedDocument.mimeType, 'text/plain');
  assert.ok(Number.isFinite(Date.parse(uploadedDocument.uploadedAt)));

  const storedFiles = fs.readdirSync(storageDirectory);
  assert.equal(storedFiles.length, 1);
  assert.notEqual(storedFiles[0], uploadedDocument.originalName);
  assert.equal(
    fs.readFileSync(path.join(storageDirectory, storedFiles[0]), 'utf8'),
    'conteúdo de teste',
  );

  const listResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'usuario-teste' },
  });
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), [uploadedDocument]);

  const downloadResponse = await fetch(
    `${baseUrl}/documents/${uploadedDocument.id}/download`,
    { headers: { 'X-User-Id': 'usuario-teste' } },
  );
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /attachment; filename="nota.txt"/);
  assert.equal(await downloadResponse.text(), 'conteúdo de teste');

  const otherUserList = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'outro-usuario' },
  });
  assert.deepEqual(await otherUserList.json(), []);

  const otherUserDownload = await fetch(
    `${baseUrl}/documents/${uploadedDocument.id}/download`,
    { headers: { 'X-User-Id': 'outro-usuario' } },
  );
  assert.equal(otherUserDownload.status, 404);
});

test('valida identificador do usuário e arquivo obrigatório', async () => {
  const missingUser = await fetch(`${baseUrl}/documents`);
  assert.equal(missingUser.status, 400);
  assert.equal((await missingUser.json()).error.code, 'USER_ID_REQUIRED');

  const missingFile = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'usuario-teste' },
  });
  assert.equal(missingFile.status, 400);
  assert.equal((await missingFile.json()).error.code, 'FILE_REQUIRED');
});

test('rejeita arquivos acima do limite configurado', async () => {
  const filesBefore = fs.readdirSync(storageDirectory);
  for (const size of [1025, 2048]) {
    const form = new FormData();
    form.append('file', new Blob(['x'.repeat(size)]), 'grande.txt');

    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'usuario-teste' },
      body: form,
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'FILE_TOO_LARGE');
    assert.deepEqual(fs.readdirSync(storageDirectory), filesBefore);
  }
});

test('aceita arquivo no limite e preserva bytes binários e nomes repetidos', async () => {
  const content = Buffer.alloc(1024);
  for (let index = 0; index < content.length; index += 1) {
    content[index] = index % 256;
  }

  const documents = [];
  for (let index = 0; index < 2; index += 1) {
    const form = new FormData();
    form.append('file', new Blob([content]), 'repetido.bin');
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'usuario-binario' },
      body: form,
    });
    assert.equal(response.status, 201);
    documents.push(await response.json());
  }
  assert.notEqual(documents[0].id, documents[1].id);

  for (const document of documents) {
    assert.equal(document.size, 1024);
    const response = await fetch(`${baseUrl}/documents/${document.id}/download`, {
      headers: { 'X-User-Id': 'usuario-binario' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), content);
  }
});

test('rejeita campo inesperado e múltiplos arquivos sem deixar arquivos no disco', async () => {
  for (const fields of [['document'], ['file', 'file']]) {
    const filesBefore = fs.readdirSync(storageDirectory);
    const form = new FormData();
    for (const field of fields) {
      form.append(field, new Blob(['teste']), 'nota.txt');
    }
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'upload-invalido' },
      body: form,
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_UPLOAD');
    assert.deepEqual(fs.readdirSync(storageDirectory), filesBefore);
  }

  const filesBefore = fs.readdirSync(storageDirectory);
  const form = new FormData();
  form.append('file', new Blob(['teste']), 'nota.txt');
  form.append('metadata', 'valor extra');
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'upload-invalido' },
    body: form,
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_UPLOAD');
  assert.deepEqual(fs.readdirSync(storageDirectory), filesBefore);
});

test('exige usuário em todas as rotas de documentos antes de gravar uploads', async () => {
  const filesBefore = fs.readdirSync(storageDirectory);
  for (const headers of [{}, { 'X-User-Id': '   ' }]) {
    const form = new FormData();
    form.append('file', new Blob(['teste']), 'nota.txt');
    for (const [route, options] of [
      ['/upload', { method: 'POST', body: form }],
      ['/documents', {}],
      ['/documents/inexistente/download', {}],
    ]) {
      const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'USER_ID_REQUIRED');
    }
  }
  assert.deepEqual(fs.readdirSync(storageDirectory), filesBefore);
});

test('retorna 404 para documento inexistente ou arquivo removido do disco', async () => {
  const headers = { 'X-User-Id': 'arquivo-removido' };
  const unknownResponse = await fetch(`${baseUrl}/documents/inexistente/download`, { headers });
  assert.equal(unknownResponse.status, 404);
  assert.equal((await unknownResponse.json()).error.code, 'DOCUMENT_NOT_FOUND');

  const filesBefore = new Set(fs.readdirSync(storageDirectory));
  const form = new FormData();
  form.append('file', new Blob(['teste']), 'removido.txt');
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST', headers, body: form,
  });
  assert.equal(uploadResponse.status, 201);
  const document = await uploadResponse.json();
  const storedFile = fs.readdirSync(storageDirectory).find((name) => !filesBefore.has(name));
  assert.ok(storedFile);
  fs.unlinkSync(path.join(storageDirectory, storedFile));

  const response = await fetch(`${baseUrl}/documents/${document.id}/download`, { headers });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('trata falha de armazenamento como erro interno, sem publicar metadados', async (t) => {
  const storageError = Object.assign(new Error('Falha de armazenamento simulada'), {
    code: 'ENOENT',
  });
  t.mock.method(fs, 'mkdir', (directory, options, callback) => callback(storageError));
  const errorLog = t.mock.method(console, 'error', () => {});
  const form = new FormData();
  form.append('file', new Blob(['teste']), 'falha.txt');
  const headers = { 'X-User-Id': 'falha-armazenamento' };
  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST', headers, body: form,
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno.' },
  });
  assert.equal(errorLog.mock.callCount(), 1);
  assert.equal(errorLog.mock.calls[0].arguments[1], storageError);
  const listResponse = await fetch(`${baseUrl}/documents`, { headers });
  assert.deepEqual(await listResponse.json(), []);
});

test('preserva health check e retorna erro JSON para rota desconhecida', async () => {
  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });

  const response = await fetch(`${baseUrl}/inexistente`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'ROUTE_NOT_FOUND');
});
