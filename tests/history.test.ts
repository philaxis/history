import {
	appendCanvasHistoryDate,
	getCanvasHistory,
	getCanvasTrackingState,
} from '../src/canvas-data.ts';
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
