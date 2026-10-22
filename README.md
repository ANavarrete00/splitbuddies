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

A tested backup and restore procedure is planned.

## Reverse Proxy and HTTPS

Split Buddies has been tested behind Caddy in the development environment.

For a production deployment, a reverse proxy can handle HTTPS and forward requests to the application. Configure the proxy's upstream address and port to match the actual container networking and published-port configuration.

> [!NOTE]
>
> Use HTTPS for real deployments to avoid exposing the application.

## Deployment Status

The following have been tested in the development environment:

- Production container image builds successfully.
- Production dependencies are installed separately from development dependencies.
- Database migrations run at container startup.
- The health endpoint reports a healthy database.
- The application is accessible from another device on the home LAN.
- Caddy successfully proxies requests to the application.

Further validation is planned for:

- Consistent database backup and restore.
- Restore testing with an isolated container and volume.
- Safe upgrades and migration recovery.

## Security Notes

- Use HTTPS for deployed instances.
- Keep secrets and environment-specific credentials out of Git.
- Preserve persistent database storage when rebuilding or upgrading containers.
- Back up the database before potentially destructive maintenance or migrations.
- Restrict direct application access when a reverse proxy is intended to be the only entry point.
