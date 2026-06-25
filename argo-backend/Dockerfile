FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.2.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod --network-concurrency 2

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV TZ=America/Bogota
EXPOSE 3000

CMD ["node", "src/server.js"]
