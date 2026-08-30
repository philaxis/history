export type HistoryMessages = {
	thisMonth: string;
	goToCurrentMonth: string;
	previousMonth: string;
	nextMonth: string;
	selectYear: string;
	selectMonth: string;
	weekdays: readonly string[];
	months: readonly string[];
	formatYear: (year: number) => string;
	moreEvents: (count: number) => string;
	calendarTitle: string;
	openCalendar: string;
	dailyNotesDisabled: string;
	dailyNoteCreateFailed: string;
	dailyNoteCreateTitle: string;
	dailyNoteCreatePrompt: (date: string) => string;
	cancel: string;
	create: string;
	remove: string;
	resizeCalendar: string;
	calendarWidthSaveFailed: string;
	removeHistoryDate: string;
	removeHistoryDatePrompt: (name: string, date: string) => string;
	removeHistoryDateFailed: string;
	historyDeleteButtons: string;
	historyDeleteButtonsDescription: string;
	sidebarCellRatio: string;
	sidebarCellRatioDescription: string;
	sidebarFontSize: string;
	sidebarFontSizeDescription: string;
	sidebarMarkerSize: string;
	sidebarMarkerSizeDescription: string;
	sidebarSettings: string;
	sidebarMarkerMode: string;
	sidebarMarkerModeDescription: string;
	markerNumbers: string;
	markerDots: string;
	autoTrackEdits: string;
	autoTrackEditsDescription: string;
	frontmatterProperty: string;
	frontmatterPropertyDescription: string;
	dateFormat: string;
	dateFormatDescription: string;
};

const NUMERIC_MONTHS = Array.from(
	{ length: 12 },
	(_, index) => String(index + 1),
);

const ENGLISH: HistoryMessages = {
	thisMonth: 'This month',
	goToCurrentMonth: 'Go to current month',
	previousMonth: 'Previous month',
	nextMonth: 'Next month',
	selectYear: 'Select year',
	selectMonth: 'Select month',
	weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
	months: NUMERIC_MONTHS,
	formatYear: String,
	moreEvents: (count) => `${count} more events`,
	calendarTitle: 'History calendar',
	openCalendar: 'Open history calendar',
	dailyNotesDisabled: 'Enable the Daily Notes core plugin first.',
	dailyNoteCreateFailed: 'Failed to create the daily note.',
	dailyNoteCreateTitle: 'Create daily note',
	dailyNoteCreatePrompt: (date) =>
		`The daily note for ${date} does not exist. Create it?`,
	cancel: 'Cancel',
	create: 'Create',
	remove: 'Remove',
	resizeCalendar: 'Resize calendar',
	calendarWidthSaveFailed: 'Failed to save the calendar width.',
	removeHistoryDate: 'Remove this history date',
	removeHistoryDatePrompt: (name, date) =>
		`Remove ${date} from the history of "${name}"?`,
	removeHistoryDateFailed: 'Failed to remove the history date.',
	historyDeleteButtons: 'History delete buttons',
	historyDeleteButtonsDescription:
		'Show an × button for removing individual history dates. Default: off.',
	sidebarCellRatio: 'Sidebar cell ratio',
	sidebarCellRatioDescription:
		'Cell width divided by height in the sidebar calendar. Default: 0.6.',
	sidebarFontSize: 'Sidebar font size',
	sidebarFontSizeDescription:
		'Text size multiplier for the sidebar calendar, from 0.5 to 3.0. Default: 2.0.',
	sidebarMarkerSize: 'Sidebar marker size',
	sidebarMarkerSizeDescription:
		'Dot and event-count size multiplier, from 0.5 to 4.0. Default: 3.0.',
	sidebarSettings: 'Sidebar calendar',
	sidebarMarkerMode: 'Sidebar markers',
	sidebarMarkerModeDescription:
		'Show event totals as numbers or individual dots. Default: numbers.',
	markerNumbers: 'Numbers',
	markerDots: 'Dots',
	autoTrackEdits: 'Auto-track edits',
	autoTrackEditsDescription:
		'Add a date when you edit the active Markdown note or canvas.',
	frontmatterProperty: 'Frontmatter property',
	frontmatterPropertyDescription:
		'List property used to store Markdown history dates. Canvas always uses history. Default: history.',
	dateFormat: 'Date format',
	dateFormatDescription:
		'Moment.js format used for each date. Default: YYYY-MM-DD.',
};

