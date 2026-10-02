# Built from the repository root: docker build -f local-app/Dockerfile .
FROM node:26-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY local-app/src ./local-app/src
USER node
EXPOSE 3000
HEALTHCHECK --interval=2s --timeout=2s --retries=30 CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "local-app/src/server.ts"]
