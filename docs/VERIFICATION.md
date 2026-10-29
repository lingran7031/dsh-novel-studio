# 验证记录

验证时间：2026-10-29（Asia/Shanghai）；环境：Windows 11 + DeepSeek Harness Desktop。
演示工作区：`samples/雾港夜航`。

## 1. 自动测试

| 测试 | 结果 |
|---|---|
| `node --check`（全部 14 个 `lib/*.js`） | 全部通过 |
| `node test/smoke.mjs` | PASS |
| `node test/acceptance.mjs` | **60/60 PASS**（exit 0） |

`acceptance` 覆盖：初始化 → 旧版导入 prepare/chapterCount → materialize 章节归位 → 资料归档 →
`novel_validate` → `novel_context` → 定稿 `promote` → 摘要 → 导出 md/docx → 命令 handler。

## 2. 运行态自检

`GET /novel-studio/api/status`（本次 build `p6-rewrite-v1`）：

| 指标 | 结果 |
|---|---|
| preset | `novel-studio`，`broken` 为空 |
| composition | 16 行，全部 `active` |
| 模式内工具 | 19 个可见工具，其中 6 个 `novel_*` |
| 对照组 | standard 模式 `novel_*` 工具数 = 0 |
| 技能 | 16 个（8 个 `novel-*`），`skillSample.source = runtime` |
| Client 入口 | `dsh-novel-studio`，`immediately = true` |

## 3. 写作台接口

| 请求 | 结果 |
|---|---|
| `GET /project?path=samples/雾港夜航` | `ok=true`，`雾港夜航`，7 章，12,581 字，下一章 8，未回收伏笔 5 |
| `GET /chapter?...&chapter=7` | `第7章 水线之下`，3,466 字，正文完整返回 |
| `GET /library?...` | 13 类资料，共 63 条 |
| `GET /workflow?...` | `versions=[]、rewrites=[]、imports=[]`；非写作会话中 `capabilities.dispatch=false`（符合预期） |
| `POST /export`（docx） | 生成 `export/novel.docx`，返回字节数 |

## 4. 演示项目数据

`samples/雾港夜航`：

- 7 章正文，已定稿 7 章，下一章第 8 章；
- 12,581 字；
- 10 个人物、7 条世界设定、6 条伏笔（5 条未回收）；
- 7 篇章节摘要、2 份裁定记录。

## 5. 真实会话观察

2026-10-28 23:19–23:26 在 GUI 中用演示项目实际跑过「小说工作室」会话：

- Lead 拉起 6 个子智能体（架构师 / 作者 / 编辑 / 裁定者等角色协作）；
- 团队工具（spawn_teammate、任务板、wait_agent、send_message）正常调用；
- 第 7 章完成计划 → 初稿 → 审阅/打磨 → 定稿 → 资料归档与摘要；
- 期间发现并修复两个真实问题：
  1. 技能注册缺 `source` 字段，`skill` 工具加载角色宪章报错；
  2. 写作台指南条目的 `title` / `description` 传了字符串而非 thunk，导致右栏指南页空白。

修复后已验证：技能 `get()` 正常返回 `source=runtime`；Client bundle 中 guide 条目为函数形式；
写作台截图来自修复后的运行界面。

## 6. 截图

- `docs/assets/workbench-overview.png`：写作台概览（雾港夜航实时数据）；
- `docs/assets/agent-collaboration.png`：多 Agent 协作中的章节简报。

截图来自实际运行的 DSH 窗口，裁剪去除了会话列表等无关区域；未使用 mock 或手绘界面。

## 7. 未自动化覆盖

- 面板点击级交互（打开指南、切标签、阅读章节）通过人工截图与接口验证覆盖，未接入浏览器自动化；
- 0.2.0 导入改写全流程耗时较长，验收脚本未覆盖模型派发部分；其确定性存储/版本逻辑由 `revisions.js` 实现，建议按 [ACCEPTANCE.md](ACCEPTANCE.md) 第 5 节人工验收。
