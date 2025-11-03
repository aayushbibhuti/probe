# Stage 1: Build / Install dependencies
FROM node:20.18.1-alpine3.20 AS builder


WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (dev + prod)
RUN npm install

# Copy application source code
COPY . .

# Stage 2: Production image
# Stage 1: Builder
FROM node:20.18.1-alpine3.20 AS builder

# Keep system packages secure
RUN apk upgrade --no-cache

WORKDIR /usr/src/app

# Copy dependency files first for better layer caching
COPY package*.json ./

# Install all dependencies (including dev for building)
RUN npm ci

# Copy rest of the source code
COPY . .

# Build the app (if applicable, e.g., React/Vue/Next)
# RUN npm run build


# Stage 2: Production
FROM node:20.18.1-alpine3.20 AS production

# Update Alpine base packages to fix known CVEs
RUN apk upgrade --no-cache

WORKDIR /usr/src/app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy the built app or source code from builder
COPY --from=builder /usr/src/app ./

# Set secure environment
ENV NODE_ENV=production

# Drop root privileges (use non-root Node user)
USER node

EXPOSE 3000

# Start the server
CMD ["node", "server.js"]


# Stage 3: Development image (optional)
FROM node:20.18.1-alpine3.20 AS development

WORKDIR /usr/src/app

# Copy everything from builder
COPY --from=builder /usr/src/app ./

# Set environment variables
ENV NODE_ENV=development
EXPOSE 3000

# Start the server with nodemon for live reload
CMD ["npm", "run", "dev"]
