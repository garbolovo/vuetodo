FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package.json server.js ./
VOLUME /app/data
EXPOSE 3001
CMD ["node", "server.js"]
