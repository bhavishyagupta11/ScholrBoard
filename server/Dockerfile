FROM node:20-slim

WORKDIR /app

# Install native dependencies required for compiling C++ addons like bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure local uploads directory exists with correct non-root permissions
RUN mkdir -p uploads && chown -R node:node /app

# Switch to non-root node user
USER node

EXPOSE 5000

ENV PORT=5000 \
    HOST=0.0.0.0 \
    NODE_ENV=production

CMD ["node", "server.js"]
