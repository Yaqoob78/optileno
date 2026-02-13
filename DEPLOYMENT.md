# Optileno Production Deployment Guide (Docker + VPS)

This guide explains how to deploy the full Optileno stack (Frontend, Backend, Postgres, Redis, Nginx) to a single Virtual Private Server (VPS) using Docker Compose. This is the **most robust and cost-effective** way to host your application, giving you full control over all services.

## 🚀 Strategy: "Free for 15 Days" (and more)
To host this for free initially, use the **free credits** offered by major cloud providers for new users:
*   **DigitalOcean:** Often offers $200 credit for 60 days.
*   **Vultr:** Often offers $100 credit.
*   **Linode:** Often offers $100 credit.
*   **Hetzner:** Very cheap (starting ~€5/mo) but no free trial usually.

## Prerequisites
1.  A **VPS** with at least **2GB RAM** (4GB recommended for 5000+ users).
    *   OS: **Ubuntu 22.04 LTS** (or newer).
2.  **Domain Name** (optional but recommended) pointing to your VPS IP.

## Step 1: Prepare Your VPS
SSH into your server:
```bash
ssh root@<YOUR_SERVER_IP>
```

Install Docker & Docker Compose:
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify installation
docker --version
docker compose version
```

## Step 2: Upload Your Code
You need to copy your project files to the server. You can use the included `deploy.ps1` script (if on Windows) or `scp`.

**Files required:**
*   `backend/` (directory)
*   `frontend/` (directory)
*   `docker-compose.prod.yml`
*   `nginx.prod.conf`
*   `.env` (create this on the server with production values)

### Option A: Using the Deployment Script (Windows)
1.  Open PowerShell in your project root.
2.  Update the `$ServerIP` variable in `deploy.ps1` (create this file if missing, see below).
3.  Run:
    ```powershell
    ./deploy.ps1
    ```

### Option B: Manual SCP
```bash
# Run from your local machine
scp -r backend frontend docker-compose.prod.yml nginx.prod.conf root@<YOUR_IP>:/root/optileno/
```

## Step 3: Configure Environment
SSH back into your server and set up the `.env` file.

```bash
cd /root/optileno

# Create .env file
nano .env
```

Paste your production variables:
```ini
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=optileno
DATABASE_URL=postgresql+asyncpg://postgres:secure_password_here@db:5432/optileno

# Security
SECRET_KEY=generate_a_long_random_string_here
ENVIRONMENT=production

# URLs
FRONTEND_URL=http://<YOUR_IP_OR_DOMAIN>
FRONTEND_API_URL=http://<YOUR_IP_OR_DOMAIN>/api
FRONTEND_SOCKET_URL=http://<YOUR_IP_OR_DOMAIN>
CORS_ORIGINS=["http://<YOUR_IP_OR_DOMAIN>"]

# AI Keys
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
# ... other keys
```

## Step 4: Fire it Up!
Run the application in detached mode:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Verification
*   Check status: `docker compose -f docker-compose.prod.yml ps`
*   View logs: `docker compose -f docker-compose.prod.yml logs -f`

## Step 5: Post-Deployment
1.  **Database Migration:** The `backend` container automatically runs migrations on startup (via `start.sh`).
2.  **Access:** Open `http://<YOUR_SERVER_IP>` in your browser. You should see the App.

## Troubleshooting
*   **"Connection Refused"**: Check if Nginx is running (`docker ps`) and ports 80/443 are open on your VPS firewall (`ufw allow 80`, `ufw allow 443`).
*   **Database Errors**: Check logs with `docker compose logs db`. Ensure passwords match in `.env`.
*   **High Memory Usage**: If Redis or Postgres crash, your VPS might need more RAM. Enable swap space:
    ```bash
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
    ```

## Scaling
To scale the backend workers (though `start.sh` already optimizes this):
```bash
# This scales containers, but standard Docker Compose usually runs 1 container per service.
# For true horizontal scaling, you'd use Docker Swarm or Kubernetes.
# However, our Gunicorn setup already scales PROCESSES within the single container.
```

## SSL / HTTPS (Free)
To add HTTPS, we recommend using **Certbot** on the host machine or adding a minimal **Certbot** container.
For simplicity, you can also use Cloudflare as a proxy (Flexible SSL) in front of your IP.