type DateFormatter = (format: string | null) => string;

export function renderDailyNoteTemplate(
	template: string,
	title: string,
	formatDate: DateFormatter,
	formatTime: DateFormatter,
): string {
	return template.replace(
		/\{\{\s*(date|time|title)(?:\s*:\s*([^}]+?))?\s*\}\}/gi,
		(_token, type: string, rawFormat: string | undefined) => {
			if (type.toLowerCase() === 'title') {
				return title;
			}

			const format = rawFormat?.trim() || null;
			return type.toLowerCase() === 'date'
				? formatDate(format)
				: formatTime(format);
		},
	);
}
