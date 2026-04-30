# Stage 1: build the Vite SPA
FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# When running behind nginx the SPA calls /api/v1/... (relative URL),
# so no VITE_API_BASE_URL override is needed — the default in api.ts works.
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
