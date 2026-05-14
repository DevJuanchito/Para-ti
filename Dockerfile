FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates curl \
    && python3 -m pip install --no-cache-dir --break-system-packages -U yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY .npmrc ./
RUN npm install --omit=dev --legacy-peer-deps

COPY . .

ENV NODE_ENV=production
CMD ["npm", "start"]
