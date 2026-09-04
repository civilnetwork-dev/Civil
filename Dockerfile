FROM oven/bun:latest AS builder

# Debian (glibc), not alpine: obscura-rs only ships prebuilt native addons for
# macOS and Linux glibc (see node_modules/obscura-rs/README.md) — musl can't
# dlopen them, and there's no local crate source here to cross-compile a musl
# build from (the Rust source lives in the separate Crash0v3rrid3/obscura
# repo). bash/libstdc++/libgcc already ship in this base image, unlike on
# alpine, so only curl (rustup) and build-essential (native rebuilds) are
# needed here.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

COPY package.json bun.lock ./
COPY patches/ ./patches/
RUN bun install --frozen-lockfile

COPY . .

# Opt-in only (see misc/obfuscateAssets.ts and misc/obfuscatti/README.md):
# defaults to obscura-rs, unchanged from before this arg existed. Building
# misc/obfuscatti's native binding here, from source, rather than copying in
# a prebuilt one, is what makes it match *this* image's platform -- a
# binding built on the host machine (Windows) can't load in a Linux
# container. Zig is a single self-contained tarball, no package manager
# involved, same reasoning as installing rustup via curl above.
ARG OBFUSCATE_ENGINE=obscura
ENV OBFUSCATE_ENGINE=${OBFUSCATE_ENGINE}
RUN if [ "$OBFUSCATE_ENGINE" = "obfuscatti" ]; then \
        curl -sSfL https://ziglang.org/download/0.16.0/zig-x86_64-linux-0.16.0.tar.xz -o /tmp/zig.tar.xz && \
        tar -xf /tmp/zig.tar.xz -C /usr/local && \
        rm /tmp/zig.tar.xz && \
        cd misc/obfuscatti && /usr/local/zig-x86_64-linux-0.16.0/zig build && cd /app; \
    fi

RUN bun run build:wisp-native

# tests/ is safe to delete: bench_results.json is imported at build time by
# src/routes/benchmarks.tsx, so the data is already baked into dist/.
RUN ./build.sh && rm -rf tests node_modules/.cache misc/wisp/native/target

# Drop devDependencies now that the build is done. Done in the builder (which
# has build-essential + rust) rather than the runtime stage, so any dependency
# that needs recompiling can still find a compiler.
RUN bun install --frozen-lockfile --production

FROM oven/bun:latest

# bash/libstdc++/libgcc are already in this image; wget is the only thing
# docker-compose.yml's healthcheck needs that isn't preinstalled (alpine's
# busybox provided it for free, this base doesn't).
RUN apt-get update && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app /app

ENV REVERSE_PROXY=true

EXPOSE 9876

CMD ["sh", "-c", "bun run db:migrate && bun run start"]