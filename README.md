# Read

单人文档学习笔记（MarginNote 思路，自有产品）。Phase 0 提供应用壳、JSONL 存储和文档元数据 API。

推送到 `main` 后，GitHub Actions 把静态站点发布到 [https://read.coming.js.cn](https://read.coming.js.cn) 的 `/var/www/read`。nginx 与 TLS 在服务器上单独配置。动态 API 需要 `next start`，当前静态发布只包含应用壳。

## Scripts

```bash
npm ci
npm run lint
npm test
npm run build
```

## Deploy secrets

Never commit these repository secrets:

- `SSH_HOST`
- `SSH_PORT`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
