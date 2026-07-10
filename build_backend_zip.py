import fnmatch
import os
import shutil
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_ROOT = PROJECT_ROOT / "backend"
ENV_FILE = PROJECT_ROOT / "env" / ".env"
BUILD_ROOT = PROJECT_ROOT / ".deploy" / "backend-eb"
ZIP_PATH = PROJECT_ROOT / "optileno-backend-eb.zip"

SKIP_DIRS = {
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "tests",
}

SKIP_FILE_NAMES = {
    ".env",
    ".env.example",
    ".dockerignore",
    "Dockerfile",
    "render.env",
    "start.sh",
    "alembic_bootstrap.db",
    "optileno.db",
}

SKIP_FILE_PATTERNS = (
    "*.pyc",
    "*.pyo",
    "*.pyd",
    "*.swp",
    "*.log",
    "*.db",
    "*.sqlite",
    "*.sqlite3",
    "debug_*.py",
    "fix_*.py",
    "read_*.py",
    "print_*.py",
    "write_*_version.py",
    "check_*.py",
    "test_*.py",
    "result*.txt",
    "error*.txt",
    "debug_*.txt",
    "*bcrypt_version*.txt",
)

EB_START = """#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

load_env_file() {
  ENV_FILE="$1"
  if [ ! -f "${ENV_FILE}" ]; then
    return 0
  fi

  echo "Loading environment from ${ENV_FILE}"
  export OPTILENO_ENV_FILE="${ENV_FILE}"

  eval "$(
    python - "${ENV_FILE}" <<'PY'
from pathlib import Path
import os
import re
import shlex
import sys

path = Path(sys.argv[1])

try:
    from dotenv import dotenv_values
except Exception:
    dotenv_values = None

if dotenv_values is not None:
    values = dotenv_values(path)
else:
    values = {}
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("export "):
            key = key[7:].strip()
        value = value.strip().strip("'\\\"")
        values[key] = value

force_keys = {
    key.strip()
    for key in os.environ.get(
        "OPTILENO_PACKAGE_ENV_FORCE_KEYS",
        "DATABASE_URL,DATABASE_AWS_REGION,DATABASE_IAM_AUTH,DATABASE_SSL_MODE",
    ).split(",")
    if key.strip()
}

for key, value in values.items():
    if not key or value is None:
        continue
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
        continue
    if os.environ.get(key, "") and key not in force_keys:
        continue
    print(f"export {key}={shlex.quote(str(value))}")
PY
  )"
}

if [ "${OPTILENO_LOAD_DOTENV:-true}" != "false" ]; then
  load_env_file "env/.env"
fi

if [ -n "${DATABASE_URL:-}" ]; then
  DB_URL="${DATABASE_URL}"
  FIRST_CHAR="${DB_URL:0:1}"
  LAST_CHAR="${DB_URL: -1}"
  if [[ "${FIRST_CHAR}" == '"' && "${LAST_CHAR}" == '"' ]] || [[ "${FIRST_CHAR}" == "'" && "${LAST_CHAR}" == "'" ]]; then
    DB_URL="${DB_URL:1:${#DB_URL}-2}"
  fi
  if [[ "${DB_URL}" == \\$\\{* ]] || [[ "${DB_URL}" == \\$\\{\\{* ]]; then
    echo "DATABASE_URL looks unresolved. Set it to the real connection string."
    exit 1
  fi
  DB_PASSWORD_STATUS=$(python - "${DB_URL}" <<'PY'
import sys
from urllib.parse import urlsplit, unquote

url = sys.argv[1].replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://")
password = unquote(urlsplit(url).password or "").strip()
placeholders = {
    "password",
    "your_password",
    "your_aurora_password",
    "your-rds-password",
    "changeme",
}
print("placeholder" if password.lower() in placeholders else "ok")
PY
  )
  if [ "${DB_PASSWORD_STATUS}" = "placeholder" ]; then
    echo "DATABASE_URL still contains a placeholder password. Set the real Aurora/RDS password in Elastic Beanstalk environment variables or env/.env."
    exit 1
  fi
  export DATABASE_URL="${DB_URL}"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  for ALT_DB_VAR in DATABASE_PRIVATE_URL DATABASE_PUBLIC_URL POSTGRES_URL POSTGRESQL_URL; do
    ALT_VALUE="${!ALT_DB_VAR:-}"
    if [ -n "${ALT_VALUE}" ]; then
      export DATABASE_URL="${ALT_VALUE}"
      echo "DATABASE_URL was missing; using ${ALT_DB_VAR}."
      break
    fi
  done
fi

if [ -z "${DATABASE_URL:-}" ] && [ -n "${PGHOST:-}" ] && [ -n "${PGUSER:-}" ] && [ -n "${PGPASSWORD:-}" ] && [ -n "${PGDATABASE:-}" ]; then
  ENCODED_USER=$(python -c "import os,urllib.parse; print(urllib.parse.quote(os.environ.get('PGUSER',''), safe=''))")
  ENCODED_PASS=$(python -c "import os,urllib.parse; print(urllib.parse.quote(os.environ.get('PGPASSWORD',''), safe=''))")
  PG_PORT_VALUE="${PGPORT:-5432}"
  export DATABASE_URL="postgresql+asyncpg://${ENCODED_USER}:${ENCODED_PASS}@${PGHOST}:${PG_PORT_VALUE}/${PGDATABASE}"
  echo "DATABASE_URL was missing; built from PG* environment variables."
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. PostgreSQL is required in production."
  exit 1
fi

python - <<'PY'
import os
from urllib.parse import urlsplit

raw_url = os.environ.get("DATABASE_URL", "")
url = raw_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://")
parsed = urlsplit(url)
auth_mode = "RDS IAM token" if os.environ.get("DATABASE_IAM_AUTH", "").strip().lower() in {"1", "true", "yes", "y", "on"} else "static password"
print(
    "Database preflight: "
    f"host={parsed.hostname or 'missing'} "
    f"port={parsed.port or 5432} "
    f"database={(parsed.path or '/').lstrip('/') or 'missing'} "
    f"user={parsed.username or 'missing'} "
    f"auth={auth_mode} "
    f"sslmode={os.environ.get('DATABASE_SSL_MODE', '') or 'default'} "
    f"region={os.environ.get('DATABASE_AWS_REGION') or os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION') or 'missing'}"
)
if auth_mode == "RDS IAM token":
    print("Database preflight: EB instance role must allow rds-db:connect for this database user.")
PY

if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  echo "Running database migrations..."
  (cd backend && alembic upgrade head)
fi

PORT_VALUE="${PORT:-8000}"
if ! [[ "${PORT_VALUE}" =~ ^[0-9]+$ ]]; then
  echo "Invalid PORT value '${PORT_VALUE}'. Falling back to 8000."
  PORT_VALUE="8000"
fi

WORKERS_PER_CORE_VALUE="${WORKERS_PER_CORE:-2}"
MAX_WORKERS_VALUE="${MAX_WORKERS:-8}"
WEB_CONCURRENCY_VALUE="${WEB_CONCURRENCY:-}"
UVICORN_BACKLOG_VALUE="${UVICORN_BACKLOG:-2048}"
UVICORN_KEEP_ALIVE_VALUE="${UVICORN_TIMEOUT_KEEP_ALIVE:-10}"
UVICORN_LIMIT_CONCURRENCY_VALUE="${UVICORN_LIMIT_CONCURRENCY:-}"
UVICORN_LIMIT_MAX_REQUESTS_VALUE="${UVICORN_LIMIT_MAX_REQUESTS:-0}"
UVICORN_LIMIT_MAX_REQUESTS_MIN_VALUE="${UVICORN_LIMIT_MAX_REQUESTS_MIN:-20000}"
UVICORN_ACCESS_LOG_VALUE="${UVICORN_ACCESS_LOG:-}"

if ! [[ "${WORKERS_PER_CORE_VALUE}" =~ ^[0-9]+$ ]]; then WORKERS_PER_CORE_VALUE=2; fi
if ! [[ "${MAX_WORKERS_VALUE}" =~ ^[0-9]+$ ]]; then MAX_WORKERS_VALUE=8; fi
if ! [[ "${UVICORN_BACKLOG_VALUE}" =~ ^[0-9]+$ ]]; then UVICORN_BACKLOG_VALUE=2048; fi
if ! [[ "${UVICORN_KEEP_ALIVE_VALUE}" =~ ^[0-9]+$ ]]; then UVICORN_KEEP_ALIVE_VALUE=10; fi
if ! [[ "${UVICORN_LIMIT_MAX_REQUESTS_VALUE}" =~ ^[0-9]+$ ]]; then UVICORN_LIMIT_MAX_REQUESTS_VALUE=0; fi
if ! [[ "${UVICORN_LIMIT_MAX_REQUESTS_MIN_VALUE}" =~ ^[0-9]+$ ]]; then UVICORN_LIMIT_MAX_REQUESTS_MIN_VALUE=20000; fi

if [ "${ENVIRONMENT:-development}" = "production" ] \
  && [ "${UVICORN_LIMIT_MAX_REQUESTS_VALUE}" -gt 0 ] \
  && [ "${UVICORN_LIMIT_MAX_REQUESTS_MIN_VALUE}" -gt 0 ] \
  && [ "${UVICORN_LIMIT_MAX_REQUESTS_VALUE}" -lt "${UVICORN_LIMIT_MAX_REQUESTS_MIN_VALUE}" ]; then
  echo "UVICORN_LIMIT_MAX_REQUESTS=${UVICORN_LIMIT_MAX_REQUESTS_VALUE} is below the production minimum; using ${UVICORN_LIMIT_MAX_REQUESTS_MIN_VALUE}."
  UVICORN_LIMIT_MAX_REQUESTS_VALUE="${UVICORN_LIMIT_MAX_REQUESTS_MIN_VALUE}"
fi

if [ -z "${UVICORN_ACCESS_LOG_VALUE}" ]; then
  if [ "${ENVIRONMENT:-development}" = "production" ]; then
    UVICORN_ACCESS_LOG_VALUE="false"
  else
    UVICORN_ACCESS_LOG_VALUE="true"
  fi
fi

if [ -n "${WEB_CONCURRENCY_VALUE}" ] && [[ "${WEB_CONCURRENCY_VALUE}" =~ ^[0-9]+$ ]]; then
  WORKER_COUNT="${WEB_CONCURRENCY_VALUE}"
else
  CPU_CORES=$(python - <<'PY'
import os
print(os.cpu_count() or 1)
PY
)
  if ! [[ "${CPU_CORES}" =~ ^[0-9]+$ ]]; then CPU_CORES=1; fi
  WORKER_COUNT=$((CPU_CORES * WORKERS_PER_CORE_VALUE))
  if [ "${WORKER_COUNT}" -lt 1 ]; then WORKER_COUNT=1; fi
  if [ "${WORKER_COUNT}" -gt "${MAX_WORKERS_VALUE}" ]; then WORKER_COUNT="${MAX_WORKERS_VALUE}"; fi
fi

if [ "${ENVIRONMENT:-development}" = "development" ]; then
  WORKER_COUNT=1
fi

echo "Starting Optileno backend on port ${PORT_VALUE} with ${WORKER_COUNT} worker(s)."

UVICORN_ARGS=(
  backend.app.main:app
  --host 0.0.0.0
  --port "${PORT_VALUE}"
  --workers "${WORKER_COUNT}"
  --proxy-headers
  --forwarded-allow-ips "*"
  --backlog "${UVICORN_BACKLOG_VALUE}"
  --timeout-keep-alive "${UVICORN_KEEP_ALIVE_VALUE}"
)

if [ -n "${UVICORN_LIMIT_CONCURRENCY_VALUE}" ] && [[ "${UVICORN_LIMIT_CONCURRENCY_VALUE}" =~ ^[0-9]+$ ]]; then
  UVICORN_ARGS+=(--limit-concurrency "${UVICORN_LIMIT_CONCURRENCY_VALUE}")
fi

if [ "${UVICORN_LIMIT_MAX_REQUESTS_VALUE}" -gt 0 ]; then
  UVICORN_ARGS+=(--limit-max-requests "${UVICORN_LIMIT_MAX_REQUESTS_VALUE}")
fi

case "$(echo "${UVICORN_ACCESS_LOG_VALUE}" | tr '[:upper:]' '[:lower:]')" in
  0|false|no|off)
    UVICORN_ARGS+=(--no-access-log)
    ;;
esac

exec python -m uvicorn "${UVICORN_ARGS[@]}"
"""

