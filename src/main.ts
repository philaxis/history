import {
	FileView,
	ItemView,
	moment,
	parseYaml,
	Plugin,
	TFile,
	type WorkspaceLeaf,
} from 'obsidian';

import {
	HISTORY_CODE_BLOCK,
	HistoryCalendarRenderer,
} from './calendar';
import { updateCalendarMaxWidth } from './calendar-width';
import {
	MAX_SIDEBAR_FONT_SIZE,
	MAX_SIDEBAR_MARKER_SIZE,
	MIN_CALENDAR_FONT_SIZE,
	MIN_CALENDAR_MARKER_SIZE,
	parseCalendarOptions,
} from './calendar-options';
import {
	appendCanvasHistoryDate,
	type CanvasInteraction,
	getCanvasHistory,
	getCanvasTrackingState,
	isRecentCanvasInteraction,
	removeCanvasHistoryDate,
} from './canvas-data';
import { getHistoryMessages } from './i18n';
import {
	DEFAULT_SETTINGS,
	type HistorySettings,
	HistorySettingTab,
} from './settings';
import {
	buildMarkdownTrackingState,
	splitMarkdownFrontmatter,
} from './tracking-state';

const DEBOUNCE_DELAY_MS = 2_500;
const HISTORY_CALENDAR_VIEW_TYPE = 'history-calendar-view';
const CANVAS_EDIT_KEYS = new Set([
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'ArrowUp',
	'Backspace',
	'Delete',
	'Enter',
]);

class HistoryCalendarView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: HistoryPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return HISTORY_CALENDAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return getHistoryMessages(moment.locale()).calendarTitle;
	}

	getIcon(): string {
		return 'calendar-days';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('history-calendar-view');
		this.addChild(
			this.plugin.createCalendarRenderer(this.contentEl, '', '', null, true),
		);
	}
}

export default class HistoryPlugin extends Plugin {
	settings: HistorySettings = { ...DEFAULT_SETTINGS };

