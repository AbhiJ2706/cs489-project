import { init, id, tx } from "@instantdb/react";
import schema from "../instant.schema";

// Initialize InstantDB - only if APP_ID is available
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "";
const db = APP_ID ? init({ appId: APP_ID, schema }) : null;

/**
 * Result of a file upload operation
 */
export interface UploadedFileResult {
  documentId: string;
  fileId: string; // ID of the $files entity
  name: string;
  storagePath: string;
  mimeType?: string;
}

/**
 * Uploads files using InstantDB's storage system
 * - Handles file validation
 * - Uploads to InstantDB storage
 * - Creates document entries
 *
 * @param files Array of files to upload
 * @returns Promise resolving to array of created documents
 */
export const uploadFilesToInstant = async (
  files: File[]
): Promise<UploadedFileResult[]> => {
  if (!db) {
    throw new Error("InstantDB not initialized");
  }

  const results: UploadedFileResult[] = [];

  for (const file of files) {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");

    try {
      // Audio processing
      if (
        file.type.startsWith("audio/") ||
        file.name.endsWith(".mp3") ||
        file.name.endsWith(".wav")
      ) {
        const storagePath = `uploads/audio/${timestamp}-${safeName}`;

        console.log(`[Upload] Audio ${file.name} -> ${storagePath}`);

        // Upload to InstantDB storage
        const uploadResult = await db.storage.uploadFile(storagePath, file);

        const {
          data: { id: fileId },
        } = uploadResult;

        console.log(`[Upload] Actual Upload result:`, uploadResult);

        // Create file entry and audio record
        const audioId = id();
        // You can't update $files in a transaction, but you can link to them
        await db.transact([
          tx.audio[audioId]
            .update({
              storagePath: storagePath,
            })
            .link({
              $files: fileId, // Link to the file
            }),
        ]);

        results.push({
          documentId: audioId,
          fileId: fileId,
          name: file.name,
          storagePath: storagePath,
          mimeType: file.type,
        });
      }
      // PDF files
      else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const storagePath = `uploads/pdfs/${timestamp}-${safeName}`;

        console.log(`[Upload] PDF ${file.name} -> ${storagePath}`);
        const uploadResult = await db.storage.uploadFile(storagePath, file);

        const {
          data: { id: fileId },
        } = uploadResult;

        // Create file entry and link to sheet
        const sheetId = id();
        // You can't update $files in a transaction, but you can link to them
        await db.transact([
          tx.sheet[sheetId]
            .update({
              title: file.name,
              storagePath: storagePath,
            })
            .link({
              $files: fileId, // Link to the file
            }),
        ]);

        results.push({
          documentId: sheetId,
          fileId: fileId,
          name: file.name,
          storagePath: storagePath,
          mimeType: file.type,
        });
      } else {
        throw new Error(`Unsupported file type: ${file.type}`);
      }
    } catch (error) {
      console.error(`[Upload] Error uploading ${file.name}:`, error);
      throw error;
    }
  }

  return results;
};

/**
 * Get stored file by its storage path
 *
 * @param storagePath The storage path of the file to retrieve
 * @returns The file information or null if not found
 */
export const getFileByPath = async (storagePath: string) => {
  if (!db) {
    throw new Error("InstantDB not initialized");
  }

  try {
    const { data } = await db.useQuery({
      $files: {
        $: {
          where: {
            path: storagePath,
          },
        },
      },
    });

    return data.$files[0] || null;
  } catch (error) {
    console.error(`[Storage] Error getting file for ${storagePath}:`, error);
    throw error;
  }
};

/**
 * Store a remote audio file into InstantDB from a URL
 * Downloads the file content and stores it in InstantDB storage
 *
 * @param audioUrl URL of the audio to download
 * @param filename Name to give the stored file
 * @param conversionId Optional ID to link the audio to a conversion
 */
