# --- Development: Vite dev server with hot reload ---
FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

# --- Build static assets ---
FROM dev AS build
RUN npm run build

# --- Production: nginx serves the SPA and reverse-proxies the Django backend ---
FROM nginx:1.30-alpine AS prod
# Default trusts no upstream proxy; set to your load balancer's CIDR when running behind one
ENV TRUSTED_PROXY_CIDR=127.0.0.1/32
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
