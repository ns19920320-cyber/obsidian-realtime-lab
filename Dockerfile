FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src/client.mjs src/server.mjs ./src/
ENV LAB_HOST=0.0.0.0 LAB_PORT=17236 LAB_DATA_DIR=/data NODE_ENV=production
EXPOSE 17236
CMD ["node", "src/server.mjs"]
