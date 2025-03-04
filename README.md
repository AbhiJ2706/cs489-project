# DaScore

This application converts WAV audio files to sheet music in MusicXML and PDF formats.

## Features

- Upload WAV audio files
- Play uploaded audio files
- Convert audio to sheet music
- Preview generated sheet music (PDF and interactive MusicXML)
- Download MusicXML and PDF files
- Interactive browser-based MusicXML viewer

## Tech Stack

### Frontend
- React with TypeScript
- Next.js App Router
- Shadcn UI components
- Tailwind CSS
- OpenSheetMusicDisplay for browser-based MusicXML rendering

### Backend
- FastAPI
- Librosa for audio processing
- Music21 for sheet music generation

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 18+
- npm or yarn
- MuseScore or LilyPond (optional, for PDF generation)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install Python dependencies:
   ```bash
   pip install -e .
   pip install -r requirements.txt
   ```

3. Install frontend dependencies:
   ```bash
   cd dascore
   npm install
   ```

4. (Optional) Install MuseScore or LilyPond for PDF generation:
   - MuseScore: https://musescore.org/en/download
   - LilyPond: https://lilypond.org/download.html

### Running the Application

1. Start the backend server:
   ```bash
   python -m src.cs489_project.run_api
   ```
   The script will check if MuseScore or LilyPond is installed and provide instructions if needed.

2. In a separate terminal, start the frontend development server:
   ```bash
   cd dascore
   npm run dev
   ```

3. Open your browser and navigate to http://localhost:3000

## Usage

1. Upload a WAV file using the file upload component
2. Play the audio to verify it's the correct file
3. Click "Convert to Sheet Music" to process the audio
4. Once conversion is complete, preview the sheet music
5. Download the MusicXML and/or PDF files
6. Click "View Sheet Music in Browser" to open the interactive MusicXML viewer in a new tab

## Interactive MusicXML Viewer

The application includes a browser-based MusicXML viewer powered by OpenSheetMusicDisplay. This allows you to:

- View the generated sheet music directly in your browser
- See the full score with proper notation
- Access the sheet music even if PDF generation fails
- Download the MusicXML file from the viewer page

## Notes

- The application supports WAV files up to 100MB in size
- The conversion process may take some time depending on the file size and complexity
- All uploaded and converted files are automatically deleted when you refresh the page or close the application
- PDF generation requires MuseScore or LilyPond to be installed on the server
- If neither MuseScore nor LilyPond is installed, the application will still generate MusicXML files, but PDF generation will be disabled