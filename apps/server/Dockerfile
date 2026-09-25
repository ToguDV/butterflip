FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @flashcards/shared build
RUN pnpm --filter server db:generate

WORKDIR /app/apps/server

EXPOSE 4000

CMD ["pnpm", "dev"]
