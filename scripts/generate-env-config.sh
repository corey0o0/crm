#!/bin/bash

# 빌드 디렉토리 생성
mkdir -p ./build

# env-config.js 파일 생성
cat > ./build/env-config.js << EOF
window._env_ = {
  OPENAI_API_KEY: '${OPENAI_API_KEY}',
  OPENAI_API_ENDPOINT: '${OPENAI_API_ENDPOINT:-https://api.openai.com/v1/chat/completions}',
  OPENAI_API_MODEL: '${OPENAI_API_MODEL:-gpt-4o-mini}'
};
EOF 