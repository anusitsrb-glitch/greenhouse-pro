# GreenHouse Pro Server - Dockerfile
# This file will be completed in Step 8

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Create data directory
RUN mkdir -p /app/data /app/backups

# Non-root user
RUN addgroup -g 1001 greenhouse && \
    adduser -u 1001 -G greenhouse -s /bin/sh -D greenhouse && \
    chown -R greenhouse:greenhouse /app

USER greenhouse

EXPOSE 3001

CMD ["node", "dist/index.js"]
