# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y gcc postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Expects build context to be the REPO ROOT
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend /app/backend

# Copy start script
COPY backend/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create non-root user
RUN useradd -m appuser \
    && mkdir -p /app/data/media \
    && chown -R appuser:appuser /app
USER appuser

# Expose is optional but fine
EXPOSE 8000

# Start with migration script
CMD ["/app/start.sh"]
