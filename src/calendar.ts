import {
	type App,
	Component,
	DropdownComponent,
	type HoverPopover,
	Keymap,
	MarkdownRenderChild,
	MarkdownRenderer,
	Menu,
	moment,
	Modal,
	Notice,
	Setting,
	type TAbstractFile,
	TFile,
	type WorkspaceLeaf,
} from 'obsidian';

import { getCanvasHistory } from './canvas-data';
import { CANVAS_PROPERTY_NAME, resolveCanvasTarget } from './canvas';
import {
	getDailyNote,
	getDailyNoteSettings,
	getOrCreateDailyNote,
} from './daily-notes';
import { getHistoryMessages } from './i18n';
import { isPointInTriangle, type Point } from './pointer-intent';
import type { HistorySettings } from './settings';

export const HISTORY_CODE_BLOCK = 'history';

const DAY_KEY_FORMAT = 'YYYY-MM-DD';
const MAX_VISIBLE_EVENTS = 10;
const TOOLTIP_GAP = 6;
const TOOLTIP_LAYOUT_MARGIN = 8;
const TOOLTIP_MAX_HEIGHT = 280;
const TOOLTIP_MIN_AVAILABLE_SIZE = 32;
const TOOLTIP_MIN_WIDTH = 160;
const TOOLTIP_MAX_WIDTH = 300;
const TOOLTIP_CLOSE_DELAY = 150;
const TOOLTIP_INTENT_DELAY = 300;
const LINK_PREVIEW_DELAY = 1_000;

type CalendarEventKind = 'ctime' | 'history';
type MomentValue = ReturnType<typeof moment>;

interface CalendarOptions {
	folder: string | null;
}

interface CalendarEvent {
	kind: CalendarEventKind;
	name: string;
	targetFile: TFile;
}

interface TooltipCandidate {
	anchorEl: HTMLElement;
	events: CalendarEvent[];
}

class DailyNoteCreateModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private readonly title: string,
		private readonly prompt: string,
		private readonly cancelLabel: string,
		private readonly createLabel: string,
		private readonly resolve: (confirmed: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.title);
		this.contentEl.createEl('p', { text: this.prompt });
		new Setting(this.contentEl)
			.addButton((button) =>
				button
					.setButtonText(this.cancelLabel)
					.onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(this.createLabel)
					.setCta()
					.onClick(() => {
						this.confirmed = true;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolve(this.confirmed);
	}
}

export function parseCalendarOptions(source: string): CalendarOptions {
	let folder: string | null = null;

	for (const line of source.split('\n')) {
		const match = /^\s*folder\s*:\s*(.*?)\s*$/.exec(line);
		if (!match?.[1]) {
			continue;
		}

		folder = match[1].replace(/^(['"])(.*)\1$/, '$2').replace(/^\/+|\/+$/g, '');
	}

	return { folder };
}

export class HistoryCalendarRenderer extends MarkdownRenderChild {
	hoverPopover: HoverPopover | null = null;

	private visibleMonth = moment().startOf('month');
	private readonly messages = getHistoryMessages(moment.locale());
	private renderGeneration = 0;
	private renderFrame: number | null = null;
	private tooltipEl: HTMLElement | null = null;
	private tooltipAnchorEl: HTMLElement | null = null;
	private tooltipCloseTimer: number | null = null;
	private tooltipPositionFrame: number | null = null;
	private tooltipRenderComponent: Component | null = null;
	private tooltipReady = false;
	private tooltipCandidate: TooltipCandidate | null = null;
	private tooltipSafeTriangle: [Point, Point, Point] | null = null;
	private linkPreviewTimer: number | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly app: App,
		private readonly sourcePath: string,
		private readonly getSettings: () => HistorySettings,
		private readonly options: CalendarOptions,
		private readonly onDispose: () => void,
	) {
		super(containerEl);
	}

	onload(): void {
		void this.renderCalendar();

		const ownerDocument = this.containerEl.ownerDocument;
		const ownerWindow = this.getOwnerWindow();
		this.registerDomEvent(ownerWindow, 'resize', () => {
			this.scheduleTooltipPosition();
		});
		this.registerDomEvent(
			ownerDocument,
			'scroll',
			(event) => {
				if (event.target === this.tooltipEl) {
					return;
				}

				this.scheduleTooltipPosition();
			},
			true,
		);
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.scheduleTooltipPosition();
			}),
		);

		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (this.includesFile(file)) {
					this.refresh();
				}
			}),
		);

		const refreshForFile = (file: TAbstractFile): void => {
			if (
				file instanceof TFile &&
				(file.extension === 'md' || this.includesFile(file))
			) {
				this.refresh();
			}
		};

		this.registerEvent(this.app.vault.on('create', refreshForFile));
		this.registerEvent(this.app.vault.on('delete', refreshForFile));
		this.registerEvent(
			this.app.vault.on('rename', (file) => refreshForFile(file)),
		);
	}

	onunload(): void {
		this.renderGeneration += 1;
		if (this.renderFrame !== null) {
			this.getOwnerWindow().cancelAnimationFrame(this.renderFrame);
			this.renderFrame = null;
		}

		this.closeTooltip();
		this.onDispose();
	}

	refresh(): void {
		if (this.renderFrame !== null) {
			return;
		}

		this.renderFrame = this.getOwnerWindow().requestAnimationFrame(() => {
			this.renderFrame = null;
			void this.renderCalendar();
		});
	}

	private async renderCalendar(): Promise<void> {
		const renderGeneration = ++this.renderGeneration;
		this.closeTooltip();
		const eventsByDay = await this.collectEvents();
		if (renderGeneration !== this.renderGeneration) {
			return;
		}
		const dailyNoteSettings = getDailyNoteSettings(this.app);

		this.containerEl.empty();
		this.containerEl.addClass('history-calendar');

		const frame = this.containerEl.createDiv({ cls: 'history-calendar__frame' });
		const header = frame.createDiv({ cls: 'history-calendar__header' });

		const leftActions = header.createDiv({
			cls: 'history-calendar__header-left',
		});
		this.createNavigationButton(
			leftActions,
			this.messages.thisMonth,
			this.messages.goToCurrentMonth,
			() => {
				this.visibleMonth = moment().startOf('month');
				void this.renderCalendar();
			},
		);

		const monthNavigation = header.createDiv({
			cls: 'history-calendar__month-navigation',
		});
		this.createNavigationButton(
			monthNavigation,
			'<',
			this.messages.previousMonth,
			() => {
				this.visibleMonth.subtract(1, 'month');
				void this.renderCalendar();
			},
		);
		this.createYearSelect(monthNavigation);
		this.createMonthSelect(monthNavigation);
		this.createNavigationButton(
			monthNavigation,
			'>',
			this.messages.nextMonth,
			() => {
				this.visibleMonth.add(1, 'month');
				void this.renderCalendar();
			},
		);

		header.createDiv({ cls: 'history-calendar__header-right' });

		const grid = frame.createDiv({ cls: 'history-calendar__grid' });
		for (const weekday of this.messages.weekdays) {
			const weekdayEl = grid.createDiv({
				cls: 'history-calendar__weekday',
				attr: { 'aria-label': weekday },
			});
			weekdayEl.createSpan({
				cls: 'history-calendar__weekday-full',
				text: weekday,
				attr: { 'aria-hidden': 'true' },
			});
			weekdayEl.createSpan({
				cls: 'history-calendar__weekday-short',
				text: Array.from(weekday)[0] ?? weekday,
				attr: { 'aria-hidden': 'true' },
			});
		}

		const firstDay = this.visibleMonth.clone().startOf('month');
		const gridStart = firstDay.clone().subtract(firstDay.day(), 'days');
		const cellCount =
			Math.ceil((firstDay.day() + firstDay.daysInMonth()) / 7) * 7;
		const todayKey = moment().format(DAY_KEY_FORMAT);

		for (let index = 0; index < cellCount; index += 1) {
			const date = gridStart.clone().add(index, 'days');
			const dayKey = date.format(DAY_KEY_FORMAT);
			const cell = grid.createEl('button', {
				cls: 'history-calendar__day',
				attr: {
					type: 'button',
					'aria-label': date.format('LL'),
				},
			});

			if (date.month() !== this.visibleMonth.month()) {
				cell.addClass('is-outside');
			}

			if (dayKey === todayKey) {
				cell.addClass('is-today');
			}
			if (
				dailyNoteSettings !== null &&
				getDailyNote(this.app, date, dailyNoteSettings) !== null
			) {
				cell.addClass('has-daily-note');
			}

			cell.createSpan({
				cls: 'history-calendar__day-number',
				text: String(date.date()),
			});
			cell.addEventListener('click', () => {
				void this.openDailyNote(date.clone(), cell);
			});

			const events = [...(eventsByDay.get(dayKey)?.values() ?? [])].sort(
				(left, right) => {
					if (left.kind !== right.kind) {
						return left.kind === 'ctime' ? -1 : 1;
					}

					return left.name.localeCompare(right.name);
				},
			);

			if (events.length > 0) {
				this.renderEvents(cell, events);
			}
		}
	}

	private async collectEvents(): Promise<
		Map<string, Map<string, CalendarEvent>>
	> {
		const eventsByDay = new Map<string, Map<string, CalendarEvent>>();
		const propertyName =
			this.getSettings().propertyName.trim() || 'history';

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!this.includesFile(file)) {
				continue;
			}

			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			const canvasTarget = resolveCanvasTarget(
				this.app,
				file,
				frontmatter?.[CANVAS_PROPERTY_NAME],
			);
			const targetFile = canvasTarget ?? file;
			const displayName = canvasTarget?.basename ?? file.basename;
			const createdDay = moment(targetFile.stat.ctime).format(DAY_KEY_FORMAT);

			this.addEvent(eventsByDay, createdDay, targetFile.path, {
				kind: 'ctime',
				name: displayName,
				targetFile,
			});

			const historyValue: unknown = frontmatter?.[propertyName];
			const historyDates = Array.isArray(historyValue)
				? historyValue
				: historyValue == null
					? []
					: [historyValue];

			for (const historyDate of historyDates) {
				const historyDay = this.toDayKey(historyDate);
				if (historyDay === null) {
					continue;
				}

				this.addEvent(eventsByDay, historyDay, targetFile.path, {
					kind: 'history',
					name: displayName,
					targetFile,
				});
			}
		}

		for (const file of this.app.vault.getFiles()) {
			if (file.extension !== 'canvas' || !this.includesFile(file)) {
				continue;
			}

			this.addEvent(
				eventsByDay,
				moment(file.stat.ctime).format(DAY_KEY_FORMAT),
				file.path,
				{ kind: 'ctime', name: file.basename, targetFile: file },
			);

			let historyDates: unknown[];
			try {
				historyDates = getCanvasHistory(
					await this.app.vault.cachedRead(file),
				);
			} catch (error) {
				console.error(`Failed to read history from "${file.path}".`, error);
				continue;
			}

			for (const historyDate of historyDates) {
				const historyDay = this.toDayKey(historyDate);
				if (historyDay !== null) {
					this.addEvent(eventsByDay, historyDay, file.path, {
						kind: 'history',
						name: file.basename,
						targetFile: file,
					});
				}
			}
		}

		return eventsByDay;
	}

	private addEvent(
		eventsByDay: Map<string, Map<string, CalendarEvent>>,
		dayKey: string,
		fileKey: string,
		event: CalendarEvent,
	): void {
		let dayEvents = eventsByDay.get(dayKey);
		if (dayEvents === undefined) {
			dayEvents = new Map<string, CalendarEvent>();
			eventsByDay.set(dayKey, dayEvents);
		}

		const existingEvent = dayEvents.get(fileKey);
		if (existingEvent === undefined || event.kind === 'ctime') {
			dayEvents.set(fileKey, event);
		}
	}

	private renderEvents(cell: HTMLElement, events: CalendarEvent[]): void {
		const dots = cell.createSpan({ cls: 'history-calendar__dots' });

		for (const event of events.slice(0, MAX_VISIBLE_EVENTS)) {
			dots.createSpan({
				cls: `history-calendar__dot is-${event.kind}`,
				attr: {
					'aria-hidden': 'true',
				},
			});
		}
		if (events.length > MAX_VISIBLE_EVENTS) {
			const hiddenCount = events.length - MAX_VISIBLE_EVENTS;
			dots.createSpan({
				cls: 'history-calendar__more',
				text: `+${hiddenCount}`,
				attr: { 'aria-label': this.messages.moreEvents(hiddenCount) },
			});
		}
		for (const kind of ['ctime', 'history'] as const) {
			const count = events.filter((event) => event.kind === kind).length;
			if (count > 0) {
				dots.createSpan({
					cls: `history-calendar__count is-${kind}`,
					text: String(count),
				});
			}
		}

		cell.addEventListener('pointerenter', (event) => {
			if (this.shouldDeferTooltipSwitch(cell, events, event)) {
				return;
			}

			this.showTooltip(cell, events);
		});
		cell.addEventListener('pointermove', (event) => {
			if (
				this.tooltipCandidate?.anchorEl === cell &&
				!this.isInsideTooltipSafeTriangle(event)
			) {
				this.clearTooltipIntent();
				this.showTooltip(cell, events);
			}
		});
		cell.addEventListener('pointerleave', (event) => {
			if (this.tooltipAnchorEl === cell) {
				this.tooltipSafeTriangle = this.createTooltipSafeTriangle(event);
			} else if (this.tooltipCandidate?.anchorEl === cell) {
				this.tooltipCandidate = null;
			}
			this.scheduleTooltipClose();
		});
		cell.addEventListener('focusin', () => {
			this.showTooltip(cell, events);
		});
		cell.addEventListener('focusout', () => {
			this.scheduleTooltipClose();
		});
	}

	private async openDailyNote(
		date: MomentValue,
		cell: HTMLButtonElement,
	): Promise<void> {
		if (cell.hasClass('is-opening')) {
			return;
		}

		const settings = getDailyNoteSettings(this.app);
		if (settings === null) {
			new Notice(this.messages.dailyNotesDisabled);
			return;
		}

		cell.addClass('is-opening');
		try {
			if (
				getDailyNote(this.app, date, settings) === null &&
				!(await this.confirmDailyNoteCreation(date))
			) {
				return;
			}

			const file = await getOrCreateDailyNote(this.app, date, settings);
			await this.app.workspace.openLinkText(
				file.path,
				this.sourcePath,
				false,
			);
			this.refresh();
		} catch (error) {
			console.error('Failed to open or create a daily note.', error);
			new Notice(this.messages.dailyNoteCreateFailed);
		} finally {
			cell.removeClass('is-opening');
		}
	}

	private confirmDailyNoteCreation(date: MomentValue): Promise<boolean> {
		return new Promise((resolve) => {
			new DailyNoteCreateModal(
				this.app,
				this.messages.dailyNoteCreateTitle,
				this.messages.dailyNoteCreatePrompt(date.format('LL')),
				this.messages.cancel,
				this.messages.create,
				resolve,
			).open();
		});
	}

	private showTooltip(anchorEl: HTMLElement, events: CalendarEvent[]): void {
		this.cancelTooltipClose();
		if (this.tooltipAnchorEl === anchorEl && this.tooltipEl !== null) {
			return;
		}

		this.closeTooltip();

		const tooltip = this.containerEl.ownerDocument.body.createDiv({
			cls: 'history-calendar__tooltip markdown-rendered',
		});

		tooltip.addEventListener('pointerenter', () => {
			this.cancelTooltipClose();
			this.clearTooltipIntent();
		});
		tooltip.addEventListener('pointerleave', () => {
			this.scheduleTooltipClose();
		});
		tooltip.addEventListener('focusin', () => {
			this.cancelTooltipClose();
		});
		tooltip.addEventListener('focusout', () => {
			this.scheduleTooltipClose();
		});

		this.tooltipEl = tooltip;
		this.tooltipAnchorEl = anchorEl;
		this.tooltipReady = false;

		const renderComponent = new Component();
		renderComponent.load();
		this.tooltipRenderComponent = renderComponent;
		void this.renderTooltipLinks(tooltip, events, renderComponent);
	}

	private async renderTooltipLinks(
		tooltip: HTMLElement,
		events: CalendarEvent[],
		renderComponent: Component,
	): Promise<void> {
		const markdown = events
			.map((event) => {
				const kindSymbol = event.kind === 'ctime' ? '+' : '⟳';
				const alias = `${kindSymbol} ${event.name}`;
				const link = this.app.fileManager.generateMarkdownLink(
					event.targetFile,
					this.sourcePath,
					undefined,
					alias,
				);
				return `- ${link}`;
			})
			.join('\n');

		try {
			await MarkdownRenderer.render(
				this.app,
				markdown,
				tooltip,
				this.sourcePath,
				renderComponent,
			);
		} catch {
			if (this.tooltipEl === tooltip) {
				this.closeTooltip();
			}
			return;
		}

		if (
			this.tooltipEl !== tooltip ||
			this.tooltipRenderComponent !== renderComponent
		) {
			return;
		}

		const links = tooltip.querySelectorAll<HTMLAnchorElement>('a.internal-link');
		for (const [index, link] of Array.from(links).entries()) {
			const event = events[index];
			if (event === undefined) {
				continue;
			}

			link.addClass(
				'history-calendar__tooltip-link',
				`is-${event.kind}`,
			);
			if (event.targetFile.extension === 'canvas') {
				const row = link.parentElement;
				row?.addClass('history-calendar__tooltip-row');
				row?.createSpan({
					cls: 'history-calendar__file-type',
					text: 'CANVAS',
				});
			}
			this.bindTooltipLink(link, event);
		}

		this.tooltipReady = true;
		this.positionTooltip();
	}

	private bindTooltipLink(
		link: HTMLAnchorElement,
		event: CalendarEvent,
	): void {
		const openLink = (mouseEvent: MouseEvent): void => {
			mouseEvent.preventDefault();
			mouseEvent.stopPropagation();
			void this.app.workspace.openLinkText(
				event.targetFile.path,
				this.sourcePath,
				Keymap.isModEvent(mouseEvent),
			);
		};

		link.addEventListener('click', openLink);
		link.addEventListener('auxclick', (mouseEvent) => {
			if (mouseEvent.button === 1) {
				openLink(mouseEvent);
			}
		});
		link.addEventListener('contextmenu', (mouseEvent) => {
			mouseEvent.preventDefault();
			mouseEvent.stopPropagation();

			const menu = new Menu();
			this.app.workspace.handleLinkContextMenu(
				menu,
				event.targetFile.path,
				this.sourcePath,
				this.getSourceLeaf() ?? undefined,
			);
			menu.showAtMouseEvent(mouseEvent);
		});
		link.addEventListener('mouseenter', (mouseEvent) => {
			this.cancelLinkPreview();
			this.linkPreviewTimer = this.getOwnerWindow().setTimeout(() => {
				this.linkPreviewTimer = null;
				if (!link.isConnected || !link.matches(':hover')) {
					return;
				}

				this.app.workspace.trigger('hover-link', {
					event: mouseEvent,
					source: HISTORY_CODE_BLOCK,
					hoverParent: this,
					targetEl: link,
					linktext: event.targetFile.path,
					sourcePath: this.sourcePath,
				});
			}, LINK_PREVIEW_DELAY);
		});
		link.addEventListener('mouseleave', () => {
			this.cancelLinkPreview();
		});
	}

	private getSourceLeaf(): WorkspaceLeaf | null {
		let sourceLeaf: WorkspaceLeaf | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.containerEl.contains(this.containerEl)) {
				sourceLeaf = leaf;
			}
		});
		return sourceLeaf;
	}

	private positionTooltip(): void {
		const tooltip = this.tooltipEl;
		const anchorEl = this.tooltipAnchorEl;
		if (
			tooltip === null ||
			anchorEl === null ||
			!anchorEl.isConnected
		) {
			this.closeTooltip();
			return;
		}

		if (!this.tooltipReady) {
			return;
		}

		const boundary = this.getTooltipBoundary();
		const anchorRect = anchorEl.getBoundingClientRect();
		if (
			anchorRect.bottom <= boundary.top ||
			anchorRect.top >= boundary.bottom ||
			anchorRect.right <= boundary.left ||
			anchorRect.left >= boundary.right
		) {
			this.closeTooltip();
			return;
		}

		const availableWidth =
			boundary.right - boundary.left - TOOLTIP_LAYOUT_MARGIN * 2;
		if (availableWidth < TOOLTIP_MIN_AVAILABLE_SIZE) {
			this.closeTooltip();
			return;
		}

		const tooltipMaxWidth = Math.min(TOOLTIP_MAX_WIDTH, availableWidth);
		const tooltipMinWidth = Math.min(TOOLTIP_MIN_WIDTH, tooltipMaxWidth);
		tooltip.setCssProps({
			'--history-calendar-tooltip-min-width': `${tooltipMinWidth}px`,
			'--history-calendar-tooltip-max-width': `${tooltipMaxWidth}px`,
			'--history-calendar-tooltip-max-height': 'none',
		});

		const naturalHeight = Math.min(
			tooltip.getBoundingClientRect().height,
			TOOLTIP_MAX_HEIGHT,
		);
		const spaceAbove =
			anchorRect.top -
			(boundary.top + TOOLTIP_LAYOUT_MARGIN) -
			TOOLTIP_GAP;
		const spaceBelow =
			boundary.bottom -
			TOOLTIP_LAYOUT_MARGIN -
			anchorRect.bottom -
			TOOLTIP_GAP;
		const placeBelow =
			spaceBelow >= naturalHeight || spaceBelow >= spaceAbove;
		const availableHeight = placeBelow ? spaceBelow : spaceAbove;

		if (availableHeight < TOOLTIP_MIN_AVAILABLE_SIZE) {
			this.closeTooltip();
			return;
		}

		const maximumHeight = Math.min(
			TOOLTIP_MAX_HEIGHT,
			availableHeight,
		);
		tooltip.setCssProps({
			'--history-calendar-tooltip-max-height': `${maximumHeight}px`,
		});

		const tooltipRect = tooltip.getBoundingClientRect();
		const preferredLeft =
			anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
		const minimumLeft = boundary.left + TOOLTIP_LAYOUT_MARGIN;
		const maximumLeft =
			boundary.right - TOOLTIP_LAYOUT_MARGIN - tooltipRect.width;
		const left = Math.min(
			Math.max(preferredLeft, minimumLeft),
			maximumLeft,
		);
		const top = placeBelow
			? anchorRect.bottom + TOOLTIP_GAP
			: anchorRect.top - TOOLTIP_GAP - tooltipRect.height;

		tooltip.setCssProps({
			'--history-calendar-tooltip-left': `${Math.round(left)}px`,
			'--history-calendar-tooltip-top': `${Math.round(top)}px`,
		});
		tooltip.addClass('is-positioned');
	}

	private getTooltipBoundary(): {
		top: number;
		right: number;
		bottom: number;
		left: number;
	} {
		const ownerWindow = this.getOwnerWindow();
		const viewport = {
			top: 0,
			right: ownerWindow.innerWidth,
			bottom: ownerWindow.innerHeight,
			left: 0,
		};
		const layoutEl =
			this.containerEl.closest<HTMLElement>('.view-content') ??
			this.containerEl.closest<HTMLElement>('.workspace-leaf-content');
		if (layoutEl === null) {
			return viewport;
		}

		const layoutRect = layoutEl.getBoundingClientRect();
		const boundary = {
			top: Math.max(viewport.top, layoutRect.top),
			right: Math.min(viewport.right, layoutRect.right),
			bottom: Math.min(viewport.bottom, layoutRect.bottom),
			left: Math.max(viewport.left, layoutRect.left),
		};

		if (
			boundary.right <= boundary.left ||
			boundary.bottom <= boundary.top
		) {
			return viewport;
		}

		return boundary;
	}

	private scheduleTooltipPosition(): void {
		if (this.tooltipEl === null || this.tooltipPositionFrame !== null) {
			return;
		}

		this.tooltipPositionFrame = this.getOwnerWindow().requestAnimationFrame(
			() => {
				this.tooltipPositionFrame = null;
				this.positionTooltip();
			},
		);
	}

	private shouldDeferTooltipSwitch(
		anchorEl: HTMLElement,
		events: CalendarEvent[],
		pointerEvent: PointerEvent,
	): boolean {
		if (
			this.tooltipAnchorEl === null ||
			this.tooltipAnchorEl === anchorEl ||
			!this.isInsideTooltipSafeTriangle(pointerEvent)
		) {
			this.clearTooltipIntent();
			return false;
		}

		this.tooltipCandidate = { anchorEl, events };
		this.scheduleTooltipClose(TOOLTIP_INTENT_DELAY);
		return true;
	}

	private createTooltipSafeTriangle(
		pointerEvent: PointerEvent,
	): [Point, Point, Point] | null {
		const tooltip = this.tooltipEl;
		const anchorEl = this.tooltipAnchorEl;
		if (
			tooltip === null ||
			anchorEl === null ||
			!tooltip.hasClass('is-positioned')
		) {
			return null;
		}

		const tooltipRect = tooltip.getBoundingClientRect();
		const anchorRect = anchorEl.getBoundingClientRect();
		const edgeY = tooltipRect.top >= anchorRect.bottom
			? tooltipRect.top
			: tooltipRect.bottom;

		return [
			{ x: pointerEvent.clientX, y: pointerEvent.clientY },
			{ x: tooltipRect.left, y: edgeY },
			{ x: tooltipRect.right, y: edgeY },
		];
	}

	private isInsideTooltipSafeTriangle(pointerEvent: PointerEvent): boolean {
		const triangle = this.tooltipSafeTriangle;
		return (
			triangle !== null &&
			isPointInTriangle(
				{ x: pointerEvent.clientX, y: pointerEvent.clientY },
				...triangle,
			)
		);
	}

	private clearTooltipIntent(): void {
		this.tooltipCandidate = null;
		this.tooltipSafeTriangle = null;
	}

	private scheduleTooltipClose(delay = TOOLTIP_CLOSE_DELAY): void {
		this.cancelTooltipClose();
		this.tooltipCloseTimer = this.getOwnerWindow().setTimeout(() => {
			this.tooltipCloseTimer = null;

			const activeElement = this.containerEl.ownerDocument.activeElement;
			const hoverPreviewEl = this.hoverPopover?.hoverEl;
			if (
				this.tooltipAnchorEl?.matches(':hover') ||
				this.tooltipEl?.matches(':hover') ||
				(activeElement !== null &&
					(this.tooltipAnchorEl?.contains(activeElement) ||
						this.tooltipEl?.contains(activeElement))) ||
				hoverPreviewEl?.matches(':hover') ||
				(activeElement !== null &&
					hoverPreviewEl?.contains(activeElement))
			) {
				if (
					hoverPreviewEl?.matches(':hover') ||
					(activeElement !== null &&
						hoverPreviewEl?.contains(activeElement))
				) {
					this.scheduleTooltipClose();
				}
				return;
			}

			const candidate = this.tooltipCandidate;
			if (candidate?.anchorEl.matches(':hover')) {
				this.clearTooltipIntent();
				this.showTooltip(candidate.anchorEl, candidate.events);
				return;
			}

			this.closeTooltip();
		}, delay);
	}

	private cancelTooltipClose(): void {
		if (this.tooltipCloseTimer === null) {
			return;
		}

		this.getOwnerWindow().clearTimeout(this.tooltipCloseTimer);
		this.tooltipCloseTimer = null;
	}

	private closeTooltip(): void {
		this.cancelTooltipClose();
		this.cancelLinkPreview();
		this.clearTooltipIntent();

		if (this.tooltipPositionFrame !== null) {
			this.getOwnerWindow().cancelAnimationFrame(this.tooltipPositionFrame);
			this.tooltipPositionFrame = null;
		}

		this.tooltipEl?.remove();
		this.tooltipEl = null;
		this.tooltipAnchorEl = null;
		this.tooltipReady = false;
		this.tooltipRenderComponent?.unload();
		this.tooltipRenderComponent = null;
	}

	private cancelLinkPreview(): void {
		if (this.linkPreviewTimer === null) {
			return;
		}

		this.getOwnerWindow().clearTimeout(this.linkPreviewTimer);
		this.linkPreviewTimer = null;
	}

	private getOwnerWindow(): Window {
		return this.containerEl.ownerDocument.defaultView ?? window;
	}

	private toDayKey(value: unknown): string | null {
		const configuredFormat = this.getSettings().dateFormat.trim();
		let parsed: MomentValue;

		if (typeof value === 'string' && configuredFormat.length > 0) {
			parsed = moment(value, configuredFormat, true);
			if (!parsed.isValid()) {
				parsed = moment(value);
			}
		} else {
			parsed = moment(value as never);
		}

		return parsed.isValid() ? parsed.format(DAY_KEY_FORMAT) : null;
	}

	private includesFile(file: TFile): boolean {
		if (file.extension !== 'md' && file.extension !== 'canvas') {
			return false;
		}

		const folder = this.options.folder;
		return folder === null || file.path.startsWith(`${folder}/`);
	}

	private createNavigationButton(
		container: HTMLElement,
		text: string,
		label: string,
		onClick: () => void,
	): void {
		const button = container.createEl('button', {
			cls: 'history-calendar__button',
			text,
			attr: { 'aria-label': label, title: label, type: 'button' },
		});
		button.addEventListener('click', onClick);
	}

	private createYearSelect(container: HTMLElement): void {
		const selectedYear = this.visibleMonth.year();
		const dropdown = new DropdownComponent(container);
		dropdown.selectEl.addClasses([
			'history-calendar__date-select',
			'history-calendar__year-select',
		]);
		dropdown.selectEl.setAttrs({
			'aria-label': this.messages.selectYear,
			title: this.messages.selectYear,
		});

		for (let year = selectedYear - 10; year <= selectedYear + 10; year += 1) {
			dropdown.addOption(String(year), this.messages.formatYear(year));
		}

		dropdown.setValue(String(selectedYear)).onChange((value) => {
			this.visibleMonth.year(Number(value));
			void this.renderCalendar();
		});
	}

	private createMonthSelect(container: HTMLElement): void {
		const selectedMonth = this.visibleMonth.month();
		const dropdown = new DropdownComponent(container);
		dropdown.selectEl.addClasses([
			'history-calendar__date-select',
			'history-calendar__month-select',
		]);
		dropdown.selectEl.setAttrs({
			'aria-label': this.messages.selectMonth,
			title: this.messages.selectMonth,
		});

		for (let month = 0; month < 12; month += 1) {
			dropdown.addOption(
				String(month),
				this.messages.months[month] ?? String(month + 1),
			);
		}

		dropdown.setValue(String(selectedMonth)).onChange((value) => {
			this.visibleMonth.month(Number(value));
			void this.renderCalendar();
		});
	}
}
