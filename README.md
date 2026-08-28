# History

[English](./README.md) | [한국어](./README_KO.md) | [简体中文](./README_CN.md)

![History calendar](./history-calendar.png)

History automatically records when notes and canvases are created or edited, then displays the activity in an interactive calendar. Purple dots mark creation dates, cyan dots mark edit dates, and hovering over a day reveals every file. Narrow calendars switch the dots to compact colored counts.

## How to use

1. Enable the plugin. History automatically manages the `history` frontmatter property for Markdown notes and the root `history` array for Canvas files.
2. Add this code block to any note where you want the calendar:

````markdown
```history
```
````
3. To keep the same calendar in the right sidebar, run **History: Open history calendar** from the command palette.

Optionally scale a note-embedded calendar to a maximum width; its controls and height shrink proportionally. In editing or reading mode, hover the calendar and drag its bottom-right handle; the new `max-width` is saved back to the code block. Sidebar calendars use the same proportional scaling when their pane is resized, but do not show the handle.

````markdown
```history
max-width: 500
mode: number
align: center
```
````

`mode: number` always shows purple and mint event counts instead of dots; omit it for automatic display. `align` accepts `left`, `center`, or `right`.

Calendar dates also integrate with Obsidian's Daily Notes core plugin. Dates with an existing daily note are bold and underlined; clicking a date opens its note or asks before creating a missing one with your configured folder, format, and template.
