# ══════════════════════════════════════════════════════════════
# StocksLab Backend — Production Dockerfile
# Optimized for Koyeb / ClawCloud / any container platform
# ══════════════════════════════════════════════════════════════

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (Docker layer caching)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --production

# Copy application source
COPY src/ ./src/
COPY ecosystem.config.cjs ./

# Create logs directory
RUN mkdir -p logs

# Expose the server port
EXPOSE 4000

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000

# Start the server directly (PM2 not needed in containers — 
# Koyeb/Docker handles restart & health checks)
CMD ["node", "--max-old-space-size=400", "src/server.js"]
