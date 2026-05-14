FROM node:22-slim

# 캐시 버스터 (강제 리빌드용)
ARG CACHEBUST=20260313

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
