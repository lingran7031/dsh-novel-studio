# 开发指南

## 1. 环境与布局

- Node.js ≥ 20，Windows / macOS / Linux（本次验证在 Windows 11 + DSH Desktop）；
- DSH 需要支持 Agent Presets；团队协作依赖实验性的 Agent Teams；
- 本项目是**本地 bundle**（`private: true`，未发布 npm），通过 `link:` 安装到 profile。

```
lib/
  index.js            包根空插件
  host.js             自检 / 项目 / 章节 / 资料库 / 导出路由
  workflow-http.js    导入改写与版本接口
  workbench.js        只读章节/资料读取与路径边界
  revisions.js        导入批次、候选、版本快照与事务
  rewrite-runtime.js  当前会话 Agent 派单
  rewrite-tools.js    novel_rewrite 工具
  mode.js             常驻协作提示词
  skills.js           读取 skills/ 并注册运行时技能
  commands.js         /novel-status、/novel-export
  tools.js            5 个基础 novel_* 工具 + novel_rewrite
  core.js             纯函数核心
  docx.js             纯 Node DOCX 生成
  client.js           右栏写作台 Client 半
skills/               8 个 SKILL.md
samples/              半成品样例 + 雾港夜航演示项目
test/                 smoke / acceptance
docs/                 文档与截图
```

## 2. 开发循环

### 服务端 / 预设代码

修改 `lib/*.js`、`cordis.patch.yml`、`skills/*` 后：

1. 在 DSH 插件管理器里对该 bundle 执行「禁用 → 启用」；
2. 若提示 `restart-required` 或行为未更新，重启 DSH（linked package 的 ESM 模块缓存不会随 bundle 热重载完全失效）；
3. 新会话才会使用新的 preset 组成；已有会话保留旧 revision。

### Client 代码

修改 `lib/client.js` 后：硬刷新页面（`Ctrl+Shift+R`）。如果页面仍拿旧产物，可以：

- 在插件管理器禁用→启用 bundle，让 clientModules 重新组合；
- 开发辅助：`GET /novel-studio/api/client/rebuild`（调用官方 `clientModules.rebuilt()`，仅调试用）。

### 常用检查

```powershell
# 1) 语法
Get-ChildItem lib -Filter *.js | ForEach-Object { node --check $_.FullName }

# 2) 冒烟
node test/smoke.mjs

# 3) 端到端验收（60 项）
node test/acceptance.mjs

# 4) 运行态自检（端口以当前 GUI 为准）
curl.exe http://127.0.0.1:<port>/novel-studio/api/status
```

当前基线（2026-10-29）：

- `smoke` PASS；
- `acceptance` 60/60 PASS；
- 自检 `build = p6-rewrite-v1`，composition 16 行全部 active，模式内 6 个 `novel_*` 工具、8 个技能，`novelToolsInStandard = []`。

## 3. 运行时自检接口

`GET /novel-studio/api/status` 返回：

| 字段 | 含义 |
|---|---|
| `preset` / `presets` | preset 是否存在、有无 `broken` 诊断 |
| `composition.rows[]` | 每个子插件的 `entryId`、`moduleName`、`fiberState` |
| `tools` | 当前预设作用域可见工具（应含 6 个 `novel_*`） |
| `novelToolsInStandard` | 对照组，应为空，表示作用域隔离 |
| `skills` / `skillSample` | 8 个运行时技能；`skillSample.source` 应为 `runtime` |
| `prompt` | 不建会话装配一次提示词：persona / 手册 / 工具数量 |
| `client.entry` / `client.path` | Client 入口是否在 boot graph、产物路径 |

## 4. 代码约定

- **预设子插件零宿主依赖**：本地 link 安装的包无法解析 `@deepseek-ai/*`，工具用
  `ctx.tools.register({ name, description, parameters: <raw JSON Schema>, output, execute })`；
- 只使用 Node 内建模块与 `ctx` 服务；不要 `import` Harness 包；
- 文件读写限定在项目目录内，校验真实路径 / 符号链接；超过上限要显式报错；
- 新增工具：在 `lib/tools.js`（或 `rewrite-tools.js`）注册，并在 README/ARCHITECTURE 的工具表里补充；
- 新增技能：在 `skills/<kebab-name>/SKILL.md`，frontmatter 只有 `name` 与单行 `description`，
  名称必须与目录名一致；`lib/skills.js` 注册时带 `source: 'runtime'`；
- 新增 HTTP 路由：统一在 `/novel-studio/api` 前缀下，沿用 Host 头信任检查；修改类请求要求同源 JSON；
- Client：
  - 指南条目 `guide[].title` / `description` 必须是 **thunk**（`() => string`），否则指南页渲染报错、右栏空白；
  - 注册 tab body/title 使用同一 `id`；组件通过 slot 注入的 `sessionId` 取数据；
  - 样式只使用主题 token（`--dsw-alias-*`），可见文案走 locale；
  - 不修改 DOM、不替换 app root。

## 5. 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| 预设不在选择器 | 刷新页面；bundle 未启用或 DSH 需要重启 |
| 右栏「开始」空白 | `guide[].title` 传了字符串而不是 thunk；或 Client 产物未更新；硬刷新并看 Console |
| `skill` 工具报 `source must be a string` | 技能注册漏 `source`；`lib/skills.js` 已修复，重启后新会话生效 |
| 改代码不生效 | linked bundle 的 ESM 缓存：禁用→启用 bundle 或重启 DSH |
| `client/rebuild` 返回同 rev | `clientModules.rebuilt()` 认为产物未变；刷新页面或禁用→启用 bundle |
| `/project` 返回 `no-project-root` | 当前会话没有可用 cwd，或 sessionId 不存在；用已有工作区会话或显式 `path=` |
| `/workflow` 的 dispatch 不可用 | 当前会话不是「小说工作室」预设，或会话忙碌 / 目录变化 |
| 端口变了导致 curl 失败 | DSH 每次启动端口可能变化，以 GUI 地址或启动日志为准 |
| 中文乱码 | 终端编码问题；接口与文件均为 UTF-8 |

## 6. 发布清单

1. 更新 `package.json` 版本与 `CHANGELOG.md`；
2. 跑语法检查 / `smoke` / `acceptance`，确认自检 `build` 与 composition 正常；
3. 确认 `samples/雾港夜航` 数据与文档中的数字一致（章节 / 字数 / 伏笔 / 裁定）；
4. 更新 `README.md`、`docs/*` 与截图（若有 UI 变化）；
5. 提交 Git，打 tag（如 `v0.2.0`），在 GitHub Release 里写变更摘要。

## 7. 已知限制

- 改写首版不增删 / 拆合 / 重排章节；
- 导入仅 TXT/Markdown，扫描 PDF 需先转文本；
- Agent Teams 是实验能力，缺少时团队协作降级；
- 数据格式与 `dsh-novel-workbench` 兼容，但不依赖它。
