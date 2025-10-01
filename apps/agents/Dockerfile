# Multi-stage Dockerfile for agents application in monorepo
# Run from the root of the project: docker build -f apps/agents/Dockerfile.monorepo .

# Use a more secure base image
FROM node:20-alpine AS base

# Install security updates and build dependencies
RUN apk update && apk upgrade && apk add --no-cache g++ make python3

# Set working directory
WORKDIR /app

# Copy root package files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
COPY turbo.json ./

# Copy shared packages
COPY packages/ ./packages/

# Copy agents app package.json
COPY apps/agents/package.json ./apps/agents/

# Install dependencies for the entire monorepo
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
    else yarn install; fi

# Development stage
FROM base AS development

# Copy the entire source code
COPY . .

# Set working directory to agents app
WORKDIR /app/apps/agents

# Expose the port
EXPOSE 54367

# Command for development
CMD ["yarn", "dev"]

# Build stage
FROM base AS build

# Copy source code
COPY . .

# Set working directory to agents app
WORKDIR /app/apps/agents

# Build the application
RUN yarn build

# Production stage
FROM node:20-alpine AS production

# Install security updates and only runtime dependencies
RUN apk update && apk upgrade && apk add --no-cache python3

# Set working directory
WORKDIR /app

# Copy built application and necessary files
COPY --from=build /app/apps/agents/dist ./dist
COPY --from=build /app/apps/agents/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/langgraph.json ./langgraph.json
COPY --from=build /app/apps/agents/templates ./templates
COPY --from=build /app/apps/agents/resources ./resources

# Create non-root user and change ownership
RUN addgroup -g 1001 -S nodejs && \
    adduser -S opencanvas -u 1001 && \
    chown -R opencanvas:nodejs /app

USER opencanvas

# Expose port
EXPOSE 54367

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# Start the application
CMD ["node", "dist/index.js"]
