FROM python:3.11-slim

WORKDIR /app

# Install system fonts for pin image generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default port for webhook mode
ENV PORT=10000

CMD ["python", "-m", "bot.main"]
