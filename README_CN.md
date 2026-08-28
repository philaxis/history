# History

[English](./README.md) | [한국어](./README_KO.md) | [简体中文](./README_CN.md)

![History 日历](./history-calendar.png)

History 会自动记录笔记和画布的创建与修改日期，并在交互式日历中展示。紫色圆点表示创建日期，青色圆点表示修改日期；将鼠标悬停在某天上，即可查看当天的所有文件。

## 使用方法

1. 启用插件后，History 会自动管理 Markdown 笔记的 `history` Frontmatter 属性，以及 Canvas 文件根层的 `history` 数组。
2. 在需要显示日历的笔记中添加以下代码块：

````markdown
```history
```
````
