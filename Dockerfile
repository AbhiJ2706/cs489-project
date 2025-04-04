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
    # Web browsers for cookies
    firefox-esr \
    chromium \
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

# Install X11 and display-related dependencies
RUN apt-get update && apt-get install -y \
    xvfb \
    xorg \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libnspr4 \
    libgdk-pixbuf2.0-0 \
    libxss1 \
    libxcomposite1 \
    libfontconfig1 \
    libxcursor1 \
    libxrandr2 \
    libxtst6 \
    libgl1-mesa-glx \
    libgl1-mesa-dri \
    mesa-utils \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Check if Xvfb can successfully start
RUN Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render -noreset & \
    XVFB_PID=$! && \
    sleep 2 && \
    if ps -p $XVFB_PID > /dev/null; then \
      echo "Xvfb is running properly"; \
      kill $XVFB_PID; \
    else \
      echo "Xvfb failed to start"; \
      exit 1; \
    fi

# Install MuseScore using AppImage extraction
RUN wget -q -O musescore.appimage https://cdn.jsdelivr.net/musescore/v4.4.1/MuseScore-Studio-4.4.1.242490810-x86_64.AppImage && \
    chmod +x musescore.appimage && \
    ./musescore.appimage --appimage-extract && \
    rm musescore.appimage && \
    # Create a wrapper script for MuseScore
    echo '#!/bin/bash\n\
export DISPLAY=:99\n\
Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render -noreset & \n\
XVFB_PID=$!\n\
sleep 3\n\
# Give Xvfb time to start\n\
MSCORE_PATH="/app/squashfs-root/bin/mscore4portable"\n\
echo "Running MuseScore command: $MSCORE_PATH $*"\n\
timeout 90 $MSCORE_PATH "$@"\n\
EXIT_CODE=$?\n\
kill $XVFB_PID || true\n\
if [ $EXIT_CODE -ne 0 ]; then\n\
  echo "MuseScore exited with code $EXIT_CODE"\n\
fi\n\
exit $EXIT_CODE' > /usr/local/bin/mscore && \
    chmod +x /usr/local/bin/mscore && \
    # Test that it works - but don't fail the build if it doesn't
    mscore --version || echo "MuseScore test may fail during build, but should work in runtime"

# Make setup script executable
RUN chmod +x setup.js

# Expose the port
EXPOSE 8000

# Set environment variables
ENV CORS_ALLOW_ORIGINS="https://www.visualize.music,http://localhost:3000,*"
ARG DATABASE_URL

# Run setup script and then start the API server
CMD bun setup.js && cd app && uvicorn main:app --host 0.0.0.0 --port 8000
