import {
	App,
	moment,
	PluginSettingTab,
	Setting,
} from 'obsidian';

import { getHistoryMessages } from './i18n';
import type HistoryPlugin from './main';
import {
	DEFAULT_SIDEBAR_CELL_RATIO,
	DEFAULT_SIDEBAR_FONT_SIZE,
	DEFAULT_SIDEBAR_MODE,
	MAX_CALENDAR_FONT_SIZE,
	MIN_CALENDAR_FONT_SIZE,
} from './calendar-options';

export interface HistorySettings {
	propertyName: string;
	dateFormat: string;
	autoTrackingEnabled: boolean;
	sidebarCellRatio: number;
	sidebarFontSize: number;
	sidebarMode: 'dots' | 'number';
}

export const DEFAULT_SETTINGS: HistorySettings = {
	propertyName: 'history',
	dateFormat: 'YYYY-MM-DD',
	autoTrackingEnabled: true,
	sidebarCellRatio: DEFAULT_SIDEBAR_CELL_RATIO,
	sidebarFontSize: DEFAULT_SIDEBAR_FONT_SIZE,
	sidebarMode: DEFAULT_SIDEBAR_MODE,
};

export class HistorySettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: HistoryPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		this.containerEl.empty();
		const messages = getHistoryMessages(moment.locale());

		new Setting(this.containerEl)
			.setName(messages.autoTrackEdits)
			.setDesc(messages.autoTrackEditsDescription)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoTrackingEnabled)
					.onChange(async (value) => {
						this.plugin.settings.autoTrackingEnabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(messages.frontmatterProperty)
			.setDesc(messages.frontmatterPropertyDescription)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.propertyName)
					.setValue(this.plugin.settings.propertyName)
					.onChange(async (value) => {
						this.plugin.settings.propertyName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(messages.dateFormat)
			.setDesc(messages.dateFormatDescription)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.dateFormat)
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(messages.sidebarSettings)
			.setHeading();

		new Setting(this.containerEl)
			.setName(messages.sidebarCellRatio)
			.setDesc(messages.sidebarCellRatioDescription)
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = '0.1';
				text.inputEl.step = '0.1';
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.sidebarCellRatio))
					.setValue(String(this.plugin.settings.sidebarCellRatio))
					.onChange(async (value) => {
						const ratio = Number(value);
						if (!Number.isFinite(ratio) || ratio <= 0) {
							return;
						}
						this.plugin.settings.sidebarCellRatio = ratio;
						await this.plugin.saveSettings();
					});
			});

		new Setting(this.containerEl)
			.setName(messages.sidebarMarkerMode)
			.setDesc(messages.sidebarMarkerModeDescription)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('number', messages.markerNumbers)
					.addOption('dots', messages.markerDots)
					.setValue(this.plugin.settings.sidebarMode)
					.onChange(async (value) => {
						this.plugin.settings.sidebarMode = value === 'dots'
							? 'dots'
							: 'number';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(messages.sidebarFontSize)
			.setDesc(messages.sidebarFontSizeDescription)
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = String(MIN_CALENDAR_FONT_SIZE);
				text.inputEl.max = String(MAX_CALENDAR_FONT_SIZE);
				text.inputEl.step = '0.1';
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.sidebarFontSize))
					.setValue(String(this.plugin.settings.sidebarFontSize))
					.onChange(async (value) => {
						if (value.trim() === '') {
							return;
						}
						const fontSize = Number(value);
						if (!Number.isFinite(fontSize)) {
							return;
						}
						this.plugin.settings.sidebarFontSize = Math.min(
							MAX_CALENDAR_FONT_SIZE,
							Math.max(MIN_CALENDAR_FONT_SIZE, fontSize),
						);
						await this.plugin.saveSettings();
					});
			});
	}
}