export const uploadDocumentFromUrl = async (
  audioUrl: string,
  filename: string,
  conversionId?: string
): Promise<UploadedFileResult[] | null> => {
  if (!db) {
    throw new Error("InstantDB not initialized");
  }

  console.log(`[InstantDB] Starting to store audio from URL: ${audioUrl}`);
  console.log(`[InstantDB] Target filename: ${filename}`);

  try {
    // 1. Fetch the audio from the URL
    console.log(`[InstantDB] Fetching audio content from URL...`);
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    // 2. Convert to blob/file
    console.log(`[InstantDB] Converting response to blob...`);
    const audioBlob = await response.blob();
    console.log(
      `[InstantDB] Blob size: ${(audioBlob.size / 1024).toFixed(2)} KB, type: ${
        audioBlob.type || "audio/wav"
      }`
    );

    const audioFile = new File([audioBlob], filename, {
      type: audioBlob.type || "audio/wav",
    });

    // 3. Upload to InstantDB
    console.log(`[InstantDB] Uploading audio to InstantDB storage...`);
    const results = await uploadFilesToInstant([audioFile]);
    console.log(`[InstantDB] Upload results:`, results);
    if (results.length === 0) {
      throw new Error("Upload failed: No results returned");
    }

    console.log(`[InstantDB] Upload successful: ${results[0].storagePath}`);

    // 4. Link to conversion if specified
    if (conversionId) {
      try {
        console.log(
          `[InstantDB] Processing ${results.length} result(s) for conversion: ${conversionId}`
        );

        // Process each result
        for (const result of results) {
          console.log(
            `[InstantDB] Processing file: ${result.name} (${result.documentId})`
          );

          // First update the conversion with metadata in a separate transaction
          try {
            await db.transact([
              tx.conversions[conversionId].update({
                storagePath: result.storagePath,
                fileName: result.name,
              }),
            ]);
            console.log(`[InstantDB] Updated conversion metadata successfully`);
          } catch (metaError) {
            console.error(
              `[InstantDB] Error updating conversion metadata:`,
              metaError
            );
            // Continue to try linking anyway
          }

          // Determine the document type based on file type and link appropriately
          console.log(`[InstantDB] Checking file type for: ${result.name}`);
          console.log(
            `[InstantDB] File details - mimeType: ${
              result.mimeType || "unknown"
            }, documentId: ${result.documentId}, fileId: ${result.fileId}`
          );

          const isAudioFile =
            result.mimeType?.includes("audio") ||
            result.name.endsWith(".mp3") ||
            result.name.endsWith(".wav");

          console.log(
            `[InstantDB] File type detection - isAudioFile: ${isAudioFile}`
          );

          if (isAudioFile) {
            console.log(
              `[InstantDB] Linking audio entity to conversion: ${conversionId} -> ${result.documentId}`
            );
            console.log(
              `[InstantDB] Audio document ID: ${result.documentId}, Type: ${
                result.mimeType || "unknown type"
              }, Name: ${result.name}`
            );
            // Link to audio entity
            try {
              // Link audio entity in a separate, simple transaction
              await db.transact([
                tx.conversions[conversionId].link({
                  audio: result.documentId,
                }),
              ]);
              console.log(`[InstantDB] Audio link created successfully`);
            } catch (audioLinkError) {
              console.error(`[InstantDB] Error linking audio:`, audioLinkError);
            }
          } else if (
            result.mimeType === "application/pdf" ||
            result.name.endsWith(".pdf")
          ) {
            console.log(
              `[InstantDB] Linking sheet entity to conversion: ${conversionId} -> ${result.documentId}`
            );
            console.log(
              `[InstantDB] Sheet document ID: ${result.documentId}, Type: ${
                result.mimeType || "unknown type"
              }, Name: ${result.name}`
            );
            // Link to sheet entity
            try {
              // Link sheet entity in a separate, simple transaction
              await db.transact([
                tx.conversions[conversionId].link({
                  sheet: result.documentId,
                }),
              ]);
              console.log(`[InstantDB] Sheet link created successfully`);
            } catch (sheetLinkError) {
              console.error(`[InstantDB] Error linking sheet:`, sheetLinkError);
            }
          } else {
            // Still link to the file as fallback
            console.log(
              `[InstantDB] Linking file directly to conversion: ${conversionId} -> ${result.fileId}`
            );
            console.log(
              `[InstantDB] Generic file ID: ${result.fileId}, Type: ${
                result.mimeType || "unknown type"
              }, Name: ${result.name}`
            );
            try {
              // Link file directly in a separate, simple transaction
              await db.transact([
                tx.conversions[conversionId].link({
                  $files: result.fileId,
                }),
              ]);
              console.log(`[InstantDB] File link created successfully`);
            } catch (fileLinkError) {
              console.error(`[InstantDB] Error linking file:`, fileLinkError);
            }
          }
        }

        console.log(`[InstantDB] Conversion linking completed successfully`);
      } catch (updateError) {
        console.error(
          `[InstantDB] Error linking conversion with entities:`,
          updateError
        );
        // Continue without failing - we already have the file stored
      }
    }

    console.log(
      `[InstantDB] storage complete: ${results
        .map((r) => r.storagePath)
        .join(", ")}`
    );
    return results;
  } catch (error) {
    console.error(
      `[InstantDB] Error storing audio from URL ${audioUrl}:`,
      error
    );
    return null;
  }
};

export default db;
