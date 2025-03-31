#!/usr/bin/env bun

// Simple Bun script to process audio and generate sheet music
const { spawnSync } = require("child_process");
const { existsSync, mkdirSync } = require("fs");
const { join } = require("path");

function runCommand(command) {
  console.log(`Running: ${command}`);
  const [cmd, ...args] = command.split(" ");
  const result = spawnSync(cmd, args, { stdio: "inherit" });

  if (result.status !== 0) {
    console.error(`Command failed with exit code: ${result.status}`);
    return false;
  }
  return true;
}

// Main execution
console.log("Starting audio processing pipeline...");

// Install Python dependencies from requirements.txt
console.log("Installing Python dependencies from requirements.txt...");
runCommand("pip install -r requirements.txt");

// Download and extract FluidR3_GM soundfont if it doesn't exist
if (!existsSync("FluidR3_GM.sf2")) {
  console.log("Downloading FluidR3_GM soundfont...");
  runCommand(
    "curl -L -o FluidR3_GM.zip https://keymusician01.s3.amazonaws.com/FluidR3_GM.zip"
  );
  console.log("Extracting FluidR3_GM soundfont...");
  runCommand("unzip -o FluidR3_GM.zip");
  console.log("Cleaning up zip file...");
  runCommand("rm FluidR3_GM.zip");
}

// Generate MusicXML from WAV
runCommand("python wav_to_sheet_music.py test-input-10sec.wav output.musicxml");

// Generate PDF from MusicXML
runCommand(
  "python wav_to_sheet_music.py test-input-10sec.wav output.musicxml --pdf output.pdf"
);

// Convert MusicXML back to WAV for playback
console.log("Converting MusicXML back to WAV for playback...");
runCommand("python musicxml_to_wav.py output.musicxml output_synthesized.wav");

console.log("Process completed!");
