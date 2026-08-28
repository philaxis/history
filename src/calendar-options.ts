export type CalendarAlignment = 'left' | 'center' | 'right';

export interface CalendarOptions {
	folder: string | null;
	maxWidth: number | null;
	mode: 'auto' | 'number';
	align: CalendarAlignment;
}

export function parseCalendarOptions(source: string): CalendarOptions {
	let folder: string | null = null;
	let maxWidth: number | null = null;
	let mode: CalendarOptions['mode'] = 'auto';
	let align: CalendarAlignment = 'left';

	for (const line of source.split('\n')) {
		const folderMatch = /^\s*folder\s*:\s*(.*?)\s*$/.exec(line);
		if (folderMatch?.[1]) {
			folder = folderMatch[1]
				.replace(/^(['"])(.*)\1$/, '$2')
				.replace(/^\/+|\/+$/g, '');
		}

		const widthMatch = /^\s*max-width\s*:\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/.exec(
			line,
		);
		if (widthMatch?.[1]) {
			const parsedWidth = Number(widthMatch[1]);
			if (parsedWidth > 0) {
				maxWidth = parsedWidth;
			}
		}

		if (/^\s*mode\s*:\s*number\s*$/.test(line)) {
			mode = 'number';
		}

		const alignMatch = /^\s*align\s*:\s*(left|center|right)\s*$/.exec(line);
		if (alignMatch?.[1]) {
			align = alignMatch[1] as CalendarAlignment;
		}
	}

	return { folder, maxWidth, mode, align };
}
