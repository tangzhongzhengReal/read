# Read

单人文档学习笔记（MarginNote 思路，自有产品）。Phase 0 提供应用壳、JSONL 存储和文档元数据 API。PDF / EPUB 放在 `uploads/`，结构化数据追加到 `data/<workspaceId>/*.jsonl`。没有数据库。

推送到 `main` 后，GitHub Actions 把静态应用壳发布到 [https://read.coming.js.cn](https://read.coming.js.cn) 的 `/var/www/read`。nginx 与 TLS 在服务器上单独配置。线上静态站点不运行 `POST /api/documents`；本地和 CI 用 `next start`。

## Local checks

```bash
npm ci
npm run lint
npm test
npm run build
npx playwright install chromium
npm run e2e
```

`npm run e2e` expects the production build from `npm run build`. Playwright opens `/` and checks the library shell.

JSONL files for local API runs go to `./data` unless `READ_DATA_DIR` is set. Tests use a temporary directory.

## Deploy secrets

Never commit these repository secrets:

- `SSH_HOST`
- `SSH_PORT`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
