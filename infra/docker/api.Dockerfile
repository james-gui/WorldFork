FROM python:3.11-slim AS base

# Build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

WORKDIR /app

# Install Python dependencies first (layer caching)
COPY pyproject.toml ./
RUN uv pip install --system ".[dev]"

# Copy application source
COPY backend/ ./backend/
COPY source_of_truth/ ./source_of_truth/

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
