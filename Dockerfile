FROM oven/bun:alpine AS builder

RUN apk add --no-cache bash gcompat libstdc++ libgcc curl build-base
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

COPY package.json bun.lock ./
COPY patches/ ./patches/
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build:wisp-native

# tests/ is safe to delete: bench_results.json is imported at build time by
# src/routes/benchmarks.tsx, so the data is already baked into dist/.
RUN ./build.sh && rm -rf tests node_modules/.cache misc/wisp/native/target

# Drop devDependencies now that the build is done. Done in the builder (which
# has build-base + rust) rather than the runtime stage, so any dependency that
# needs recompiling can still find a compiler.
RUN bun install --frozen-lockfile --production

FROM oven/bun:alpine

RUN apk add --no-cache bash gcompat libstdc++ libgcc

WORKDIR /app

COPY --from=builder /app /app

ENV REVERSE_PROXY=true

EXPOSE 9876

CMD ["sh", "-c", "bun run db:migrate && bun run start"]