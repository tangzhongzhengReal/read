# Read

单人文档学习笔记（MarginNote 思路，自有产品）。PDF 放在 `uploads/`，结构化数据追加到 `data/<workspaceId>/*.jsonl`。没有数据库。

本地和 CI 的 `npm start` 运行 Next.js standalone（`node .next/standalone/server.js`）。推送到 `main` 后，GitHub Actions 把同一份服务部署到 VPS，由 systemd 监听 `127.0.0.1:3210`，nginx 反代到该进程，因此 [https://read.coming.js.cn](https://read.coming.js.cn) 可以访问 `/api`。

## Local checks

```bash
npm ci
npm run lint
npm test
npm run build
npx playwright install chromium
npm run e2e
```

`npm run e2e` 需要先 `npm run build`。Playwright 会启动 `npm start`，检查文库壳、PDF 上传与阅读、摘录跳回，以及 `POST /api/documents/upload`。

JSONL 默认写到 `./data`，PDF 默认写到 `./uploads`。可以用 `READ_DATA_DIR` 和 `READ_UPLOADS_DIR` 改目录。测试使用临时目录。

## Production

服务器需要：

- Node.js 22.13 或更新（部署脚本在缺失时安装官方包到 `/opt/read/node`，当前固定 `v22.23.4`）
- systemd
- 已经为 `read.coming.js.cn` 配好 TLS 的 nginx
- `curl`（仅在需要下载 Node 时）
- 部署账号是 root，或对该账号配置了免密 `sudo`

目录：

```text
/var/lib/read/app       # 每次发布替换的 standalone 服务
/var/lib/read/data      # JSONL，发布不会删除
/var/lib/read/uploads   # PDF，发布不会删除
```

systemd 单元是 `read.service`。它执行 `node /var/lib/read/app/server.js`，环境变量：

```text
NODE_ENV=production
PORT=3210
HOSTNAME=127.0.0.1
READ_DATA_DIR=/var/lib/read/data
READ_UPLOADS_DIR=/var/lib/read/uploads
```

nginx 的 `location /` 需要反代到 `http://127.0.0.1:3210`，并允许较大的上传（`client_max_body_size 32m`）。部署脚本会备份并改写已经包含 `read.coming.js.cn` 的站点文件，去掉 `root /var/www/read` 静态配置。`nginx -t` 失败时会还原。`/var/www/read` 里的旧静态文件会留在磁盘上，但不再被 nginx 直接提供。

如果 `/etc/nginx` 里还没有这个域名，脚本不会新建站点，只把示例写到 `/var/lib/read/nginx.read.coming.js.cn.conf`。把其中的证书路径换成现有证书后再启用。示例也在 `deploy/nginx/read.coming.js.cn.conf`。

手动检查：

```bash
systemctl status read.service
curl -fsS http://127.0.0.1:3210/api/documents?workspaceId=local
```

不使用 pm2。进程由 systemd 拉起并在失败后重启。

## Deploy secrets

不要把这些仓库密钥写进代码：

- `SSH_HOST`
- `SSH_PORT`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
