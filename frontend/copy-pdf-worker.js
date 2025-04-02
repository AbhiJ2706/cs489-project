import path from "node:path";
import fs from "node:fs";

// Find react-pdf's node_modules directory
const reactPdfNodeModules = path.join(
  path.dirname(require.resolve("react-pdf/package.json")),
  "node_modules"
);

// Get worker directly from the known path
const pdfWorkerPath = path.join(
  reactPdfNodeModules,
  "pdfjs-dist",
  "build", 
  "pdf.worker.min.mjs"
);
const targetPath = "./public/pdf.worker.min.mjs";

console.log(`Copying from: ${pdfWorkerPath}`);
console.log(`To: ${targetPath}`);

try {
  fs.cpSync(pdfWorkerPath, targetPath, { recursive: true });
  console.log("PDF worker successfully copied!");
} catch (error) {
  console.error("Error copying PDF worker:", error);
  process.exit(1);
}
