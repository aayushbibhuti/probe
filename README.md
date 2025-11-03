# probe

Telemetry ingestion service for `POST /api/metrics?v=...`.

## Features
- Accepts telemetry JSON payloads and persists them to MongoDB
- Basic schema validation (AJV)
- Optional support for XOR+Base64-style obfuscated payloads (automatic attempt if body is base64 string)
- Basic rate limiting, CORS, helmet security headers, request size limits
- Docker / Docker Compose included

## Quick start (development)

1. Copy `.env.example` to `.env` and adjust as needed.

2. Start with Docker Compose:

```bash
docker-compose up --build


docker build --target production -t webprobe-metrics:prod 
docker build --target development -t webprobe-metrics:dev
docker run -p 3000:3000 webprobe-metrics:prod


docker-compose -f docker-compose.dev.yml up --build
docker-compose -f docker-compose.prod.yml up --build -d


docker-compose -f docker-compose.dev.yml logs -f
docker-compose -f docker-compose.prod.yml logs -f app

