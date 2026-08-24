# Small, no build step, no dependencies to install.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY lib ./lib
COPY public ./public
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "server.mjs"]
