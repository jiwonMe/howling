FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY bootstrap.mjs ./
EXPOSE 8090
CMD ["node", "bootstrap.mjs"]
