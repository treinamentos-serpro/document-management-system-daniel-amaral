const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const storageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-backend-test-'));
process.env.STORAGE_DIR = storageDirectory;

const app = require('../src/app');

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('faz upload, lista e baixa um documento', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob(['conteúdo do documento'], { type: 'text/plain' }),
      'documento.txt',
    );

    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'usuario-teste' },
      body: formData,
    });
    assert.equal(uploadResponse.status, 201);

    const document = await uploadResponse.json();
    assert.equal(document.originalName, 'documento.txt');
    assert.equal(document.size, Buffer.byteLength('conteúdo do documento'));
    assert.equal(document.owner, 'usuario-teste');

    const listResponse = await fetch(`${baseUrl}/documents`, {
      headers: { 'X-User-Id': 'usuario-teste' },
    });
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), [document]);

    const otherUserListResponse = await fetch(`${baseUrl}/documents`, {
      headers: { 'X-User-Id': 'outro-usuario' },
    });
    assert.deepEqual(await otherUserListResponse.json(), []);

    const downloadResponse = await fetch(
      `${baseUrl}/documents/${document.id}/download`,
      { headers: { 'X-User-Id': 'usuario-teste' } },
    );
    assert.equal(downloadResponse.status, 200);
    assert.equal(await downloadResponse.text(), 'conteúdo do documento');

    const otherUserDownloadResponse = await fetch(
      `${baseUrl}/documents/${document.id}/download`,
      { headers: { 'X-User-Id': 'outro-usuario' } },
    );
    assert.equal(otherUserDownloadResponse.status, 404);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    fs.rmSync(storageDirectory, { recursive: true, force: true });
  }
});
