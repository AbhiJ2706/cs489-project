FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for sound libraries
RUN apt-get update && apt-get install -y \
    fluidsynth \
    libsndfile1 \
    ffmpeg \
    curl \
    unzip \
    wget \
    # Build tools
    build-essential \
    gcc \
    python3-dev \
    # Additional audio dependencies
    libsndfile1-dev \
    libasound2-dev \
    libportaudio2 \
    libportaudiocpp0 \
    portaudio19-dev \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswresample-dev \
    # PostgreSQL development packages
    postgresql-client \
    libpq-dev \
    # Dependencies for MuseScore
    xvfb \
    libopengl0 \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash 
ENV PATH="/root/.bun/bin:${PATH}"

# Create app directory and copy backend
RUN mkdir -p /app/backend
WORKDIR /app/backend
COPY backend/ .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install MuseScore using AppImage extraction
RUN wget -q -O musescore.appimage https://cdn.jsdelivr.net/musescore/v4.4.1/MuseScore-Studio-4.4.1.242490810-x86_64.AppImage && \
    chmod +x musescore.appimage && \
    ./musescore.appimage --appimage-extract && \
    rm musescore.appimage && \
    # Create a wrapper script for MuseScore
    echo '#!/bin/bash\n\
timeout 60 xvfb-run -s "-screen 0 640x480x24 -ac +extension GLX +render -noreset" \
squashfs-root/bin/mscore4portable "$@"' > /usr/local/bin/mscore && \
    chmod +x /usr/local/bin/mscore && \
    # Test that it works
    mscore --version

# Make setup script executable
RUN chmod +x setup.js

# Expose the port
EXPOSE 8000

# Set environment variables
ENV CORS_ALLOW_ORIGINS="https://www.visualize.music,http://localhost:3000,*"

# Run setup script and then start the API server
CMD bun setup.js && uvicorn app.main:app --host 0.0.0.0 --port 8000
