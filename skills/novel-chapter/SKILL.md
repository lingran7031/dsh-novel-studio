---
name: novel-chapter
description: 单章循环交接协议：上下文包、计划、初稿、审阅、裁定、定稿、摘要、归档、体检与简报的全流程操作细则。
---

# 单章循环协议

本协议把"写完一章"拆成可交接、可验收、可断点续跑的步骤。Lead 与四个角色都按此执行；角色宪章管"怎么写"，本协议管"谁在什么时候交什么"。

## 一、角色与文件命名约定

- 章号 N 从 1 开始，三位补零：第 7 章写 `007`，story 目录内写 `007`。所有 story 稿件文件名以数字开头（如 `story/plans/001.md`），不要命名成 `ch-001.md`：`novel_context` 与 `novel_chapter` 按文件名开头的数字定位稿件，否则找不到。
- 定稿：`chapters/NNN.md`；计划：`story/plans/NNN.md`；初稿：`story/drafts/NNN.md`；审阅：`story/reviews/NNN.md`；打磨：`story/polished/NNN.md`；摘要：`story/summaries/NNN.md`；裁定：`story/decisions/NNNN-主题.md`（四位编号）。
- 章号来源：`novel_project(action="status")` 的 `nextChapter`；若 `chapters/` 已存在同号文件，先停下核对，不覆盖。

## 二、阶段总表

| 阶段 | 负责人 | 产物 | 依赖 |
|---|---|---|---|
| 0 上下文包 | Lead | `novel_context` 返回结果 | 上一章定稿 |
| 1 章节计划 | Writer | `story/plans/NNN.md` | 0 |
| 2 计划检查（可选） | Architect | 回复结论 | 1 |
| 3 正文初稿 | Writer | `story/drafts/NNN.md` | 1（及 2） |
| 4 审阅与打磨 | Editor | `story/reviews/NNN.md`、`story/polished/NNN.md` | 3 |
| 5 裁定（按需） | Arbiter | `story/decisions/NNNN-*.md` | 4 有争议 |
| 6 定稿 | Lead | `chapters/NNN.md` | 4/5 |
| 7 摘要 | Lead | `story/summaries/NNN.md` | 6 |
| 8 资料归档 | Architect | 资料文件更新 | 6 |
| 9 体检 | Lead | `novel_validate` 结果 | 8 |
| 10 简报与断点 | Lead | 用户简报 + `story/state.json` | 9 |

任务板上每个阶段一个任务，`blocked_by` 指向上一阶段，`write_scopes` 写对应目录；完成一个再开下一个，不要一次把十个任务全标进行中。

## 三、阶段 0：上下文包

Lead 调：

```text
novel_context(chapter=N, role="writer", budgetTokens=5000, focus="<本章目标与焦点>")
```

把返回的材料摘要、需注意的伏笔与裁定、以及本章目标，连同派单写进任务，发给 Writer。Writer 可直接复用该包，也可自己再调一次 `novel_context`（`role="writer"`）。预算默认 5000 token（工具下限 1200），信息不足时上调到 8000 或定向补读；返回的 `cacheFile` 指向 `story/context/ch-NNN-role.md`，上下文被压缩后可再读该缓存文件。不要把整章前文塞给任何人。

## 四、阶段 1：章节计划

1. Lead 派单给 Writer，必须写明：章号、本章目标（来自大纲）、范围（必须发生/不能发生）、产物路径、验收标准。
2. Writer 按 `novel-role-writer` 的计划模板写 `story/plans/NNN.md`，覆盖：本章目标、场景设计、情绪曲线、出场人物与状态、禁区、结尾钩子、预计字数。
3. Writer 回复 ≤300 字：结论 + 计划路径 + 风险（需要架构师确认的设定、需要裁定的方向）。

计划验收由 Lead 做：目标是否服务卷/弧；场景是否有推进；钩子是否成立；是否超范围新增设定。不合格退回重写，不进入初稿。

## 五、阶段 2：计划检查（可选，长篇建议做）

