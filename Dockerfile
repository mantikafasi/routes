FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* pnpm-lock.yaml* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Run the application
CMD ["bun", "start"]
