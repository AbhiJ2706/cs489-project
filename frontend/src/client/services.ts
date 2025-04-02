import type { CancelablePromise } from './core/CancelablePromise';
import { OpenAPI } from './core/OpenAPI';
import { request as __request } from './core/request';

import type { Body_convert_audio_convert_post,ConversionResult,GenericUrl,SpotifyUrl,YouTubeUrl } from './models';

export type HomeData = {
        
    }

export type ConversionData = {
        ConvertAudioConvertPost: {
                    formData: Body_convert_audio_convert_post
title?: string | null
                    
                };
ConvertYoutubeConvertYoutubePost: {
                    requestBody: YouTubeUrl
                    
                };
ConvertSpotifyConvertSpotifyPost: {
                    requestBody: SpotifyUrl
                    
                };
ConvertUrlConvertUrlPost: {
                    requestBody: GenericUrl
                    
                };
    }

export type FilesData = {
        DownloadFileDownloadFileTypeFileIdGet: {
                    fileId: string
fileType: string
                    
                };
PreviewPdfPreviewFileIdGet: {
                    fileId: string
                    
                };
GetMusicxmlContentMusicxmlContentFileIdGet: {
                    fileId: string
                    
                };
GetFileFilesFileIdGet: {
                    fileId: string
type?: string
                    
                };
DeleteFilesFilesFileIdDelete: {
                    fileId: string
                    
                };
CheckFilesCheckFilesFileIdGet: {
                    fileId: string
                    
                };
    }

export type AudioData = {
        SynthesizeAudioSynthesizeFileIdGet: {
                    fileId: string
                    
                };
GetAudioAudioFileIdGet: {
                    fileId: string
                    
                };
GetOriginalAudioUploadsFileIdGet: {
                    fileId: string
                    
                };
    }

export class HomeService {

