# Especificação - Document Management System

## 1. Objetivo

Permitir que usuários enviem, listem e baixem seus documentos, com arquivos armazenados no filesystem local e metadados mantidos em memória.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem e download dos documentos associados ao identificador do usuário.
- Interface React para enviar, listar e baixar arquivos.
- Armazenamento de arquivos em `backend/storage` usando Multer com `diskStorage`.
- Metadados mantidos em memória durante a execução do backend.

### Fora do escopo

- Autenticação, gestão de contas e autorização baseada em credenciais.
- Armazenamento externo, versionamento, exclusão e compartilhamento.
- Persistência de metadados após reinicialização do processo.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O usuário pode enviar um arquivo usando `multipart/form-data`, no campo `file`. |
| RF-02 | O sistema associa o documento ao valor de `X-User-Id`. |
| RF-03 | O sistema retorna os metadados do documento após o upload bem-sucedido. |
| RF-04 | O usuário pode listar somente os documentos associados ao seu identificador. |
| RF-05 | O usuário pode baixar um documento pelo identificador quando ele lhe pertence. |
| RF-06 | O sistema rejeita requisições sem usuário, upload sem arquivo e arquivos acima do limite configurado. |
| RF-07 | O nome original é preservado para apresentação e download, mas não é usado como nome físico do arquivo. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados exclusivamente no filesystem local com Multer `diskStorage`. |
| RNF-02 | Os metadados ficam em memória e são perdidos ao reiniciar o processo. |
| RNF-03 | Porta, diretório de armazenamento e tamanho máximo são configuráveis por ambiente. |
| RNF-04 | O caminho físico e o nome interno do arquivo não são expostos nas respostas da API. |
| RNF-05 | `X-User-Id` identifica a associação funcional, mas não autentica nem comprova a identidade do usuário. |
| RNF-06 | Erros HTTP usam um formato JSON estável e não expõem detalhes internos do servidor. |

Configuração: `PORT` (padrão `3000`), `STORAGE_DIR` (padrão `backend/storage`) e `MAX_FILE_SIZE_BYTES` (padrão `10485760`, equivalente a 10 MiB).
O limite de tamanho é inclusivo: um arquivo com exatamente `MAX_FILE_SIZE_BYTES`
bytes é aceito; a partir de um byte excedente, o upload é rejeitado.

## 5. Modelo de dados

### Documento

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string | Identificador único gerado pelo sistema. |
| `originalName` | string | Nome original do arquivo enviado. |
| `size` | number | Tamanho em bytes. |
| `uploadedAt` | string | Data/hora do upload em ISO 8601. |
| `owner` | string | Identificador recebido em `X-User-Id`. |
| `mimeType` | string | Tipo MIME informado no upload. |
| `storageName` | string | Identificador interno do arquivo no filesystem; nunca é retornado pela API. |

## 6. Contratos de API

As rotas do backend não incluem `/api`; no desenvolvimento, o proxy do Vite encaminha `/api` e remove esse prefixo. Os endpoints de documentos exigem `X-User-Id` não vazio.

### `POST /upload`

- Entrada: `multipart/form-data` com o arquivo no campo `file`.
- Sucesso: `201 Created`, com `id`, `originalName`, `size`, `uploadedAt`, `owner` e `mimeType`.
- Erros: `400` para usuário/arquivo ausente ou upload inválido; `413` quando excede o limite.

### `GET /documents`

- Sucesso: `200 OK`, com lista dos metadados públicos pertencentes ao usuário.
- Sem documentos: lista vazia.

### `GET /documents/:id/download`

- Sucesso: `200 OK`, conteúdo binário e nome original como nome de download.
- Erro: `404 Not Found` se o documento não existir ou não pertencer ao usuário.
- Se o arquivo tiver sido removido do disco, o download também retorna `404`.

Falhas inesperadas de leitura ou gravação retornam `500` com código `INTERNAL_ERROR`
e são registradas no servidor, sem expor caminhos físicos na resposta.

Formato de erro: `{ "error": { "code": "FILE_REQUIRED", "message": "Envie um arquivo no campo file." } }`. Códigos usados incluem `USER_ID_REQUIRED`, `FILE_REQUIRED`, `FILE_TOO_LARGE`, `INVALID_UPLOAD`, `DOCUMENT_NOT_FOUND` e `INTERNAL_ERROR`.

## 7. Decisões arquiteturais

- Backend CommonJS organizado em `routes -> controllers -> services -> repositories`.
- Rotas configuram HTTP e Multer; controllers validam entrada e formatam respostas; services aplicam regras de negócio; repositories encapsulam metadados em memória.
- Frontend React usa `fetch` pelo prefixo `/api` configurado no proxy do Vite.
- `App` monta `DocumentsPage`, que coordena o usuário selecionado, a lista e as operações. `UploadComponent` trata o formulário de envio; `DocumentList` apresenta os metadados e reutiliza `DownloadButton` para cada arquivo.
- O cliente `frontend/src/services/documents.js` centraliza as chamadas com `X-User-Id`, o envio de `FormData`, o recebimento do download como `Blob` e os erros HTTP. A página inicia o download com o nome original e libera a URL temporária.
- Arquivos locais e metadados em memória não têm garantia de consistência após reinicialização: um arquivo pode permanecer no disco sem metadado correspondente.
- O identificador de usuário é uma convenção para esta versão e não deve ser considerado controle de acesso de produção.

## 8. Plano de execução

1. Definir escopo, requisitos, modelo de dados, contratos HTTP e decisões arquiteturais.
2. Implementar persistência dos arquivos locais com Multer e metadados em memória.
3. Implementar upload, listagem por usuário e download com verificação de propriedade.
4. Integrar a interface para seleção de usuário, upload, listagem e download via API.
5. Validar os fluxos e erros com testes automatizados de backend, testes do cliente de API (`cd frontend && npm test`) e build de produção do frontend (`cd frontend && npm run build`).