# Built from the repository root: docker build -f local-app/Dockerfile .
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY local-app/src ./local-app/src
USER node
EXPOSE 3000
HEALTHCHECK --interval=2s --timeout=2s --retries=30 CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "local-app/src/server.ts"]
