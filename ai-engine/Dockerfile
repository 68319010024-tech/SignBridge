FROM python:3.11-slim-bookworm

WORKDIR /app

# mediapipe/opencv link against libGL and glib even in headless mode
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt .
# tensorflow ~500MB — เน็ตของเซิร์ฟเวอร์หลุด/ช้าแล้ว pip ล้มทั้ง build (exit code 2) จึงให้รอนานขึ้นและลองซ้ำ
RUN pip install --no-cache-dir --default-timeout=300 --retries 10 -r requirements-docker.txt

COPY models ./models
COPY src ./src

EXPOSE 8000
CMD ["python", "src/server.py"]
