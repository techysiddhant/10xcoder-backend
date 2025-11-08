# Use Node.js LTS version
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies
RUN pnpm install

# Copy the rest of the source code
COPY . .

# Change ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root
USER nextjs

# 🧠 Increase heap memory limit just for build step
ENV NODE_OPTIONS=--max-old-space-size=2048

# Build the app
RUN pnpm build

# Optional: Switch back to root to prune devDependencies
USER root
RUN pnpm prune --prod --no-scripts
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Expose app port
EXPOSE 3000

# Start the app
CMD ["node", "dist/src/index.js"]
