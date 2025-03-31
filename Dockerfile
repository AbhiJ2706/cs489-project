FROM python:3.9-slim

WORKDIR /app

# Install system dependencies for sound libraries
RUN apt-get update && apt-get install -y \
    fluidsynth \
    libsndfile1 \
    ffmpeg \
    curl \
    unzip \
    software-properties-common \
    && add-apt-repository ppa:mscore-ubuntu/mscore-stable \
    && apt-get update \
    && apt-get install -y musescore4 \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash 
ENV PATH="/root/.bun/bin:${PATH}"

# Copy requirements file
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Make setup script executable
RUN chmod +x setup.js

# Expose the port
EXPOSE 8000

# Run setup script and then start the API server
CMD bun setup.js && uvicorn api:app --host 0.0.0.0 --port 8000
