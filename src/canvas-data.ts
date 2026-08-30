export const CANVAS_HISTORY_PROPERTY_NAME = 'history';
const CANVAS_INTERACTION_WINDOW_MS = 5_000;

export interface CanvasInteraction {
	path: string;
	occurredAt: number;
}

function normalizeHistory(value: unknown): unknown[] {
	return Array.isArray(value) ? value : value == null ? [] : [value];
}

function parseCanvas(source: string): Record<string, unknown> {
	const parsed: unknown = JSON.parse(source);
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('Canvas data must be a JSON object.');
	}

	return parsed as Record<string, unknown>;
}

export function getCanvasHistory(source: string): unknown[] {
	return normalizeHistory(parseCanvas(source)[CANVAS_HISTORY_PROPERTY_NAME]);
}

export function getCanvasTrackingState(source: string): string {
	const canvas = parseCanvas(source);
	delete canvas[CANVAS_HISTORY_PROPERTY_NAME];
	return JSON.stringify(canvas);
}

export function isRecentCanvasInteraction(
	interaction: CanvasInteraction | null,
	path: string,
	now: number,
): boolean {
	const age = interaction === null ? -1 : now - interaction.occurredAt;
	return interaction?.path === path &&
		age >= 0 &&
		age <= CANVAS_INTERACTION_WINDOW_MS;
}

export function appendCanvasHistoryDate(source: string, date: string): string {
	const canvas = parseCanvas(source);
	const history = normalizeHistory(canvas[CANVAS_HISTORY_PROPERTY_NAME]);
	if (history.includes(date)) {
		return source;
	}

	canvas[CANVAS_HISTORY_PROPERTY_NAME] = [...history, date];
	return JSON.stringify(canvas);
}

export function removeCanvasHistoryDate(
	source: string,
	date: unknown,
): string {
	const canvas = parseCanvas(source);
	const history = normalizeHistory(canvas[CANVAS_HISTORY_PROPERTY_NAME]);
	const nextHistory = history.filter((value) => value !== date);
	if (nextHistory.length === history.length) {
		return source;
	}

	canvas[CANVAS_HISTORY_PROPERTY_NAME] = nextHistory;
	return JSON.stringify(canvas);
}
