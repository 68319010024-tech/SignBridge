FROM python:3.11-slim-bookworm

WORKDIR /app

# mediapipe/opencv link against libGL and glib even in headless mode
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt .
RUN pip install --no-cache-dir -r requirements-docker.txt

COPY models ./models
COPY src ./src

EXPOSE 8000
CMD ["python", "src/server.py"]
