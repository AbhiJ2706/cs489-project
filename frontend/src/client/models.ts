export type Body_convert_audio_convert_post = {
	file: Blob | File;
};



/**
 * Model for conversion result response.
 */
export type ConversionResult = {
	file_id: string;
	message: string;
	has_pdf?: boolean;
};



/**
 * Model for generic URL input (YouTube or Spotify).
 */
export type GenericUrl = {
	url: string;
	title?: string | null;
};



export type HTTPValidationError = {
	detail?: Array<ValidationError>;
};



/**
 * Model for Spotify URL input.
 */
export type SpotifyUrl = {
	url: string;
	title?: string | null;
};



export type ValidationError = {
	loc: Array<string | number>;
	msg: string;
	type: string;
};



/**
 * Model for YouTube URL input.
 */
export type YouTubeUrl = {
	url: string;
	title?: string | null;
};

