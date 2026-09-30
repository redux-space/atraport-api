# Stage 1: Install all dependencies (including devDependencies required for compilation)
FROM node:20.18-alpine AS deps
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

# Stage 2: Compile TypeScript application and prune devDependencies
FROM node:20.18-alpine AS build
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

# Stage 3: Minimal production runtime
FROM node:20.18-alpine AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --chown=node:node package*.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
