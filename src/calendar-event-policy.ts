export type CalendarEventKind = 'ctime' | 'history';

export function shouldDisplayCalendarEvent(
	kind: CalendarEventKind,
	eventDay: string,
	dailyNoteDay: string | null,
): boolean {
	return dailyNoteDay === null ||
		(kind === 'history' && eventDay !== dailyNoteDay);
}
