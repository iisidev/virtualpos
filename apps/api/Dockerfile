# ==========================================
# STAGE 1: Build NestJS API
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev for building)
RUN npm install

# Copy source code
COPY src ./src

# Compile TypeScript to JavaScript
RUN npm run build

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl for docker healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000

# Copy manifests and install production-only dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Switch to non-root node user
USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/auth/me || exit 0

CMD ["node", "dist/main.js"]

