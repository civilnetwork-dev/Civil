FROM node:bookworm

WORKDIR /app

COPY . .

RUN npm i -g pnpm && pnpm i

COPY . .

CMD chmod +x index.ts && ./index.ts --reverse-proxy=false

EXPOSE 8080