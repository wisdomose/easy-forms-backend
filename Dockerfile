# Base stage
FROM node:20-alpine AS base

RUN npm install -g pnpm
WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./

# Development stage
FROM base AS development
RUN pnpm install
COPY . .
CMD ["pnpm", "run", "start:dev"]

# Test stage
FROM base AS test
RUN pnpm install
COPY . .
RUN pnpm run test

# Build stage
FROM base AS build
RUN pnpm install
COPY . .
RUN pnpm run build
RUN pnpm prune --production

# Production stage
FROM node:20-alpine AS production
RUN npm install -g pnpm
WORKDIR /usr/src/app

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json ./package.json

ARG PORT
ENV PORT=${PORT}
EXPOSE ${PORT}
CMD ["pnpm", "run", "start:prod"]
