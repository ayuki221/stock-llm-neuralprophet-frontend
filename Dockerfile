# ---- Build Stage ----
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (better caching)
COPY package.json package-lock.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build


# ---- Production Stage ----
FROM nginx:stable-alpine

# Copy final build to nginx
COPY --from=builder /app/dist /usr/share/nginx/html/stock-llm-neuralprophet-frontend/
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Optional: Custom nginx config for SPA routing (Vue/React routers)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]