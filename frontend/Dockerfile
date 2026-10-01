# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# SB_THEME=red -> ธีมแดง-ทองสำหรับ /ai2/ (ว่าง = ธีมน้ำเงินเดิมของ /ai/) ดู vite.config.ts
ARG SB_THEME=
RUN SB_THEME=$SB_THEME npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
