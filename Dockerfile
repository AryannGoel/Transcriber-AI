# Use official Node.js image as base
FROM node:20-slim

# Install system dependencies: python3, pip, and ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm ci

# Copy requirements.txt and install Python dependencies
COPY requirements.txt ./
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy all application code
COPY . .

# Build Vite frontend and esbuild server
RUN npm run build

# Expose port (Render sets PORT env, but 3000 is default)
EXPOSE 3000

# Start command
CMD ["npm", "start"]
