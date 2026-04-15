FROM node:20-alpine AS base
WORKDIR /app

# Dev: hot-reload, código montado como volumen
FROM base AS dev
COPY package*.json ./
RUN npm install
# El código viene del volumen

# Prod: build estático
FROM base AS prod
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
