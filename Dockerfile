FROM node:20-slim

# Chrome dependencies required by Remotion's headless renderer
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  fonts-noto-color-emoji \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libvulkan1 \
  libxcomposite1 \
  libxdamage1 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Tell Remotion/Puppeteer to use the system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox"

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p videos tmp

EXPOSE 3000

CMD ["node", "src/server.js"]
