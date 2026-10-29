# 数据格式

小说根目录 = 会话工作目录。所有创作状态都在这里，推荐用 Git 管理。

## 1. 目录总览

```
<novel-root>/
  premise.md
  chapters/001.md …
  outline.json
  layered_outline.json            # 可选，优先级高于 outline.json
  characters.json
  world_rules.json
  timeline.jsonl
  foreshadow_ledger.json
  relationship_state.json
  meta/
    progress.json
    compass.json
  story/
    plans/001.md
    drafts/001.md
    reviews/001.md
    polished/001.md
    summaries/001.md
    decisions/0001-主题.md
    style.md
    state.json
    continuation-plan.md
    context/ch-001-writer.md      # novel_context 缓存，可删除
    import/                       # 旧版导入（novel_import）
    imports/<importId>/           # 0.2.0 导入批次（受管）
    rewrites/<rewriteId>/         # 0.2.0 候选改写（受管）
    versions/<versionId>/         # 0.2.0 正式版本快照（受管）
    versions/index.json
    versions/transaction.json
  export/
    novel.md
    novel.docx
```

## 2. 顶层资料

### `premise.md`

Markdown。推荐包含：一句话前提、核心冲突、主角与目标、主要阻力、结局方向。

### `characters.json`

```json
[
  {
    "name": "陈砚",
    "role": "主角 / 市局法医",
    "description": "冷静克制，习惯用专业判断压住情绪。",
    "background": "姐姐在雾港七号泊位失踪。",
    "goal": "查清姐姐与父亲的失踪真相。",
    "personality": "寡言、细致。",
    "status": "第 7 章结尾已从冷库脱身。"
  }
]
```

`name` 必填；其余字段建议齐全，便于 `novel_validate` 与上下文包筛选。

### `world_rules.json`

```json
[{ "name": "雾港潮汐", "category": "地理", "description": "旧港冷库低于海平面，涨潮时倒灌。" }]
```

### `outline.json` / `layered_outline.json`

简版大纲是数组：

```json
[{ "chapter": 7, "title": "水线之下", "goal": "确认敲击者身份，找到冷库暗门。" }]
```

分层大纲可以是「卷 → 弧 → 章」嵌套对象；`novel_context` 会递归收集所有带 `chapter` 的节点，
并优先读 `layered_outline.json`。

### `timeline.jsonl`

每行一个 JSON 事件：

```json
{"chapter":7,"time":"2025-07-14 23:46","event":"三人从井口脱身，发现井盖上的手印与缆绳。","characters":["陈砚","林岚","周野"]}
```

### `foreshadow_ledger.json`

```json
[{ "id": "F-001", "status": "未回收", "description": "陈砚手臂旧疤与 2015 年失踪案现场一致。", "chapters": [1, 4] }]
```

状态含 `已回收 / 已完成 / 已解决 / 已关闭` 等会被视为关闭，其余视为未回收。

### `relationship_state.json`

```json
[{ "character_a": "陈砚", "character_b": "林岚", "relation": "搭档 / 互相信任", "chapter": 6 }]
```

### `meta/progress.json`

```json
{
  "completed_chapters": [1, 2, 3, 4, 5, 6, 7],
  "phase": "writing",
  "current_volume": 1,
  "current_arc": 1,
  "words": 12581,
  "title": "雾港夜航",
  "genre": "都市悬疑"
}
```

### `meta/compass.json`

```json
{
  "final_direction": "旧港拆迁前夜，陈砚用完整证据链逼出真相。",
  "active_threads": ["F-001 旧疤", "F-002 海鸥吊坠"],
  "scale_estimate": "12 章 / 约 12 万字",
  "updated_at": "2026-10-29T…"
}
```

## 3. `story/` 工作区

| 路径 | 内容 |
|---|---|
| `plans/NNN.md` | Writer 章节计划 |
| `drafts/NNN.md` | Writer 正文初稿 |
| `reviews/NNN.md` | Editor 审阅报告 |
| `polished/NNN.md` | Editor 打磨稿 |
| `summaries/NNN.md` | 章节摘要（上下文包使用） |
| `decisions/` | Arbiter 裁定记录 |
| `style.md` | 文风卡 |
| `state.json` | 阶段与断点（`stage` / `last_chapter` / `note`） |
| `continuation-plan.md` | 导入后的续写方案 |
| `context/` | `novel_context` 缓存，可随时删除重建 |

命名规则：以章号开头的文件名（`001.md`、`007.md`）。`novel_context` / `novel_chapter` 按文件名前缀定位稿件，不要用 `ch-001.md`。

## 4. 0.2.0 受管存储

以下目录由插件管理，不建议手改；需要时通过面板或 `novel_rewrite` 操作：

| 路径 | 说明 |
|---|---|
| `story/imports/<importId>/` | 原始字节、归一化原文、切章、分析与来源哈希 |
| `story/rewrites/<rewriteId>/` | 冻结原稿、改写要求、方案、队列、审阅、候选项目 |
| `story/versions/<versionId>/` | 正式稿与资料的完整快照（`manifest.json` + `project/`） |
| `story/versions/index.json` | `schema`、`activeVersionId`、`currentHash`、`versions[]` |
| `story/versions/transaction.json` | 采用/回退事务日志，正常完成后删除 |

正式版本快照覆盖的受管文件：`chapters/`、`story/plans|drafts|polished|reviews|summaries|decisions`、
全部顶层资料文件、`meta/progress.json`、`meta/compass.json`、`story/style.md`、`story/state.json`、
`story/continuation-plan.md`、`layered_outline.json`。

## 5. 旧版导入目录（`story/import/`）

`novel_import` 使用的旧版工作区：

```
story/import/
  source.txt / manifest.json / chapters.json
  chunks/0001.md
  notes/0001.md
  report.md / conflicts.md
```

新项目建议直接使用 0.2.0 的 `story/imports/` 工作流。

## 6. 导出

| 文件 | 生成方式 |
|---|---|
| `export/novel.md` | `novel_chapter export`（默认）或 `/novel-export` |
| `export/novel.docx` | `novel_chapter export` 的 `format: "docx"` 或 `/novel-export docx` |

## 7. 编码与限制

- 文本文件统一 UTF-8；导入支持 UTF-8（含 BOM）与 GB18030；
- 资料单文件读取上限 8 MiB；导入原稿上限 16 MiB；导入请求体上限 32 MiB；
- 损坏 JSON / JSONL 坏行会在 `novel_validate` 与写作台里明确报出；
- 手工编辑正文或资料后，建议跑一次 `novel_validate`，并让 Architect 同步 `meta/progress.json` 与摘要。

## 8. 演示项目数据

`samples/雾港夜航` 当前包含：**7 章正文、12,581 字、10 个人物、7 条世界设定、
6 条伏笔（5 条未回收）、2 份裁定记录、7 篇章节摘要**，停在第 7 章末尾，下一章为第 8 章。
