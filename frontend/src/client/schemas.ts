export const $Body_convert_audio_convert_post = {
	properties: {
		file: {
	type: 'binary',
	isRequired: true,
	format: 'binary',
},
	},
} as const;

export const $ConversionResult = {
	description: `Model for conversion result response.`,
	properties: {
		file_id: {
	type: 'string',
	isRequired: true,
},
		message: {
	type: 'string',
	isRequired: true,
},
		has_pdf: {
	type: 'boolean',
	default: false,
},
	},
} as const;

export const $GenericUrl = {
	description: `Model for generic URL input (YouTube or Spotify).`,
	properties: {
		url: {
	type: 'string',
	isRequired: true,
},
		title: {
	type: 'any-of',
	contains: [{
	type: 'string',
}, {
	type: 'null',
}],
},
	},
} as const;

export const $HTTPValidationError = {
	properties: {
		detail: {
	type: 'array',
	contains: {
		type: 'ValidationError',
	},
},
	},
} as const;

export const $SpotifyUrl = {
	description: `Model for Spotify URL input.`,
	properties: {
		url: {
	type: 'string',
	isRequired: true,
},
		title: {
	type: 'any-of',
	contains: [{
	type: 'string',
}, {
	type: 'null',
}],
},
	},
} as const;

export const $ValidationError = {
	properties: {
		loc: {
	type: 'array',
	contains: {
	type: 'any-of',
	contains: [{
	type: 'string',
}, {
	type: 'number',
}],
},
	isRequired: true,
},
		msg: {
	type: 'string',
	isRequired: true,
},
		type: {
	type: 'string',
	isRequired: true,
},
	},
} as const;

export const $YouTubeUrl = {
	description: `Model for YouTube URL input.`,
	properties: {
		url: {
	type: 'string',
	isRequired: true,
},
		title: {
	type: 'any-of',
	contains: [{
	type: 'string',
}, {
	type: 'null',
}],
},
	},
} as const;