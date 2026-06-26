FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.2.2 --activate

ENV NODE_OPTIONS=--max-old-space-size=3072

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --network-concurrency 2

COPY . .

ARG PORTAL_BUILD_ID=unknown
RUN printf '%s\n' "$PORTAL_BUILD_ID" > public/portal-build-marker.txt

RUN pnpm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/argo-aula-virtual/browser /usr/share/nginx/html

EXPOSE 80
