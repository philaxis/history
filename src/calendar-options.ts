export type CalendarAlignment = 'left' | 'center' | 'right';
export const DEFAULT_CALENDAR_MAX_WIDTH = 502;
export const DEFAULT_CALENDAR_CELL_RATIO = 1.2;
export const DEFAULT_SIDEBAR_CELL_RATIO = 0.6;
export const DEFAULT_CALENDAR_FONT_SIZE = 1;
export const DEFAULT_SIDEBAR_FONT_SIZE = 2;
export const DEFAULT_CALENDAR_MARKER_SIZE = 1.2;
export const DEFAULT_SIDEBAR_MARKER_SIZE = 2;
export const DEFAULT_SIDEBAR_MODE = 'number';
export const MIN_CALENDAR_FONT_SIZE = 0.5;
export const MAX_CALENDAR_FONT_SIZE = 2;
export const MAX_SIDEBAR_FONT_SIZE = 3;
export const MIN_CALENDAR_MARKER_SIZE = 0.5;
export const MAX_CALENDAR_MARKER_SIZE = 2;
export const MAX_SIDEBAR_MARKER_SIZE = 4;

export interface CalendarOptions {
	folder: string | null;
	maxWidth: number | null;
	mode: 'auto' | 'number';
	align: CalendarAlignment;
	ratio: number;
	fontSize: number;
	markerSize: number;
}

export function parseCalendarOptions(source: string): CalendarOptions {
	let folder: string | null = null;
	let maxWidth: number | null = DEFAULT_CALENDAR_MAX_WIDTH;
	let mode: CalendarOptions['mode'] = 'auto';
	let align: CalendarAlignment = 'left';
	let ratio = DEFAULT_CALENDAR_CELL_RATIO;
	let fontSize = DEFAULT_CALENDAR_FONT_SIZE;
	let markerSize = DEFAULT_CALENDAR_MARKER_SIZE;

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

		const ratioMatch = /^\s*ratio\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(line);
		if (ratioMatch?.[1]) {
			const parsedRatio = Number(ratioMatch[1]);
			if (parsedRatio > 0) {
				ratio = parsedRatio;
			}
		}

		const fontSizeMatch = /^\s*font-size\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(line);
		if (fontSizeMatch?.[1]) {
			fontSize = Math.min(
				MAX_CALENDAR_FONT_SIZE,
				Math.max(MIN_CALENDAR_FONT_SIZE, Number(fontSizeMatch[1])),
			);
		}

		const markerSizeMatch = /^\s*marker-size\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(line);
		if (markerSizeMatch?.[1]) {
			markerSize = Math.min(
				MAX_CALENDAR_MARKER_SIZE,
				Math.max(MIN_CALENDAR_MARKER_SIZE, Number(markerSizeMatch[1])),
			);
		}
	}

	return { folder, maxWidth, mode, align, ratio, fontSize, markerSize };
}
