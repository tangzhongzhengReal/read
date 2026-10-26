# read

Push to `main` deploys this site to [https://read.coming.js.cn](https://read.coming.js.cn).

The workflow copies the repository files to `/var/www/read` over SSH. It does not delete other files already on the server. nginx and TLS are configured separately.

Repository secrets (never commit these):

- `SSH_HOST`
- `SSH_PORT`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
