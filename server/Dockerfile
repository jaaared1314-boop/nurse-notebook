# Reminder server image for Fly.io (or any host that builds a Dockerfile).
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js ./
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
