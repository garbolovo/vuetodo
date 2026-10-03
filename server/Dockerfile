FROM node:22-alpine AS builder
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY server/package.json server/server.js ./
COPY index.html app.js style.css uuidv4.js ./public/
COPY server/config.prod.js ./public/config.js
VOLUME /app/data
EXPOSE 3001
CMD ["node", "server.js"]
