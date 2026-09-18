FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-mysql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Expose web port
EXPOSE 5000

# Run with Gunicorn WSGI server
CMD ["sh", "-c", "gunicorn wsgi:app --bind 0.0.0.0:${PORT:-5000} --workers 2 --threads 4 --timeout 120"]
