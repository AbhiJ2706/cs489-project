FROM python:3.9-slim

WORKDIR /app

# Install system dependencies for sound libraries
RUN apt-get update && apt-get install -y \
    fluidsynth \
    libsndfile1 \
    ffmpeg \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Download the soundfont if needed
RUN if [ ! -f "FluidR3_GM.sf2" ]; then \
    curl -L -o FluidR3_GM.zip https://keymusician01.s3.amazonaws.com/FluidR3_GM.zip && \
    unzip -o FluidR3_GM.zip && \
    rm FluidR3_GM.zip; \
    fi

# Expose the port
EXPOSE 8000

# Run the API server
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