Lead 可派 Architect 对照大纲、人物状态、伏笔账本检查计划。Architect 按 `novel-role-architect` 第六节给结论。若有偏离：Lead 决定是改计划还是改大纲；涉及主线走向的升级裁定。

## 六、阶段 3：正文初稿

1. Lead 确认计划后派单 Writer 写正文，写明字数目标（默认 2500–3500 字）。
2. Writer 写 `story/drafts/NNN.md`，一级标题 `# 第 N 章 标题`，标题与计划、大纲一致。
3. Writer 回复 ≤300 字：路径、字数、关键情节两句话、埋/收的伏笔、请编辑重点看的位置。
4. Lead 只抽查开头与结尾各一段，确认接得住上一章、钩子成立；不读全文。

## 七、阶段 4：审阅与打磨

1. Lead 把初稿路径、本章焦点、验收标准派给 Editor。Editor 先 `novel_validate`（errors 记录并升级），再 `novel_context(chapter=N, role="editor")`，然后读初稿与资料。
2. Editor 写 `story/reviews/NNN.md`（结论、问题清单、需裁定项、打磨说明）与 `story/polished/NNN.md`。
3. Editor 回复 ≤300 字：结论（可定稿/不可定稿，阻断 X 条）+ 两个路径 + 待裁定/待作者确认项。
4. Lead 处置：阻断项涉及资料或事实冲突→交裁定者；仅文字问题→让作者按报告修订，再走 Editor 复审（只审 diff）；全部关闭后进入阶段 6。

## 八、阶段 5：裁定（按需）

有争议时，Lead 把争议点、双方证据、涉及的章节与资料文件派给 Arbiter。Arbiter 按 `novel-role-arbiter` 流程写 `story/decisions/NNNN-主题.md`，必要时更新 `meta/compass.json`，回复 ≤300 字。裁定结论必须由执行人落实：资料问题由 Architect 改，正文问题由 Writer 改、Editor 复审；Lead 复核后才继续。

## 九、阶段 6：定稿（promote）

Lead 确认四个条件：审阅结论可定稿、阻断项清零、`novel_validate` errors 为空、无未决裁定。然后调：

```text
novel_chapter(action="promote", chapter=N, from="polished")
```

标题与打磨稿一致时不必传 `title`；读回 `chapters/NNN.md` 核对 H1 与打磨稿一致。若该章已有定稿且内容不同，`promote` 默认拒绝覆盖，确认重定稿才传 `force=true`（自动写 `.bak` 备份）。仅当 Editor 书面写明"无需打磨"时才用 `from="draft"`，并在任务板记录理由。

`promote` 会自动写入 `chapters/NNN.md`、更新 `meta/progress.json` 的 `completed_chapters` 与 `words`，并把 `story/state.json` 的 `stage` 设为 `writing`、`last_chapter` 设为 N；`from` 缺省 `polished`，找不到打磨稿时会自动回退 `draft`。定稿后仍要核对：调 `novel_project(action="status")` 看 `lastChapter`、`chapters`、`missing`；读 `chapters/NNN.md` 确认内容完整、无标记；若进度确未更新，再用 `edit` 修正。

## 十、阶段 7：摘要

Lead 调：

```text
novel_chapter(action="summary", chapter=N, summary="<不超过 200 字的摘要>")
```

工具会写入 `story/summaries/NNN.md` 并在开头补一级标题；`summary` 不能为空，建议 ≤800 字（团队内控 200 字左右）。摘要写事实不写评价：本章推进、人物状态变化、埋下或回收的伏笔编号、结尾留下的处境。摘要会进入后续章节的上下文包，写砸会污染后面所有章，所以要具体、可检索。

## 十一、阶段 8：资料归档

Lead 派 Architect 归档：`timeline.jsonl`、`foreshadow_ledger.json`、`relationship_state.json`、`characters.json` 状态、大纲实况；Architect 回复变更条目。归档必须基于定稿正文与摘要，不凭计划想象。归档完成前不跑最终体检。

