# ==========================================
# STAGE 1: Build Angular 18 Frontend
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./
RUN npm install

# Copy source and configurations
COPY angular.json tsconfig*.json ./
COPY public ./public
COPY src ./src

# Build production bundle
RUN npm run build -- --configuration production

# ==========================================
# STAGE 2: Nginx Production Server
# ==========================================
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled Angular SPA browser assets
COPY --from=builder /app/dist/web/browser /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
