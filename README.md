# Split Buddies

Split Buddies is a self-hosted application for managing shared expenses, groups, and friends.

The project uses a TypeScript frontend, a Fastify backend, and SQLite for persistent data storage.

## Technology Stack

- **Frontend:** TypeScript, Vite
- **Backend:** Node.js, Fastify
- **Database:** SQLite with `better-sqlite3`
- **Authentication:** Password hashing and server-side sessions
- **Container deployment:** Podman Compose or Docker Compose
- **Reverse proxy:** Caddy (optional)

## Requirements

For local development:

- Node.js 22 or compatible
- npm

For container deployment:

- Podman or Docker
- Podman Compose or Docker Compose

## Local Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/ANavarrete00/SplitBuddies-server.git
cd SplitBuddies-server
npm ci
```

Available scripts:

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | Start the Vite frontend development server |
| `npm run dev:server` | Start the backend in watch mode            |
| `npm run dev:all`    | Start the frontend and backend together    |
| `npm run db:migrate` | Run database migrations                    |
| `npm run build`      | Build the frontend and backend             |
| `npm start`          | Start the compiled backend                 |
| `npm run preview`    | Preview the built frontend                 |

Start the development servers with:

```bash
npm run dev:all
```

Depending on your local configuration, you may need to configure the frontend proxy and database environment variables separately.

## Container Deployment

The repository includes a `Dockerfile` and `compose.yaml` for production container deployment.

### Configure the environment

Create a local environment file:

```bash
cp .env.example .env
```

The example configuration includes these variables:

| Variable       | Default   | Description                                       |
| -------------- | --------- | ------------------------------------------------- |
| `APP_PORT`     | `3000`    | Port used by the application inside the container |
| `HOST_PORT`    | `5274`    | Host port published for application access        |
| `BIND_ADDRESS` | `0.0.0.0` | Host interface used for the published port        |
| `TRUST_PROXY`  | *(empty)* | Trusted reverse-proxy IP address(es) or CIDR subnet(s) |

Leave `TRUST_PROXY` empty when the application is not behind a reverse proxy. When using a reverse proxy, set it to the IP address or CIDR subnet of the trusted proxy as seen by the application. Multiple entries can be comma-separated. Only trust proxies that handle forwarded client-IP headers safely.

For example, to publish the application on host port `8080` instead, set `HOST_PORT=8080` in `.env`. The application can continue listening on port `3000` inside the container.

If a reverse proxy runs directly on the same host, you can consider setting `BIND_ADDRESS=127.0.0.1` to restrict access through the published port to the local machine. Ensure the proxy's configuration matches the chosen port and network setup.

### Build and start

Using Podman Compose:

```bash
podman compose up -d --build
```

Using Docker Compose:

```bash
docker compose up -d --build
```

The production container runs database migrations before starting the application.

### Check status and logs

Using Podman:

```bash
podman compose ps
podman compose logs --tail=100
```

For Docker Compose, replace `podman compose` with `docker compose`.

### Health check

The application provides a health endpoint:

```text
GET /api/health
```

With the default host port, check it using:

```bash
curl http://127.0.0.1:5274/api/health
```

A healthy response reports the application and database status. The container health check uses this endpoint to monitor application health.

## Database and Persistent Storage

The production container stores its SQLite database at:

```text
/data/splitbuddies.sqlite
```

Compose mounts a named volume called `splitbuddies_data` at `/data`. This keeps database storage separate from the container image, allowing the application container to be rebuilt or recreated without intentionally deleting the database volume.

**Important:** Avoid running `podman compose down -v` or `docker compose down -v` unless you deliberately intend to remove the Compose-managed volumes.

SQLite may use write-ahead logging (WAL), so copying only the live database file is not always a complete or consistent backup. Use a SQLite-aware backup method or a coordinated shutdown procedure.

A backup and restore procedure has been tested in the development environment. A SQLite online backup was created using `better-sqlite3`, verified with an integrity check, and restored to a separate database file. The restored database retained the test user and migration records.

### Database Backup and Restore

The repository includes scripts for creating and restoring SQLite database backups. Run these scripts manually from the project root on the host where Podman is running.

#### Create a backup

```bash
./scripts/backup.sh
```

By default, backups are saved to `~/splitbuddies-backups/`. The backup script uses SQLite's online backup API, verifies the backup with `integrity_check`, and applies restrictive file permissions.

To choose a different backup directory, set `SPLITBUDDIES_BACKUP_DIR`:

```bash
SPLITBUDDIES_BACKUP_DIR=/path/to/backups ./scripts/backup.sh
```

#### Restore a backup

List available backups:

```bash
ls -lh ~/splitbuddies-backups/
```

Pass the path of the backup you want to restore to the restore script:

```bash
./scripts/restore.sh ~/splitbuddies-backups/splitbuddies-YYYYMMDD-HHMMSS.sqlite
```

Replace the example filename with the actual backup filename.

**Restore precautions:**

- The script asks you to type `RESTORE` to confirm the operation.
- It creates a safety backup of the current database before replacing it.
- It validates the selected backup before installation.
- It attempts to restore the previous database if the application fails its post-restore health check.
- Do not interrupt the restore process or manually delete database files while it is running.
- Verify that the application is healthy after the restore completes.

The restore script targets the `splitbuddies` container by default. To target a differently named container, set `SPLITBUDDIES_CONTAINER`.

#### Backup recommendations

Keep backups outside the container's writable layer. For disaster recovery, periodically copy backups to storage separate from the application host.

A successful backup does not guarantee a successful restore. Test restores periodically and retain safety backups until the restored application has been verified.

## Backup Policy

Backups are manual by default. Split Buddies does not configure a scheduler or automatically manage backup retention. Administrators can optionally schedule the backup script using host-level scheduling tools or deployment-specific automation appropriate to their environment.

The deployment administrator is responsible for choosing a backup policy, including:

- Scheduling: Decide how frequently backups should run based on how much data could reasonably be lost.
- Retention: Define how many backups to keep and remove older backups safely.
- Off-host storage: Periodically copy backups to storage separate from the application host to protect against host failure.
- Permissions: Restrict access to backup files because they contain application data.
- Recovery testing: Periodically test restoring a backup and verify that the application and restored data work as expected.

## Reverse Proxy and HTTPS

Split Buddies has been tested behind Caddy in the development environment.

For a production deployment, a reverse proxy can handle HTTPS and forward requests to the application. Configure the proxy's upstream address and port to match the actual container networking and published-port configuration.

When deploying behind a reverse proxy, configure `TRUST_PROXY` in the deployment's `.env` file with the trusted proxy IP address or CIDR subnet. Leave it empty when proxy trust is not needed. Fastify uses this setting to determine client IP addresses from forwarded headers, which affects IP-based authentication rate limits. The configured address must match the proxy's source address as seen by the application. Only trust proxies that safely set or sanitize forwarded client-IP headers, and restrict direct application access where practical.

> [!NOTE]
>
> Use HTTPS for real deployments to avoid exposing the application.

### Authentication Rate Limits

Split Buddies applies rate limits to login and registration endpoints to help reduce automated abuse.

The defaults are:

| Environment variable | Default | Description |
| --- | --- | --- |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | `10` | Login requests allowed per window |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW` | `1 minute` | Login rate-limit window |
| `AUTH_REGISTER_RATE_LIMIT_MAX` | `5` | Registration requests allowed per window |
| `AUTH_REGISTER_RATE_LIMIT_WINDOW` | `1 hour` | Registration rate-limit window |