## 十二、阶段 9：体检

Lead 调：

```text
novel_validate(maxItems=40)
```

处理规则：`errors` 必须清零才能汇报，资料错误交 Architect 修，进度/章节错误 Lead 自己修；`warnings` 逐条判断，与本章相关的修掉，历史遗留的记入任务板待办，不阻塞本章汇报但要在简报里提一句。

## 十三、阶段 10：简报与断点

1. Lead 调 `novel_chapter(action="checkpoint", stage="writing", note="第 N 章定稿，下一步第 N+1 章")` 记录断点；`promote` 已把 `story/state.json` 的阶段设为 `writing` 并更新 `last_chapter`，这里补记 note。
2. 给用户章节简报（≤200 字）：章节号与标题、字数、关键情节两句、伏笔埋/收、待决问题、下一步。
3. 判断是否到检查点（见 `novel-studio` 第八节）：到则停下问方向；否则直接开下一章，把本章任务全部 complete。

## 十四、卷末与导出

每卷结束：`novel_validate` 全量体检；Arbiter 与 Architect 复盘 `meta/compass.json` 与下卷大纲；Lead 把"本卷回顾 + 下卷计划 + 需要用户拍板的选项"报给用户；用户确认后调 `novel_chapter(action="export")` 导出（默认 `export/novel.md`；需要 Word 稿时传 `format="docx"` 生成 `export/novel.docx`；可用 `title` 指定书名），把工具返回的路径、章数与字数转告用户。导出不改变项目资料，不替代 `chapters/` 定稿。

## 十五、完成定义（Definition of Done）

一章只有在以下全部成立时才算完成：

- [ ] `chapters/NNN.md` 存在且内容完整，标题格式正确；
- [ ] `story/summaries/NNN.md` 存在，摘要可读；
- [ ] 资料归档完成，时间线、伏笔、关系、人物状态与正文一致；
- [ ] `novel_validate` errors 为 0；
- [ ] `meta/progress.json` 的 `completed_chapters` 包含 N；
- [ ] 任务板本章任务全部 completed；
- [ ] `story/state.json` 已 checkpoint；
- [ ] 用户收到简报或检查点询问。

## 十六、任务板与派单模板

任务：subject 用 `第N章·<阶段>`；description 写产物路径、验收标准、特别注意；write_scopes 标目录；blocked_by 指前序任务。派单消息模板：

```text
任务：第 N 章 <阶段>。
项目：<绝对路径>。章号：N。本章目标：<一句话>。
输入：<文件路径或上下文包要点>。产物：<文件路径>。
验收：<两条可检查标准>。交付回复 ≤300 字，含结论、路径、风险。
```

## 十七、异常与断点

| 现象 | 处理 |
|---|---|
| 某阶段产物已存在但任务未完成 | 先读产物判断质量，合格则补验收并完成，不合格重做 |
| Writer 卡住或反复跑题 | Lead 补发上下文包与目标；仍不行换派单措辞；再不行为该章拆成两个小目标 |
| Editor 与 Writer 僵持 | 转阶段 5 裁定，不无限往返 |
| 工具报错 | 重试一次；改用标准文件工具完成同一动作并记录 |
| 会话中断 | 读 `story/state.json`、`meta/progress.json`、任务板，从最早未完成阶段续跑 |
| 发现定稿章节硬伤 | 停写新章，记录证据走裁定，必要时出勘误并问用户 |

## 十八、角色写文件范围（再强调）

所有角色向 Lead 的交付回复一律 ≤300 字，含结论、产物路径、风险或待决；Lead 给用户的章节简报 ≤200 字。正文、审阅、裁定等长内容只落盘，不搬进任何回复。

Writer 只写 plans/drafts/style；Editor 只写 reviews/polished（导入时 conflicts）；Architect 只写资料；Arbiter 只写 decisions/compass；Lead 只写 chapters/meta-progress/summaries/state。越界写文件视为流程事故，Lead 应回退并在任务板记录。
