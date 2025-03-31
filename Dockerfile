FROM python:3.9-slim

WORKDIR /app

# Install system dependencies for sound libraries
RUN apt-get update && apt-get install -y \
    fluidsynth \
    libsndfile1 \
    ffmpeg \
    curl \
    unzip \
    wget \
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
    && rm -rf /var/lib/apt/lists/*

# Download and install MuseScore
RUN apt-get update && apt-get install -y \
    libfreetype6 \
    libfontconfig1 \
    libx11-6 \
    libxext6 \
    libxcb1 \
    libgl1 \
    libasound2 \
    && wget -q https://github.com/musescore/MuseScore/releases/download/v4.5.1/MuseScore-Studio-4.5.1.250800846-x86_64.AppImage -O /usr/local/bin/musescore \
    && chmod +x /usr/local/bin/musescore \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash 
ENV PATH="/root/.bun/bin:${PATH}"

# Copy requirements file
COPY requirements.txt ./
COPY audio-requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r audio-requirements.txt

# Copy source code
COPY . .

# Make setup script executable
RUN chmod +x setup.js

# Expose the port
EXPOSE 8000

# Run setup script and then start the API server
CMD bun setup.js && uvicorn api:app --host 0.0.0.0 --port 8000
