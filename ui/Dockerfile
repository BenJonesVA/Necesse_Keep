FROM node:20-alpine AS client-build
WORKDIR /build/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

COPY server/src ./src
COPY server/scripts ./scripts
COPY --from=client-build /build/client/dist /app/client/dist

USER node

EXPOSE 3000
CMD ["node", "src/app.js"]
