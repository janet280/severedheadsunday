# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY src ./src
COPY public ./public

ARG VITE_MEDIA_BASE_URL=
ARG VITE_BACKGROUND_IMAGE_URL=
ENV VITE_MEDIA_BASE_URL=$VITE_MEDIA_BASE_URL
ENV VITE_BACKGROUND_IMAGE_URL=$VITE_BACKGROUND_IMAGE_URL

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
