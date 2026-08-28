export function splitMarkdownFrontmatter(content: string): {
	frontmatter: string | null;
	body: string;
} {
	const match = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)(?:\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(
		content,
	);
	return match === null
		? { frontmatter: null, body: content }
		: {
			frontmatter: match[1] ?? '',
			body: content.slice(match[0].length),
		};
}

export function buildMarkdownTrackingState(
	frontmatter: unknown,
	body: string,
	propertyName: string,
): string {
	const trackedFrontmatter =
		frontmatter !== null &&
		typeof frontmatter === 'object' &&
		!Array.isArray(frontmatter)
			? { ...(frontmatter as Record<string, unknown>) }
			: {};
	delete trackedFrontmatter[propertyName];
	return `${JSON.stringify(trackedFrontmatter)}\0${body}`;
}
