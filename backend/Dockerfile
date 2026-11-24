# Stage 1: Build dependencies
FROM python:3.11-slim as builder

WORKDIR /build

# Install build essentials if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime image
FROM python:3.11-slim as runner

WORKDIR /app

# Copy installed python packages from builder
COPY --from=builder /install /usr/local

# Create persistent data directory for SQLite
RUN mkdir -p /data && chmod 777 /data

# Copy application source code
COPY ./app ./app

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite:////data/app.db

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
