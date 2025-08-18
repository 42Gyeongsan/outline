# ==============================================================================
# === Stage 1: Build the application from local source (was Dockerfile.base) ===
# ==============================================================================
ARG APP_PATH=/opt/outline
FROM node:20 AS builder

# Set build-time arguments
ARG APP_PATH
ARG CDN_URL

WORKDIR $APP_PATH

# Install system dependencies
RUN apt-get update && apt-get install -y cmake

# Set Node options for the build process
ENV NODE_OPTIONS="--max-old-space-size=24000"

# Copy dependency manifests and patches, then install ALL dependencies for building
COPY ./package.json ./yarn.lock ./
COPY ./patches ./patches
RUN yarn install --no-optional --frozen-lockfile --network-timeout 1000000 && \
    yarn cache clean

# Copy your entire local source code (including your new feature)
COPY . .

# Build the application
RUN yarn build

# Clean up dev dependencies and reinstall only production dependencies
RUN rm -rf node_modules
RUN yarn install --production=true --frozen-lockfile --network-timeout 1000000 && \
    yarn cache clean

# ==============================================================================
# === Stage 2: Create the final, slim runner image (was Dockerfile)          ===
# ==============================================================================
FROM node:22-slim AS runner

LABEL org.opencontainers.image.source="https://github.com/42Gyeongsan/outline"

ARG APP_PATH
WORKDIR $APP_PATH
ENV NODE_ENV=production
ENV PORT=3000

# Copy built application and production dependencies from the 'builder' stage
COPY --from=builder $APP_PATH/build ./build
COPY --from=builder $APP_PATH/server ./server
COPY --from=builder $APP_PATH/public ./public
COPY --from=builder $APP_PATH/.sequelizerc ./.sequelizerc
COPY --from=builder $APP_PATH/node_modules ./node_modules
COPY --from=builder $APP_PATH/package.json ./package.json

# Install wget for the healthcheck
RUN apt-get update \
    && apt-get install -y wget \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN addgroup --gid 1001 nodejs && \
    adduser --uid 1001 --ingroup nodejs nodejs && \
    chown -R nodejs:nodejs $APP_PATH/build && \
    mkdir -p /var/lib/outline && \
    chown -R nodejs:nodejs /var/lib/outline

# Create and set permissions for local file storage
ENV FILE_STORAGE_LOCAL_ROOT_DIR=/var/lib/outline/data
RUN mkdir -p "$FILE_STORAGE_LOCAL_ROOT_DIR" && \
    chown -R nodejs:nodejs "$FILE_STORAGE_LOCAL_ROOT_DIR" && \
    chmod 1777 "$FILE_STORAGE_LOCAL_ROOT_DIR"

VOLUME /var/lib/outline/data

# Switch to the non-root user
USER nodejs

# Configure healthcheck and expose port
HEALTHCHECK --interval=1m CMD wget -qO- "http://localhost:${PORT:-3000}/_health" | grep -q "OK" || exit 1
EXPOSE 3000

# Set the default command to start the application
CMD ["yarn", "start"]