	private readonly debounceTimers = new Map<TFile, number>();
	private readonly filesBeingUpdated = new Set<TFile>();
	private readonly calendarRenderers = new Set<HistoryCalendarRenderer>();
	private readonly canvasInteractionDocuments = new WeakSet<Document>();
	private readonly trackingStates = new Map<TFile, string>();
	// ponytail: DOM input is the only public edit provenance; replace this gate if Obsidian exposes one.
	private canvasInteraction: CanvasInteraction | null = null;
	private canvasPointerPath: string | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new HistorySettingTab(this.app, this));
		this.registerView(
			HISTORY_CALENDAR_VIEW_TYPE,
			(leaf) => new HistoryCalendarView(leaf, this),
		);
		this.addCommand({
			id: 'open-calendar',
			name: getHistoryMessages(moment.locale()).openCalendar,
			callback: () => {
				void this.openCalendarView();
			},
		});
		this.registerHoverLinkSource(this.manifest.id, {
			display: this.manifest.name,
			defaultMod: false,
		});

		this.registerMarkdownCodeBlockProcessor(
			HISTORY_CODE_BLOCK,
			(source, element, context) => {
				const renderer = this.createCalendarRenderer(
					element,
					context.sourcePath,
					source,
					async (width) => {
						const section = context.getSectionInfo(element);
						const file = this.app.vault.getAbstractFileByPath(
							context.sourcePath,
						);
						if (section === null || !(file instanceof TFile)) {
							throw new Error('Unable to locate the history code block.');
						}

						await this.app.vault.process(file, (content) =>
							updateCalendarMaxWidth(
								content,
								section.lineStart,
								section.lineEnd,
								width,
							),
						);
					},
				);
				context.addChild(renderer);
			},
		);

		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				this.canvasPointerPath = null;
				if (this.isTrackedFile(file)) {
					void this.rememberTrackingState(file);
				}
			}),
		);

		this.registerCanvasInteractionDocument(
			this.app.workspace.containerEl.ownerDocument,
		);
		this.app.workspace.iterateAllLeaves((leaf) => {
			this.registerCanvasInteractionDocument(leaf.view.containerEl.ownerDocument);
		});
		this.registerEvent(
			this.app.workspace.on('window-open', (_workspaceWindow, window) => {
				this.registerCanvasInteractionDocument(window.document);
			}),
		);

		const activeFile = this.app.workspace.getActiveFile();
		if (this.isTrackedFile(activeFile)) {
			await this.rememberTrackingState(activeFile);
		}

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!(file instanceof TFile)) {
					return;
				}

				if (file.extension === 'md') {
					this.handleMarkdownModified(file);
				} else if (file.extension === 'canvas') {
					this.handleCanvasModified(file);
				}
			}),
		);
	}

	onunload(): void {
		for (const timer of this.debounceTimers.values()) {
			window.clearTimeout(timer);
		}

		this.debounceTimers.clear();
		this.filesBeingUpdated.clear();
		this.calendarRenderers.clear();
		this.trackingStates.clear();
		this.canvasInteraction = null;
		this.canvasPointerPath = null;
	}

	createCalendarRenderer(
		containerEl: HTMLElement,
		sourcePath: string,
		source: string,
		onWidthChange: ((width: number) => Promise<void>) | null = null,
		isSidebar = false,
	): HistoryCalendarRenderer {
		const renderer = new HistoryCalendarRenderer(
			containerEl,
			this.app,
			sourcePath,
			() => this.settings,
			parseCalendarOptions(source),
			onWidthChange,
			isSidebar,
			(file, date) => this.removeHistoryDate(file, date),
			() => this.calendarRenderers.delete(renderer),
		);
		this.calendarRenderers.add(renderer);
		return renderer;
	}

	private async openCalendarView(): Promise<void> {
		let leaf = this.app.workspace.getLeavesOfType(
			HISTORY_CALENDAR_VIEW_TYPE,
		)[0];
		if (leaf === undefined) {
			leaf = this.app.workspace.getRightLeaf(false) ?? undefined;
			if (leaf === undefined) {
				return;
			}
			await leaf.setViewState({
				type: HISTORY_CALENDAR_VIEW_TYPE,
				active: true,
			});
		}

		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	async loadSettings(): Promise<void> {
		const savedSettings = (await this.loadData()) as
			| Partial<HistorySettings>
			| null;
		const savedPropertyName =
			typeof savedSettings?.propertyName === 'string'
				? savedSettings.propertyName
				: DEFAULT_SETTINGS.propertyName;

		this.settings = {
			propertyName:
				savedPropertyName === 'edited'
					? DEFAULT_SETTINGS.propertyName
					: savedPropertyName,
			dateFormat:
				typeof savedSettings?.dateFormat === 'string'
					? savedSettings.dateFormat
					: DEFAULT_SETTINGS.dateFormat,
			autoTrackingEnabled:
				typeof savedSettings?.autoTrackingEnabled === 'boolean'
					? savedSettings.autoTrackingEnabled
					: DEFAULT_SETTINGS.autoTrackingEnabled,
			showHistoryDeleteButtons:
				typeof savedSettings?.showHistoryDeleteButtons === 'boolean'
					? savedSettings.showHistoryDeleteButtons
					: DEFAULT_SETTINGS.showHistoryDeleteButtons,
			sidebarCellRatio:
				typeof savedSettings?.sidebarCellRatio === 'number' &&
				savedSettings.sidebarCellRatio > 0
					? savedSettings.sidebarCellRatio
					: DEFAULT_SETTINGS.sidebarCellRatio,
			sidebarFontSize:
				typeof savedSettings?.sidebarFontSize === 'number' &&
				savedSettings.sidebarFontSize >= MIN_CALENDAR_FONT_SIZE &&
				savedSettings.sidebarFontSize <= MAX_SIDEBAR_FONT_SIZE
					? savedSettings.sidebarFontSize
					: DEFAULT_SETTINGS.sidebarFontSize,
			sidebarMarkerSize:
				typeof savedSettings?.sidebarMarkerSize === 'number' &&
				savedSettings.sidebarMarkerSize >= MIN_CALENDAR_MARKER_SIZE &&
				savedSettings.sidebarMarkerSize <= MAX_SIDEBAR_MARKER_SIZE
					? savedSettings.sidebarMarkerSize
					: DEFAULT_SETTINGS.sidebarMarkerSize,
			sidebarMode: savedSettings?.sidebarMode === 'dots'
				? 'dots'
				: DEFAULT_SETTINGS.sidebarMode,
		};

		if (savedPropertyName === 'edited') {
			await this.saveData(this.settings);
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.trackingStates.clear();
		const activeFile = this.app.workspace.getActiveFile();
		if (this.isTrackedFile(activeFile)) {
			await this.rememberTrackingState(activeFile);
		}
		this.refreshCalendars();
	}

	private refreshCalendars(): void {
		for (const renderer of this.calendarRenderers) {
			renderer.refresh();
		}
	}

	private handleMarkdownModified(file: TFile): void {
		if (!this.canTrack(file)) {
			return;
		}

		this.scheduleTracking(file, () =>
			this.trackMeaningfulModification(file, () => this.appendToday(file)),
		);
	}

	private handleCanvasModified(file: TFile): void {
		if (!this.canTrack(file, false) || !this.consumeCanvasInteraction(file)) {
			return;
		}

		this.scheduleTracking(file, () =>
			this.trackMeaningfulModification(file, () =>
				this.appendTodayToCanvas(file),
			),
		);
	}

	private registerCanvasInteractionDocument(document: Document): void {
		if (this.canvasInteractionDocuments.has(document)) {
			return;
		}
		this.canvasInteractionDocuments.add(document);

		this.registerDomEvent(
			document,
			'pointerdown',
			(event) => {
				this.canvasPointerPath = this.getCanvasEventPath(event);
			},
			true,
		);
		this.registerDomEvent(
			document,
			'pointermove',
			(event) => {
				const path = this.getCanvasEventPath(event);
				if (
					event.buttons !== 0 &&
					path !== null &&
					path === this.canvasPointerPath
				) {
					this.rememberCanvasInteraction(path);
				}
			},
			true,
		);
		const clearPointer = (): void => {
			this.canvasPointerPath = null;
		};
		this.registerDomEvent(document, 'pointerup', clearPointer, true);
		this.registerDomEvent(document, 'pointercancel', clearPointer, true);

		const remember = (event: Event): void => {
			const path = this.getCanvasEventPath(event);
			if (path !== null) {
				this.rememberCanvasInteraction(path);
			}
		};
		this.registerDomEvent(
			document,
			'keydown',
			(event) => {
				if (
					CANVAS_EDIT_KEYS.has(event.key) ||
					((event.ctrlKey || event.metaKey) &&
						['d', 'v', 'x', 'y', 'z'].includes(event.key.toLowerCase()))
				) {
					remember(event);
				}
			},
			true,
		);
		this.registerDomEvent(document, 'beforeinput', remember, true);
		this.registerDomEvent(document, 'drop', remember, true);
	}

	private getCanvasEventPath(event: Event): string | null {
		if (!event.isTrusted) {
			return null;
		}

		const eventPath = event.composedPath();
		let canvasPath: string | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (
				canvasPath === null &&
				leaf.view instanceof FileView &&
				leaf.view.getViewType() === 'canvas' &&
				leaf.view.file?.extension === 'canvas' &&
				eventPath.includes(leaf.view.containerEl)
			) {
				canvasPath = leaf.view.file.path;
			}
		});
		return canvasPath;
	}

	private rememberCanvasInteraction(path: string): void {
		this.canvasInteraction = {
			path,
			occurredAt: Date.now(),
		};
	}

	private consumeCanvasInteraction(file: TFile): boolean {
		const interaction = this.canvasInteraction;
		if (interaction?.path === file.path) {
			this.canvasInteraction = null;
		}
		return isRecentCanvasInteraction(interaction, file.path, Date.now());
	}

	private isTrackedFile(file: TFile | null): file is TFile {
		return file?.extension === 'md' || file?.extension === 'canvas';
	}

	private canTrack(file: TFile, requireActive = true): boolean {
		return (
			this.settings.autoTrackingEnabled &&
			!this.filesBeingUpdated.has(file) &&
			(!requireActive || this.app.workspace.getActiveFile()?.path === file.path)
		);
	}

	private async removeHistoryDate(file: TFile, date: unknown): Promise<void> {
		this.filesBeingUpdated.add(file);
		try {
			if (file.extension === 'canvas') {
				await this.app.vault.process(file, (content) =>
					removeCanvasHistoryDate(content, date),
				);
			} else {
				const propertyName =
					this.settings.propertyName.trim() || DEFAULT_SETTINGS.propertyName;
				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					const typedFrontmatter = frontmatter as Record<string, unknown>;
					const value = typedFrontmatter[propertyName];
					const dates = Array.isArray(value) ? value : value == null ? [] : [value];
					typedFrontmatter[propertyName] = dates.filter(
						(historyDate) => historyDate !== date,
					);
				});
			}

			this.refreshCalendars();
		} finally {
			this.filesBeingUpdated.delete(file);
		}
	}

	private scheduleTracking(
		file: TFile,
		operation: () => Promise<void>,
	): void {
		const existingTimer = this.debounceTimers.get(file);
		if (existingTimer !== undefined) {
			window.clearTimeout(existingTimer);
		}

		const timer = window.setTimeout(() => {
			this.debounceTimers.delete(file);
			void operation();
		}, DEBOUNCE_DELAY_MS);

		this.debounceTimers.set(file, timer);
	}

	private async trackMeaningfulModification(
		file: TFile,
		operation: () => Promise<void>,
	): Promise<void> {
		if (
			!this.settings.autoTrackingEnabled ||
			this.app.vault.getAbstractFileByPath(file.path) !== file
		) {
			return;
		}

		try {
			const currentState = await this.readTrackingState(file);
			const previousState = this.trackingStates.get(file);
			this.trackingStates.set(file, currentState);
			if (previousState === undefined || previousState === currentState) {
				return;
			}

			await operation();
		} catch (error) {
			console.error(`Failed to compare history for "${file.path}".`, error);
		}
	}

	private async rememberTrackingState(file: TFile): Promise<void> {
		try {
			this.trackingStates.set(file, await this.readTrackingState(file));
		} catch (error) {
			console.error(`Failed to read "${file.path}".`, error);
		}
	}

	private async readTrackingState(file: TFile): Promise<string> {
		const content = await this.app.vault.read(file);
		if (file.extension === 'canvas') {
			return getCanvasTrackingState(content);
		}

		const propertyName =
			this.settings.propertyName.trim() || DEFAULT_SETTINGS.propertyName;
		const { frontmatter, body } = splitMarkdownFrontmatter(content);
		return buildMarkdownTrackingState(
			frontmatter === null ? null : parseYaml(frontmatter),
			body,
			propertyName,
		);
	}

	private async appendTodayToCanvas(canvasFile: TFile): Promise<void> {
		if (
			!this.settings.autoTrackingEnabled ||
			this.app.vault.getAbstractFileByPath(canvasFile.path) !== canvasFile
		) {
			return;
		}

		const dateFormat =
			this.settings.dateFormat.trim() || DEFAULT_SETTINGS.dateFormat;
		const today = moment().format(dateFormat);
		this.filesBeingUpdated.add(canvasFile);

		try {
			const currentContent = await this.app.vault.read(canvasFile);
			if (getCanvasHistory(currentContent).includes(today)) {
				this.refreshCalendars();
				return;
			}

			await this.app.vault.process(canvasFile, (content) =>
				appendCanvasHistoryDate(content, today),
			);
			this.refreshCalendars();
		} catch (error) {
			console.error(
				`Failed to update history for "${canvasFile.path}".`,
				error,
			);
		} finally {
			this.filesBeingUpdated.delete(canvasFile);
		}
	}

	private async appendToday(file: TFile): Promise<void> {
		if (!this.settings.autoTrackingEnabled) {
			return;
		}

		// The file might have been deleted while its debounce timer was pending.
		if (this.app.vault.getAbstractFileByPath(file.path) !== file) {
			return;
		}

		const propertyName =
			this.settings.propertyName.trim() || DEFAULT_SETTINGS.propertyName;
		const dateFormat =
			this.settings.dateFormat.trim() || DEFAULT_SETTINGS.dateFormat;
		const today = moment().format(dateFormat);
		const cachedFrontmatter =
			this.app.metadataCache.getFileCache(file)?.frontmatter;
		const cachedDates: unknown = cachedFrontmatter?.[propertyName];

		// Avoid rewriting the file on every editing session after today's date
		// has already been recorded. The callback below repeats this check so a
		// stale metadata cache can never create a duplicate.
		if (Array.isArray(cachedDates) && cachedDates.includes(today)) {
			return;
		}

		this.filesBeingUpdated.add(file);

		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				const typedFrontmatter = frontmatter as Record<string, unknown>;
				const currentValue = typedFrontmatter[propertyName];
				const historyDates: unknown[] = Array.isArray(currentValue)
					? currentValue
					: currentValue == null
						? []
						: [currentValue];

				if (historyDates.includes(today)) {
					return;
				}

				typedFrontmatter[propertyName] = [...historyDates, today];
			});
		} catch (error) {
			console.error(`Failed to update history for "${file.path}".`, error);
		} finally {
			this.filesBeingUpdated.delete(file);
		}
	}
}
