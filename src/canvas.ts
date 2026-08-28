import type { App } from 'obsidian';
import { TFile } from 'obsidian';

export const CANVAS_PROPERTY_NAME = 'canvas';

export function resolveCanvasTarget(
	app: App,
	sourceFile: TFile,
	propertyValue: unknown,
): TFile | null {
	const value = Array.isArray(propertyValue)
		? propertyValue.find((item): item is string => typeof item === 'string')
		: propertyValue;

	if (typeof value !== 'string') {
		return null;
	}

	const trimmedValue = value.trim();
	const wikiLinkMatch = /^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/.exec(
		trimmedValue,
	);
	const linkPath = wikiLinkMatch?.[1]?.trim() ?? trimmedValue;

	if (linkPath.length === 0) {
		return null;
	}

	const target = app.metadataCache.getFirstLinkpathDest(linkPath, sourceFile.path);
	return target instanceof TFile && target.extension === 'canvas' ? target : null;
}
