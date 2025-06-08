# Use Node.js LTS version
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

# Set working directory
WORKDIR /app

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Expose the port your app runs on
EXPOSE 3000

# Start the application from dist folder
CMD ["node", "dist/src/index.js"] 