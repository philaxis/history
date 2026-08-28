export function getCalendarScale(
	maxWidth: number | null,
	availableWidth: number,
	baseWidth: number,
): { width: number; scale: number } | null {
	if (availableWidth <= 0 || baseWidth <= 0) {
		return null;
	}

	const width = Math.min(maxWidth ?? availableWidth, availableWidth);
	return { width, scale: width / baseWidth };
}

export function updateCalendarMaxWidth(
	content: string,
	lineStart: number,
	lineEnd: number,
	width: number,
): string {
	if (!Number.isFinite(width) || width <= 0) {
		return content;
	}

	const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(/\r?\n/);
	const opening = /^(\s*)(`{3,}|~{3,})\s*history\s*$/.exec(
		lines[lineStart] ?? '',
	);
	if (opening === null) {
		return content;
	}

	const fence = opening[2] ?? '';
	const closingIndex = lines.findIndex((line, index) => {
		if (index <= lineStart || index > Math.min(lineEnd + 1, lines.length - 1)) {
			return false;
		}
		const trimmed = line.trim();
		return trimmed.length >= fence.length &&
			Array.from(trimmed).every((character) => character === fence[0]);
	});
	if (closingIndex < 0) {
		return content;
	}

	const value = String(Math.round(width));
	for (let index = lineStart + 1; index < closingIndex; index += 1) {
		const option = /^(\s*)max-width\s*:.*$/.exec(lines[index] ?? '');
		if (option !== null) {
			lines[index] = `${option[1] ?? ''}max-width: ${value}`;
			return lines.join(lineEnding);
		}
	}

	lines.splice(closingIndex, 0, `${opening[1] ?? ''}max-width: ${value}`);
	return lines.join(lineEnding);
}
