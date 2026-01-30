FROM node:bookworm

WORKDIR /app

COPY . .

RUN npm i -g pnpm && pnpm i && pnpm build

COPY . .

CMD chmod +x index.ts && ./index.ts --reverse-proxy=true

EXPOSE 8080