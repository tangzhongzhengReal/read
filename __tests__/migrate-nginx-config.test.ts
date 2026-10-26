import { expect, test } from "vitest";
import { migrateNginxConfig } from "../deploy/nginx/migrate-nginx-config.mjs";

const staticSite = `server {
    listen 80;
    server_name read.coming.js.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name read.coming.js.cn;
    ssl_certificate /etc/letsencrypt/live/read.coming.js.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/read.coming.js.cn/privkey.pem;
    root /var/www/read;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`;

test("a static TLS site is switched to the node proxy and keeps certificates", () => {
  const result = migrateNginxConfig(staticSite);

  expect(result.changed).toBe(true);
  expect(result.config).toContain("return 301 https://$host$request_uri;");
  expect(result.config).toContain(
    "ssl_certificate /etc/letsencrypt/live/read.coming.js.cn/fullchain.pem;",
  );
  expect(result.config).toContain(
    "ssl_certificate_key /etc/letsencrypt/live/read.coming.js.cn/privkey.pem;",
  );
  expect(result.config).not.toContain("root /var/www/read");
  expect(result.config).not.toContain("try_files");
  expect(result.config).toContain("proxy_pass http://127.0.0.1:3210;");
  expect(result.config).toContain("client_max_body_size 32m;");
});

test("an existing proxy for this app is left unchanged", () => {
  const proxied = `server {
    listen 443 ssl;
    server_name read.coming.js.cn;
    ssl_certificate /etc/letsencrypt/live/read.coming.js.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/read.coming.js.cn/privkey.pem;
    client_max_body_size 32m;
    location / {
        proxy_pass http://127.0.0.1:3210;
        proxy_set_header Host $host;
    }
}
`;
  const result = migrateNginxConfig(proxied);
  expect(result.changed).toBe(false);
  expect(result.config).toBe(proxied);
});

test("a different site is left unchanged", () => {
  const other = `server {
    listen 443 ssl;
    server_name example.com;
    root /var/www/example;
}
`;
  const result = migrateNginxConfig(other);
  expect(result.changed).toBe(false);
  expect(result.config).toBe(other);
});