	/**
	 * Home
	 * API home page.
 * 
 * Returns:
 * dict: Basic information about the API
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static homeGet(): CancelablePromise<unknown> {
				return __request(OpenAPI, {
			method: 'GET',
			url: '/',
		});
	}

}

export class ConversionService {

	/**
	 * Convert Audio
	 * Convert uploaded WAV file to sheet music (MusicXML and PDF).
 * 
 * Args:
 * file: The WAV file to convert
 * title: Optional title for the sheet music
 * 
 * Returns:
 * ConversionResult: File ID and status message
	 * @returns ConversionResult Successful Response
	 * @throws ApiError
	 */
	public static convertAudioConvertPost(data: ConversionData['ConvertAudioConvertPost']): CancelablePromise<ConversionResult> {
		const {
			formData,
			title,
		} = data;
		
		// Create a plain object with file and optional title
		// The client library will convert this to FormData internally
		const formDataObj: Record<string, unknown> = {
			file: formData.file
		};
		
		// Add title if provided
		if (title) {
			formDataObj.title = title;
		}
		
		return __request(OpenAPI, {
			method: 'POST',
			url: '/convert',
			formData: formDataObj,
			mediaType: 'multipart/form-data',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Convert Youtube
	 * Download audio from a YouTube URL, convert to WAV, and generate sheet music.
 * 
 * Args:
 * youtube_data: The YouTube URL to process
 * 
 * Returns:
 * ConversionResult: File ID and status message
	 * @returns ConversionResult Successful Response
	 * @throws ApiError
	 */
	public static convertYoutubeConvertYoutubePost(data: ConversionData['ConvertYoutubeConvertYoutubePost']): CancelablePromise<ConversionResult> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/convert-youtube',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Convert Spotify
	 * Download audio from a Spotify URL, convert to WAV, and generate sheet music.
 * 
 * Args:
 * spotify_data: The Spotify URL to process
 * 
 * Returns:
 * ConversionResult: File ID and status message
	 * @returns ConversionResult Successful Response
	 * @throws ApiError
	 */
	public static convertSpotifyConvertSpotifyPost(data: ConversionData['ConvertSpotifyConvertSpotifyPost']): CancelablePromise<ConversionResult> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/convert-spotify',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Convert Url
	 * Auto-detect URL type (YouTube or Spotify) and process accordingly.
 * 
 * Args:
 * url_data: The URL to process and optional title
 * 
 * Returns:
 * ConversionResult: File ID and status message
	 * @returns ConversionResult Successful Response
	 * @throws ApiError
	 */
	public static convertUrlConvertUrlPost(data: ConversionData['ConvertUrlConvertUrlPost']): CancelablePromise<ConversionResult> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/convert-url',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export class FilesService {

	/**
	 * Download File
	 * Download a converted file.
 * 
 * Args:
 * file_type: Type of file to download (musicxml or pdf)
 * file_id: ID of the file to download
 * 
 * Returns:
 * FileResponse: The requested file
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static downloadFileDownloadFileTypeFileIdGet(data: FilesData['DownloadFileDownloadFileTypeFileIdGet']): CancelablePromise<unknown> {
		const {
fileType,
fileId,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/download/{file_type}/{file_id}',
			path: {
				file_type: fileType, file_id: fileId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Preview Pdf
	 * Get the PDF file for preview.
 * 
 * Args:
 * file_id: ID of the PDF file to preview
 * 
 * Returns:
 * FileResponse: The PDF file
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static previewPdfPreviewFileIdGet(data: FilesData['PreviewPdfPreviewFileIdGet']): CancelablePromise<unknown> {
		const {
fileId,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/preview/{file_id}',
			path: {
				file_id: fileId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Get Musicxml Content
	 * Get the MusicXML content for browser rendering.
 * 
 * Args:
 * file_id: ID of the MusicXML file
 * 
 * Returns:
 * Response: The MusicXML content as text/xml
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static getMusicxmlContentMusicxmlContentFileIdGet(data: FilesData['GetMusicxmlContentMusicxmlContentFileIdGet']): CancelablePromise<unknown> {
		const {
fileId,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/musicxml-content/{file_id}',
			path: {
				file_id: fileId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Get File
	 * Download a file by ID with file type specified as a query parameter.
 * 
 * Args:
 * file_id: ID of the file to download
 * type: Type of file to download (musicxml or pdf)
 * 
 * Returns:
 * FileResponse: The requested file
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static getFileFilesFileIdGet(data: FilesData['GetFileFilesFileIdGet']): CancelablePromise<unknown> {
		const {
fileId,
type,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/files/{file_id}',
			path: {
				file_id: fileId
			},
			query: {
				type
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Delete Files
	 * Delete all files associated with a conversion.
 * 
 * Args:
 * file_id: ID of the files to delete
 * 
 * Returns:
 * dict: Status message
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static deleteFilesFilesFileIdDelete(data: FilesData['DeleteFilesFilesFileIdDelete']): CancelablePromise<unknown> {
		const {
fileId,
} = data;
		return __request(OpenAPI, {
			method: 'DELETE',
			url: '/files/{file_id}',
			path: {
				file_id: fileId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Check Files
	 * Check which files are available for a given file ID.
 * 
 * Args:
 * file_id: ID of the files to check
 * 
 * Returns:
 * dict: Available files
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static checkFilesCheckFilesFileIdGet(data: FilesData['CheckFilesCheckFilesFileIdGet']): CancelablePromise<unknown> {
		const {
fileId,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/check-files/{file_id}',
			path: {
				file_id: fileId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export class AudioService {

	/**
	 * Synthesize Audio
	 * Synthesize audio from MusicXML to WAV.
 * 
 * Args:
 * file_id: ID of the MusicXML file
 * 
 * Returns:
 * dict: Status message
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static synthesizeAudioSynthesizeFileIdGet(data: AudioData['SynthesizeAudioSynthesizeFileIdGet']): CancelablePromise<unknown> {
		const {
fileId,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/synthesize/{file_id}',
			path: {
				file_id: fileId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Get Audio
	 * Stream the synthesized audio file.
 * 
 * Args:
 * file_id: ID of the audio file
 * 
 * Returns:
 * FileResponse: The audio file
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static getAudioAudioFileIdGet(data: AudioData['GetAudioAudioFileIdGet']): CancelablePromise<unknown> {
		const {
fileId,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/audio/{file_id}',
			path: {
				file_id: fileId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Get Original Audio
	 * Stream the original uploaded audio file.
 * 
 * Args:
 * file_id: ID of the original audio file
 * 
 * Returns:
 * FileResponse: The original audio file
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static getOriginalAudioUploadsFileIdGet(data: AudioData['GetOriginalAudioUploadsFileIdGet']): CancelablePromise<unknown> {
		const {
fileId,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/uploads/{file_id}',
			path: {
				file_id: fileId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}