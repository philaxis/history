import {
	appendCanvasHistoryDate,
	getCanvasHistory,
	getCanvasTrackingState,
} from '../src/canvas-data.ts';
import {
	DEFAULT_SIDEBAR_CELL_RATIO,
	DEFAULT_SIDEBAR_FONT_SIZE,
	DEFAULT_SIDEBAR_MARKER_SIZE,
	DEFAULT_SIDEBAR_MODE,
	MAX_SIDEBAR_FONT_SIZE,
	MAX_SIDEBAR_MARKER_SIZE,
	parseCalendarOptions,
} from '../src/calendar-options.ts';
import {
	getCalendarScale,
	updateCalendarMaxWidth,
} from '../src/calendar-width.ts';
import { renderDailyNoteTemplate } from '../src/daily-note-template.ts';
import { getHistoryMessages } from '../src/i18n.ts';
import { isPointInTriangle } from '../src/pointer-intent.ts';
import {
	buildMarkdownTrackingState,
	splitMarkdownFrontmatter,
} from '../src/tracking-state.ts';

function assert(condition: boolean, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

const source = JSON.stringify({ nodes: [], edges: [] });
const updated = appendCanvasHistoryDate(source, '2026-08-28');

assert(
	JSON.stringify(getCanvasHistory(updated)) === '["2026-08-28"]',
	'Canvas history was not added.',
);
assert(
	appendCanvasHistoryDate(updated, '2026-08-28') === updated,
	'Canvas history contains a duplicate date.',
);
assert(
	Object.keys(JSON.parse(updated) as object).join(',') ===
		'nodes,edges,history',
	'Canvas history is not stored at the root.',
);
assert(
	getCanvasTrackingState(
		JSON.stringify({ nodes: [], edges: [], history: ['2026-08-27'] }),
	) ===
		getCanvasTrackingState(
			JSON.stringify({ nodes: [], edges: [], history: ['2026-08-28'] }),
		),
	'History-only Canvas changes were counted.',
);
assert(getHistoryMessages('ko').thisMonth === '이번달', 'Korean locale failed.');
assert(getHistoryMessages('zh').thisMonth === '本月', 'Chinese locale failed.');
for (const language of ['en', 'ko', 'zh']) {
	assert(
		getHistoryMessages(language).formatYear(2026) === '2026',
		`${language} year format failed.`,
	);
}
assert(
	getHistoryMessages('zh-TW').selectYear === '選擇年份',
	'Traditional Chinese locale failed.',
);
assert(
	getHistoryMessages('de').thisMonth === 'This month',
	'English fallback failed.',
);
assert(
	getHistoryMessages('en').weekdays.join(',') ===
		'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
	'English weekday abbreviations failed.',
);
assert(
	renderDailyNoteTemplate(
		'{{date}} | {{date:YYYY/MM}} | {{time}} | {{time:HH}} | {{title}}',
		'2026-08-28',
		(format) => format === null ? '2026-08-28' : `date:${format}`,
		(format) => format === null ? '14:30' : `time:${format}`,
	) ===
		'2026-08-28 | date:YYYY/MM | 14:30 | time:HH | 2026-08-28',
	'Daily note template tokens were not replaced.',
);
assert(
	updateCalendarMaxWidth(
		'Before\n```history\nfolder: notes\n```\nAfter',
		1,
		3,
		420,
	) === 'Before\n```history\nfolder: notes\nmax-width: 420\n```\nAfter',
	'Missing calendar max-width was not saved.',
);
assert(
	updateCalendarMaxWidth(
		'```history\r\nmax-width: 500\r\n```',
		0,
		2,
		360,
	) === '```history\r\nmax-width: 360\r\n```',
	'Existing calendar max-width was not updated.',
);
assert(
	JSON.stringify(getCalendarScale(500, 800, 800)) ===
		'{"width":500,"scale":0.625}',
	'Calendar max-width did not scale both dimensions proportionally.',
);
assert(
	JSON.stringify(getCalendarScale(null, 500, 800)) ===
		JSON.stringify(getCalendarScale(500, 800, 800)),
	'Sidebar and embedded calendars did not use the same scale.',
);
assert(
	JSON.stringify(parseCalendarOptions('mode: number\nalign: right')) ===
		'{"folder":null,"maxWidth":502,"mode":"number","align":"right","ratio":1.2,"fontSize":1,"markerSize":1.2}',
	'Calendar number mode or alignment was not parsed.',
);
assert(
	JSON.stringify(parseCalendarOptions('mode: dots\nalign: middle')) ===
		'{"folder":null,"maxWidth":502,"mode":"auto","align":"left","ratio":1.2,"fontSize":1,"markerSize":1.2}',
	'Invalid calendar display options did not use safe defaults.',
);
assert(
	parseCalendarOptions('ratio: 1.2').ratio === 1.2,
	'Calendar cell ratio was not parsed.',
);
assert(
	parseCalendarOptions('font-size: 1.2').fontSize === 1.2 &&
		parseCalendarOptions('font-size: 9').fontSize === 2,
	'Calendar font-size multiplier was not parsed or clamped.',
);
assert(
	parseCalendarOptions('marker-size: 1.4').markerSize === 1.4 &&
		parseCalendarOptions('marker-size: 9').markerSize === 2,
	'Calendar marker-size multiplier was not parsed or clamped.',
);
assert(
	DEFAULT_SIDEBAR_MODE === 'number' &&
		DEFAULT_SIDEBAR_CELL_RATIO === 0.6 &&
		DEFAULT_SIDEBAR_FONT_SIZE === 2 &&
		DEFAULT_SIDEBAR_MARKER_SIZE === 2 &&
		MAX_SIDEBAR_FONT_SIZE === 3 &&
		MAX_SIDEBAR_MARKER_SIZE === 4,
	'Sidebar calendar defaults changed.',
);
assert(
	isPointInTriangle(
		{ x: 50, y: 50 },
		{ x: 50, y: 0 },
		{ x: 0, y: 100 },
		{ x: 100, y: 100 },
	),
	'Hover intent rejected a point inside the safe triangle.',
);
assert(
	!isPointInTriangle(
		{ x: 110, y: 50 },
		{ x: 50, y: 0 },
		{ x: 0, y: 100 },
		{ x: 100, y: 100 },
	),
	'Hover intent accepted a point outside the safe triangle.',
);
assert(
	isPointInTriangle(
		{ x: 50, y: 50 },
		{ x: 50, y: 100 },
		{ x: 100, y: 0 },
		{ x: 0, y: 0 },
	),
	'Hover intent rejected an upward safe triangle.',
);

const markdown = '---\ntitle: Note\nhistory:\n  - 2026-08-27\n---\nBody';
const markdownParts = splitMarkdownFrontmatter(markdown);
assert(markdownParts.body === 'Body', 'Markdown body split failed.');
assert(
	splitMarkdownFrontmatter('---\n---\nBody').body === 'Body',
	'Empty Markdown frontmatter split failed.',
);
assert(
	buildMarkdownTrackingState(
		{ title: 'Note', history: ['2026-08-27'] },
		markdownParts.body,
		'history',
	) ===
		buildMarkdownTrackingState(
			{ title: 'Note', history: ['2026-08-28'] },
			markdownParts.body,
			'history',
		),
	'History-only Markdown changes were counted.',
);
assert(
	buildMarkdownTrackingState(
		{ title: 'Note', history: ['2026-08-28'] },
		'Changed body',
		'history',
	) !==
		buildMarkdownTrackingState(
			{ title: 'Note', history: ['2026-08-28'] },
			markdownParts.body,
			'history',
		),
	'Markdown body changes were ignored.',
);
for (const language of ['en', 'ko', 'zh', 'zh-TW']) {
	assert(
		getHistoryMessages(language).months.join(',') ===
			'1,2,3,4,5,6,7,8,9,10,11,12',
		`${language} month labels are not numeric.`,
	);
}