Set these variables in your `.env` file to customize the limits. Windows accept positive durations such as `30 seconds`, `5 minutes`, or `2 hours`. Invalid values prevent the server from starting.

Rate-limit counters are stored in memory. They reset when the server restarts and are not shared across multiple application instances. When deploying behind a reverse proxy, configure client IP handling carefully so that IP-based limits behave as intended.

## Deployment Status

The following have been tested in the development environment:

- Production container image builds successfully.
- Production dependencies are installed separately from development dependencies.
- Database migrations run at container startup.
- The health endpoint reports a healthy database.
- The application is accessible from another device on the home LAN.
- Caddy successfully proxies requests to the application.
- A SQLite online backup completes successfully while the application is running.
- The backup passes SQLite's `integrity_check` and contains the expected tables, user data, and migration records.
- The backup can be restored to a separate database file with its data preserved.
- The restored database can be used by an isolated application container with a separate named volume and host port.
- Both the restored instance and the original application return a healthy response from `/api/health`.
- The application shuts down gracefully on SIGTERM, allowing Fastify to close and SQLite to release its database connection.

Further validation is planned for:

- Backup retention and copying backups to storage separate from the application host.
- Safe upgrades and migration recovery.
- Restore testing on the eventual Proxmox deployment.

## Security Notes

- Use HTTPS for deployed instances.
- Keep secrets and environment-specific credentials out of Git.
- Preserve persistent database storage when rebuilding or upgrading containers.
- Back up the database before potentially destructive maintenance or migrations.
- Restrict direct application access when a reverse proxy is intended to be the only entry point.
