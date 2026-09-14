FROM node:22-alpine
WORKDIR /app
COPY infra/oidc/package.json ./
COPY infra/oidc/dist ./dist
RUN npm install --omit=dev --ignore-scripts
EXPOSE 8081
CMD ["node", "dist/main.js"]
