import {
	App,
	moment,
	PluginSettingTab,
	Setting,
} from 'obsidian';

import { getHistoryMessages } from './i18n';
import type HistoryPlugin from './main';

export interface HistorySettings {
	propertyName: string;
	dateFormat: string;
	autoTrackingEnabled: boolean;
}

export const DEFAULT_SETTINGS: HistorySettings = {
	propertyName: 'history',
	dateFormat: 'YYYY-MM-DD',
	autoTrackingEnabled: true,
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
	}
}
