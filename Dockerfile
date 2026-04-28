FROM node:20-slim

# 캐시 버스터 (강제 리빌드용)
ARG CACHEBUST=20260313

# 시스템 라이브러리 설치
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libxshmfence1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 서버 package.json만 복사 (루트 X, server/ O)
COPY server/package*.json ./
RUN npm install --production

# 서버 소스코드만 복사
COPY server/ .

# 포트 노출
EXPOSE 8080

# 서버 실행
CMD ["node", "index.js"]
