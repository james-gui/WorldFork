FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files for dependency installation
COPY apps/web/package.json ./
COPY apps/web/pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy rest of app
COPY apps/web/ ./

EXPOSE 3000

CMD ["pnpm", "dev"]
