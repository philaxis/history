import {
	type App,
	moment,
	normalizePath,
	TFile,
	TFolder,
} from 'obsidian';

import { renderDailyNoteTemplate } from './daily-note-template';

const DAILY_NOTES_PLUGIN_ID = 'daily-notes';
const DEFAULT_DAILY_NOTE_FORMAT = 'YYYY-MM-DD';

type MomentValue = ReturnType<typeof moment>;

export interface DailyNoteSettings {
	folder: string;
	format: string;
	template: string;
}

interface DailyNotesPluginInstance {
	options?: unknown;
}

interface InternalPlugins {
	getEnabledPluginById?: (id: string) => DailyNotesPluginInstance | null;
	getPluginById?: (id: string) => {
		enabled?: boolean;
		instance?: DailyNotesPluginInstance;
	} | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object'
		? value as Record<string, unknown>
		: null;
}

export function getDailyNoteSettings(app: App): DailyNoteSettings | null {
	const internalPlugins = (app as App & {
		internalPlugins?: InternalPlugins;
	}).internalPlugins;
	const enabledInstance =
		internalPlugins?.getEnabledPluginById?.(DAILY_NOTES_PLUGIN_ID);
	const plugin = internalPlugins?.getPluginById?.(DAILY_NOTES_PLUGIN_ID);
	const instance = enabledInstance ??
		(plugin?.enabled === true ? plugin.instance : null);
	if (instance === null || instance === undefined) {
		return null;
	}

	const options = asRecord(instance.options);
	const folder = typeof options?.folder === 'string'
		? options.folder.trim()
		: '';
	const format = typeof options?.format === 'string' && options.format.trim()
		? options.format.trim()
		: DEFAULT_DAILY_NOTE_FORMAT;
	const template = typeof options?.template === 'string'
		? options.template.trim()
		: '';

	return { folder, format, template };
}

export function getDailyNotePath(
	date: MomentValue,
	settings: DailyNoteSettings,
): string {
	const filename = date.format(settings.format);
	const path = normalizePath(
		settings.folder ? `${settings.folder}/${filename}` : filename,
	);
	return path.toLowerCase().endsWith('.md') ? path : `${path}.md`;
}

export function getDailyNoteDate(
	file: TFile,
	settings: DailyNoteSettings,
): MomentValue | null {
	const filePath = normalizePath(file.path);
	const folder = settings.folder ? normalizePath(settings.folder) : '';
	const folderPrefix = folder ? `${folder}/` : '';
	if (
		!filePath.toLowerCase().endsWith('.md') ||
		(folderPrefix && !filePath.startsWith(folderPrefix))
	) {
		return null;
	}

	const dateSource = filePath.slice(folderPrefix.length, -3);
	const date = moment(dateSource, settings.format, true);
	return date.isValid() && getDailyNotePath(date, settings) === filePath
		? date
		: null;
}

export function getDailyNote(
	app: App,
	date: MomentValue,
	settings: DailyNoteSettings,
): TFile | null {
	const file = app.vault.getAbstractFileByPath(
		getDailyNotePath(date, settings),
	);
	return file instanceof TFile ? file : null;
}

async function ensureParentFolders(app: App, filePath: string): Promise<void> {
	const parts = normalizePath(filePath).split('/');
	parts.pop();

	let folderPath = '';
	for (const part of parts) {
		folderPath = folderPath ? `${folderPath}/${part}` : part;
		const existing = app.vault.getAbstractFileByPath(folderPath);
		if (existing instanceof TFolder) {
			continue;
		}
		if (existing !== null) {
			throw new Error(`Daily note folder path is a file: "${folderPath}".`);
		}

		try {
			await app.vault.createFolder(folderPath);
		} catch (error) {
			if (!(app.vault.getAbstractFileByPath(folderPath) instanceof TFolder)) {
				throw error;
			}
		}
	}
}

async function getTemplate(app: App, templatePath: string): Promise<string> {
	if (!templatePath) {
		return '';
	}

	const template = app.metadataCache.getFirstLinkpathDest(templatePath, '');
	return template === null ? '' : app.vault.cachedRead(template);
}

export async function getOrCreateDailyNote(
	app: App,
	date: MomentValue,
	settings: DailyNoteSettings,
): Promise<TFile> {
	const existing = getDailyNote(app, date, settings);
	if (existing !== null) {
		return existing;
	}

	const path = getDailyNotePath(date, settings);
	await ensureParentFolders(app, path);
	const template = await getTemplate(app, settings.template);
	const fileCreatedWhileReadingTemplate = getDailyNote(app, date, settings);
	if (fileCreatedWhileReadingTemplate !== null) {
		return fileCreatedWhileReadingTemplate;
	}

	const title = path.split('/').pop()?.replace(/\.md$/i, '') ?? '';
	const now = moment();
	const content = renderDailyNoteTemplate(
		template,
		title,
		(format) => format === null ? title : date.format(format),
		(format) => now.format(format ?? 'HH:mm'),
	);

	try {
		return await app.vault.create(path, content);
	} catch (error) {
		const concurrentlyCreated = getDailyNote(app, date, settings);
		if (concurrentlyCreated !== null) {
			return concurrentlyCreated;
		}
		throw error;
	}
}
