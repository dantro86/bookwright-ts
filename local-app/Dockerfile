# Built from the repository root: docker build -f local-app/Dockerfile .
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY local-app/src ./local-app/src
USER node
EXPOSE 3000
HEALTHCHECK --interval=2s --timeout=2s --retries=30 CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "local-app/src/server.ts"]