DOCKERFILE = """FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \\
    && apt-get install -y --no-install-recommends \\
        bash \\
        gcc \\
        postgresql-client \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY env /app/env
COPY eb_start.sh /app/eb_start.sh

RUN chmod +x /app/eb_start.sh \\
    && mkdir -p /app/data/media

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["bash", "/app/eb_start.sh"]
"""

EB_NGINX_CONF = """user nginx;
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 8192;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server_tokens off;
    client_max_body_size 20m;
    keepalive_timeout 65;
    types_hash_max_size 4096;
    types_hash_bucket_size 128;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/conf.d/elasticbeanstalk/*.conf;
}
"""


def should_skip(path: Path) -> bool:
    if any(part in SKIP_DIRS for part in path.parts):
        return True
    if path.is_dir():
        return False
    if path.name in SKIP_FILE_NAMES:
        return True
    return any(fnmatch.fnmatch(path.name, pattern) for pattern in SKIP_FILE_PATTERNS)


def copy_backend() -> None:
    for source in BACKEND_ROOT.rglob("*"):
        rel = source.relative_to(PROJECT_ROOT)
        if should_skip(source.relative_to(BACKEND_ROOT)):
            continue

        destination = BUILD_ROOT / rel
        if source.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)


def write_boot_files() -> None:
    if not ENV_FILE.exists():
        raise FileNotFoundError("Expected deployment env file at env/.env")

    requirements_text = (BACKEND_ROOT / "requirements.txt").read_text(
        encoding="utf-8",
        errors="replace",
    )
    requirements_text = requirements_text.replace("\r\n", "\n").replace("\r", "\n")
    (BUILD_ROOT / "requirements.txt").write_text(
        requirements_text,
        encoding="utf-8",
        newline="\n",
    )

    env_destination = BUILD_ROOT / "env" / ".env"
    env_destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ENV_FILE, env_destination)

    (BUILD_ROOT / "Procfile").write_text("web: bash eb_start.sh\n", encoding="utf-8")
    (BUILD_ROOT / "eb_start.sh").write_text(EB_START, encoding="utf-8", newline="\n")
    (BUILD_ROOT / "Dockerfile").write_text(DOCKERFILE, encoding="utf-8", newline="\n")

    nginx_conf = BUILD_ROOT / ".platform" / "nginx" / "nginx.conf"
    nginx_conf.parent.mkdir(parents=True, exist_ok=True)
    nginx_conf.write_text(EB_NGINX_CONF, encoding="utf-8", newline="\n")


def create_zip() -> int:
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    files = sorted(path for path in BUILD_ROOT.rglob("*") if path.is_file())
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in files:
            archive.write(file_path, file_path.relative_to(BUILD_ROOT).as_posix())

    return len(files)


def main() -> None:
    if BUILD_ROOT.exists():
        shutil.rmtree(BUILD_ROOT)
    BUILD_ROOT.mkdir(parents=True)

    copy_backend()
    write_boot_files()
    count = create_zip()
    preview = ", ".join(sorted(p.name for p in BUILD_ROOT.iterdir())[:20])

    if os.getenv("KEEP_EB_STAGING") != "1":
        shutil.rmtree(BUILD_ROOT)
        if BUILD_ROOT.parent.exists() and not any(BUILD_ROOT.parent.iterdir()):
            BUILD_ROOT.parent.rmdir()

    print(f"Created {ZIP_PATH.name} with {count} files")
    print(f"Bundle root preview: {preview}")


if __name__ == "__main__":
    main()