const KOREAN: HistoryMessages = {
	...ENGLISH,
	thisMonth: '이번달',
	goToCurrentMonth: '이번 달로 이동',
	previousMonth: '이전 달',
	nextMonth: '다음 달',
	selectYear: '연도 선택',
	selectMonth: '월 선택',
	weekdays: ['일', '월', '화', '수', '목', '금', '토'],
	moreEvents: (count) => `${count}개 더 있음`,
	calendarTitle: '히스토리 달력',
	openCalendar: '히스토리 달력 열기',
	dailyNotesDisabled: '먼저 코어 플러그인 「일일 노트」를 활성화하세요.',
	dailyNoteCreateFailed: '일일 노트를 생성하지 못했습니다.',
	dailyNoteCreateTitle: '일일 노트 생성',
	dailyNoteCreatePrompt: (date) =>
		`${date}의 일일 노트가 없습니다. 생성할까요?`,
	cancel: '취소',
	create: '생성',
	remove: '삭제',
	resizeCalendar: '달력 크기 조절',
	calendarWidthSaveFailed: '달력 너비를 저장하지 못했습니다.',
	removeHistoryDate: '이 히스토리 날짜 삭제',
	removeHistoryDatePrompt: (name, date) =>
		`"${name}"의 ${date} 히스토리를 삭제할까요?`,
	removeHistoryDateFailed: '히스토리 날짜를 삭제하지 못했습니다.',
	historyDeleteButtons: '히스토리 삭제 버튼',
	historyDeleteButtonsDescription:
		'각 히스토리 날짜를 지우는 × 버튼을 표시합니다. 기본값: 꺼짐.',
	sidebarCellRatio: '사이드바 셀 비율',
	sidebarCellRatioDescription:
		'사이드바 달력 셀의 가로 ÷ 세로 비율입니다. 기본값: 0.6.',
	sidebarFontSize: '사이드바 글자 배율',
	sidebarFontSizeDescription:
		'사이드바 달력 글자의 크기 배율입니다. 0.5–3.0, 기본값: 2.0.',
	sidebarMarkerSize: '사이드바 마커 배율',
	sidebarMarkerSizeDescription:
		'점과 이벤트 개수 표시의 크기 배율입니다. 0.5–4.0, 기본값: 3.0.',
	sidebarSettings: '사이드바 달력',
	sidebarMarkerMode: '사이드바 마커',
	sidebarMarkerModeDescription:
		'이벤트 합계를 숫자 또는 개별 점으로 표시합니다. 기본값: 숫자.',
	markerNumbers: '숫자',
	markerDots: '점',
	autoTrackEdits: '편집 자동 추적',
	autoTrackEditsDescription:
		'사용자가 활성 Markdown 노트나 캔버스를 편집하면 날짜를 추가합니다.',
	frontmatterProperty: '프론트매터 속성',
	frontmatterPropertyDescription:
		'Markdown 히스토리 날짜를 저장할 목록 속성입니다. 캔버스는 항상 history를 사용합니다. 기본값: history.',
	dateFormat: '날짜 형식',
	dateFormatDescription:
		'각 날짜에 사용할 Moment.js 형식입니다. 기본값: YYYY-MM-DD.',
};

const CHINESE: HistoryMessages = {
	...ENGLISH,
	thisMonth: '本月',
	goToCurrentMonth: '前往本月',
	previousMonth: '上个月',
	nextMonth: '下个月',
	selectYear: '选择年份',
	selectMonth: '选择月份',
	weekdays: ['日', '一', '二', '三', '四', '五', '六'],
	moreEvents: (count) => `另有 ${count} 个事件`,
	remove: '删除',
	removeHistoryDate: '删除此历史日期',
	removeHistoryDatePrompt: (name, date) =>
		`要从“${name}”的历史中删除 ${date} 吗？`,
	removeHistoryDateFailed: '无法删除历史日期。',
	autoTrackEdits: '自动跟踪编辑',
	autoTrackEditsDescription:
		'用户编辑当前 Markdown 笔记或画布时添加日期。',
	frontmatterProperty: 'Frontmatter 属性',
	frontmatterPropertyDescription:
		'用于存储 Markdown 历史日期的列表属性。画布始终使用 history。默认值：history。',
	dateFormat: '日期格式',
	dateFormatDescription:
		'每个日期使用的 Moment.js 格式。默认值：YYYY-MM-DD。',
};

const TRADITIONAL_CHINESE: HistoryMessages = {
	...CHINESE,
	previousMonth: '上一個月',
	nextMonth: '下一個月',
	selectYear: '選擇年份',
	selectMonth: '選擇月份',
	moreEvents: (count) => `另有 ${count} 個事件`,
	autoTrackEdits: '自動追蹤編輯',
	autoTrackEditsDescription:
		'修改目前的 Markdown 筆記或畫布時新增日期。',
	frontmatterProperty: 'Frontmatter 屬性',
	frontmatterPropertyDescription:
		'用於儲存 Markdown 歷史日期的清單屬性。畫布一律使用 history。預設值：history。',
	dateFormatDescription:
		'每個日期使用的 Moment.js 格式。預設值：YYYY-MM-DD。',
};

export function getHistoryMessages(language: string): HistoryMessages {
	const normalizedLanguage = language.toLowerCase();
	if (normalizedLanguage === 'ko') {
		return KOREAN;
	}
	if (normalizedLanguage === 'zh-tw') {
		return TRADITIONAL_CHINESE;
	}
	if (normalizedLanguage.startsWith('zh')) {
		return CHINESE;
	}
	return ENGLISH;
}
