// dsh-novel-studio — 纯函数核心。
// 这里不依赖任何 DSH 服务，便于用 node 直接单测；tools.js 只做服务适配与参数校验。
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const MATERIAL_FILES = {
  premise: 'premise.md',
  characters: 'characters.json',
  worldRules: 'world_rules.json',
  outline: 'outline.json',
  layeredOutline: 'layered_outline.json',
  foreshadow: 'foreshadow_ledger.json',
  relationships: 'relationship_state.json',
  timeline: 'timeline.jsonl',
  progress: 'meta/progress.json',
  compass: 'meta/compass.json',
  style: 'story/style.md',
  state: 'story/state.json',
}

export const MATERIAL_DIRS = [
  'chapters',
  'meta',
  'story/plans',
  'story/drafts',
  'story/reviews',
  'story/polished',
  'story/summaries',
  'story/decisions',
  'story/import/chunks',
  'story/import/notes',
]

const CHAPTER_LINE = /^(?:第\s*[0-9０-９一二三四五六七八九十百千零两]+\s*[章回节卷]|chapter\s+\d+|卷[0-9一二三四五六七八九十]+)/i

export function countChars(text) {
  return Array.from(String(text ?? '').replace(/\s+/gu, '')).length
}

export function toPosix(value) {
  return String(value ?? '').replace(/\\/g, '/')
}

export function parseJsonSafe(text) {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) }
  }
}

export async function pathKind(target) {
  try {
    const info = await stat(target)
    if (info.isDirectory()) return 'directory'
    if (info.isFile()) return 'file'
    return 'other'
  } catch {
    return 'missing'
  }
}

export async function exists(target) {
  return (await pathKind(target)) !== 'missing'
}

export async function ensureDir(target) {
  await mkdir(target, { recursive: true })
}

/** 只在目标不存在时写入（createIfAbsent 语义）。返回 true 表示本次创建。 */
export async function writeIfAbsent(target, content) {
  try {
    await writeFile(target, content, { encoding: 'utf8', flag: 'wx' })
    return true
  } catch (error) {
    if (error && error.code === 'EEXIST') return false
    throw error
  }
}

/** 覆盖写入（调用方自行保证这是预期行为）。 */
export async function writeText(target, content) {
  await writeFile(target, content, { encoding: 'utf8' })
}

export async function readTextIfExists(target) {
  try {
    return await readFile(target, 'utf8')
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'EISDIR')) return undefined
    throw error
  }
}

/** 列出 chapters/ 下有编号的 .md 章节文件，按编号排序。 */
export async function listChapterFiles(root) {
  const dir = join(root, 'chapters')
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
    .map((entry) => {
      const match = /^(\d+)/.exec(entry.name)
      return { file: entry.name, n: match === null ? Number.MAX_SAFE_INTEGER : Number(match[1]) }
    })
    .filter((entry) => Number.isFinite(entry.n))
    .sort((a, b) => (a.n === b.n ? a.file.localeCompare(b.file) : a.n - b.n))
}

/** 章节标题读取：优先第一个一级标题，否则文件名。 */
export async function readChapterTitle(root, file) {
  const text = await readTextIfExists(join(root, 'chapters', file))
  if (text === undefined) return ''
  const match = /^\s*#\s+(.+)$/m.exec(text)
  return match === null ? '' : match[1].trim()
}

export async function countWords(root) {
  const chapters = await listChapterFiles(root)
  let chars = 0
  const perChapter = []
  for (const chapter of chapters) {
    const text = await readTextIfExists(join(root, 'chapters', chapter.file))
    const c = text === undefined ? 0 : countChars(text)
    chars += c
    perChapter.push({ n: chapter.n, file: chapter.file, chars: c })
  }
  return { chars, chapters: perChapter }
}

/** 判断当前目录是否是一本小说的项目根。 */
export async function detectProject(root) {
  const markers = {}
  for (const [key, rel] of Object.entries(MATERIAL_FILES)) {
    markers[key] = (await pathKind(join(root, rel))) !== 'missing'
  }
  markers.chapters = (await pathKind(join(root, 'chapters'))) === 'directory'
  const chapters = markers.chapters ? await listChapterFiles(root) : []
  const isNovel =
    markers.chapters ||
    markers.premise ||
    markers.characters ||
    markers.progress ||
    markers.outline ||
    markers.state
  return { root, isNovel, markers, chapterCount: chapters.length }
}

const DEFAULT_PREMISE = `# 故事前提

> 一句话前提：待填写。

## 核心冲突

## 主角与目标

## 主要阻力

## 结局方向
`

const DEFAULT_STYLE = `# 文风卡

- 视角：
- 时态：
- 语言风格：
- 句子节奏：
- 对话风格：
- 意象/母题：
- 禁忌：
`

export async function initProject(root, { title = '', genre = '' } = {}) {
  await ensureDir(root)
  for (const dir of MATERIAL_DIRS) await ensureDir(join(root, dir))

  const created = []
  const seed = [
    [MATERIAL_FILES.premise, `${DEFAULT_PREMISE}${title !== '' ? `\n\u003e 暂定书名：${title}\n` : ''}`],
    [MATERIAL_FILES.characters, '[]\n'],
    [MATERIAL_FILES.worldRules, '[]\n'],
    [MATERIAL_FILES.outline, '[]\n'],
    [MATERIAL_FILES.foreshadow, '[]\n'],
    [MATERIAL_FILES.relationships, '[]\n'],
    [MATERIAL_FILES.timeline, ''],
    [
      MATERIAL_FILES.progress,
      `${JSON.stringify(
        { completed_chapters: [], phase: 'setup', current_volume: 1, current_arc: 1, words: 0, genre, title },
        null,
        2,
      )}\n`,
    ],
    [
      MATERIAL_FILES.compass,
      `${JSON.stringify({ final_direction: '', active_threads: [], scale_estimate: '', updated_at: new Date().toISOString() }, null, 2)}\n`,
    ],
    [MATERIAL_FILES.style, DEFAULT_STYLE],
    [MATERIAL_FILES.state, `${JSON.stringify({ stage: 'setup', last_chapter: 0, updated_at: new Date().toISOString() }, null, 2)}\n`],
  ]
  for (const [rel, content] of seed) {
    if (await writeIfAbsent(join(root, rel), content)) created.push(rel)
  }
  return { created, dirs: MATERIAL_DIRS }
}

export async function projectStatus(root) {
  const detected = await detectProject(root)
  const chapters = (await countWords(root)).chapters
  const progressRaw = await readTextIfExists(join(root, MATERIAL_FILES.progress))
  const progressParsed = progressRaw === undefined ? { ok: false } : parseJsonSafe(progressRaw)
  const stateRaw = await readTextIfExists(join(root, MATERIAL_FILES.state))
  const stateParsed = stateRaw === undefined ? { ok: false } : parseJsonSafe(stateRaw)
  const summaryDir = await countMarkdown(join(root, 'story/summaries'))
  const decisionDir = await countMarkdown(join(root, 'story/decisions'))
  const draftDir = await countMarkdown(join(root, 'story/drafts'))
  const reviewDir = await countMarkdown(join(root, 'story/reviews'))
  const missing = []
  for (const [key, rel] of Object.entries(MATERIAL_FILES)) {
    // layered_outline.json 与 outline.json 互为替代，缺一个不算缺失。
    if (key === 'layeredOutline') continue
    if (detected.markers[key] !== true) missing.push({ key, file: rel })
  }
  const last = chapters.length > 0 ? chapters[chapters.length - 1].n : 0
  return {
    root,
    isNovel: detected.isNovel,
    chapters,
    totalChars: chapters.reduce((sum, chapter) => sum + chapter.chars, 0),
    lastChapter: last,
    nextChapter: last + 1,
    progress: progressParsed.ok ? progressParsed.value : null,
    state: stateParsed.ok ? stateParsed.value : null,
    counts: { summaries: summaryDir, decisions: decisionDir, drafts: draftDir, reviews: reviewDir },
    missing,
  }
}

async function countMarkdown(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((entry) => entry.isFile() && /\.md$/i.test(entry.name)).length
  } catch {
    return 0
  }
}

// ---------------- 分章 / 分块（半成品导入用） ----------------

/** 按「第N章 / Chapter N / 卷N」标题切出章级单元；无标题则整篇一章。 */
export function splitManuscript(raw) {
  const text = String(raw ?? '').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  const heads = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (line === '' || line.length > 80) continue
    if (CHAPTER_LINE.test(line)) heads.push(index)
  }

  const chapters = []
  if (heads.length >= 2) {
    if (heads[0] > 0) {
      const preface = lines.slice(0, heads[0]).join('\n').trim()
      if (preface !== '') chapters.push({ title: '（卷首/引子）', text: preface })
    }
    for (let index = 0; index < heads.length; index += 1) {
      const start = heads[index]
      const end = index + 1 < heads.length ? heads[index + 1] : lines.length
      const block = lines.slice(start, end).join('\n').trim()
      if (block !== '') chapters.push({ title: lines[start].trim(), text: block })
    }
  } else {
    const whole = text.trim()
    if (whole !== '') chapters.push({ title: '（全文）', text: whole })
  }

  return {
    mode: heads.length >= 2 ? 'headings' : 'single',
    chapters: chapters.map((chapter, index) => ({
      index: index + 1,
      title: chapter.title,
      chars: countChars(chapter.text),
      text: chapter.text,
    })),
  }
}

/** 切章后再按段落把超长章节切成 ≤ maxChars 的分析块。 */
export function splitChapters(raw, { maxChars = 12000 } = {}) {
  const manuscript = splitManuscript(raw)
  const chunks = []
  for (const chapter of manuscript.chapters) {
    if (chapter.text.length <= maxChars) {
      chunks.push({ title: chapter.title, text: chapter.text })
      continue
    }
    const paragraphs = chapter.text.split(/\n{2,}/)
    let buffer = ''
    let part = 1
    const flush = () => {
      if (buffer.trim() === '') return
      chunks.push({ title: `${chapter.title}（片段${part}）`, text: buffer.trim() })
      part += 1
      buffer = ''
    }
    for (const paragraph of paragraphs) {
      if (buffer !== '' && buffer.length + paragraph.length + 2 > maxChars) flush()
      buffer = buffer === '' ? paragraph : `${buffer}\n\n${paragraph}`
    }
    flush()
  }

  return chunks.map((chunk, index) => ({
    index: index + 1,
    title: chunk.title,
    chars: countChars(chunk.text),
    text: chunk.text,
  }))
}

/** 逐行 JSON 解析（timeline.jsonl）。返回解析成功的项与坏行。 */
export function parseJsonLines(text) {
  const items = []
  const badLines = []
  const lines = String(text ?? '').split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (line === '') continue
    const parsed = parseJsonSafe(line)
    if (parsed.ok) items.push(parsed.value)
    else badLines.push({ line: index + 1, error: parsed.error })
  }
  return { items, badLines }
}

// ------------------------------------------------------------ 文本解码 / 文件

/** 解码半成品文件：UTF-8（含 BOM）优先，失败回退 GB18030，最后兜底 UTF-8 容错。 */
export function decodeTextBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8-bom' }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }
  } catch {
    /* try GB18030 */
  }
  try {
    return { text: new TextDecoder('gb18030', { fatal: true }).decode(bytes), encoding: 'gb18030' }
  } catch {
    /* last resort */
  }
  return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8-lossy' }
}

export function padChapter(n) {
  return String(n).padStart(3, '0')
}

/** 在目录中按编号找 .md 文件（兼容 01.md / 001.md 等命名）。 */
export async function findNumberedFile(dir, n) {
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const entry of entries) {
    if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue
    const match = /^0*(\d+)/.exec(entry.name)
    if (match !== null && Number(match[1]) === Number(n)) return join(dir, entry.name)
  }
  return undefined
}

export async function findChapterFile(root, n) {
  return findNumberedFile(join(root, 'chapters'), n)
}

export async function readJsonFile(root, rel, fallback) {
  const text = await readTextIfExists(join(root, rel))
  if (text === undefined) return fallback
  const parsed = parseJsonSafe(text)
  return parsed.ok ? parsed.value : fallback
}

export async function readHead(file, limit) {
  const text = await readTextIfExists(file)
  if (text === undefined || limit <= 0) return text
  return text.slice(0, limit)
}

export async function readTail(file, limit) {
  const text = await readTextIfExists(file)
  if (text === undefined || limit <= 0) return text
  return text.length > limit ? text.slice(text.length - limit) : text
}

// ------------------------------------------------------------ 大纲收集

function collectChapterOutlines(value, out, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return
  if (Array.isArray(value)) {
    for (const item of value) collectChapterOutlines(item, out, depth + 1)
    return
  }
  if (typeof value !== 'object') return
  const number = Number(value.chapter ?? value.chapter_index ?? value.chapterIndex ?? value.n ?? value.no)
  if (Number.isInteger(number) && number > 0) {
    out.push({
      chapter: number,
      title: String(value.title ?? value.name ?? ''),
      goal: String(value.goal ?? value.summary ?? value.description ?? ''),
    })
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) collectChapterOutlines(child, out, depth + 1)
    else if (child !== null && typeof child === 'object') collectChapterOutlines(child, out, depth + 1)
  }
}

/** 读取大纲（优先 layered_outline.json），归一化成 [{chapter,title,goal}]。 */
export async function collectOutlines(root) {
  const out = []
  const layered = await readJsonFile(root, MATERIAL_FILES.layeredOutline, undefined)
  if (layered !== undefined) collectChapterOutlines(layered, out)
  if (out.length === 0) {
    const flat = await readJsonFile(root, MATERIAL_FILES.outline, undefined)
    if (flat !== undefined) collectChapterOutlines(flat, out)
  }
  const dedup = new Map()
  for (const item of out) if (!dedup.has(item.chapter)) dedup.set(item.chapter, item)
  return [...dedup.values()].sort((a, b) => a.chapter - b.chapter)
}

// ------------------------------------------------------------ 上下文包

const FOCUS_SPLIT = /[\s,，。;；、:：()（）[\]【】"'“”‘’!?！？/\\|-]+/u

function focusTokens(focus) {
  const tokens = new Set()
  for (const token of String(focus ?? '').split(FOCUS_SPLIT)) {
    const trimmed = token.trim()
    if (trimmed.length >= 2) tokens.add(trimmed)
  }
  return [...tokens].slice(0, 400)
}

function relevanceScore(haystack, tokens) {
  const text = String(haystack ?? '')
  let score = 0
  for (const token of tokens) if (text.includes(token)) score += 1
  return score
}

function clip(text, limit) {
  const value = String(text ?? '').trim()
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

const CLOSED_STATUS_KEYS = new Set([
  'resolved',
  'closed',
  'done',
  'abandoned',
  'dropped',
  'paid',
  '废弃',
  '放弃',
  '已回收',
  '已完成',
  '已解决',
  '已关闭',
  '已兑现',
  '已废弃',
])

function isOpenStatus(status) {
  const text = String(status ?? '').trim().toLowerCase()
  if (text === '') return true
  const key = text.replace(/[（(].*$/u, '').trim()
  if (CLOSED_STATUS_KEYS.has(key)) return false
  // 兼容「已回收（第3章）」这类带说明的写法，但避免把 undone / not done 当成 done。
  return !/已回收|已完成|已解决|已关闭|已兑现|已废弃/u.test(text)
}

function formatCharacters(items, tokens, limit) {
  const ranked = items
    .map((item) => ({ item, score: relevanceScore(`${item?.name ?? ''} ${item?.role ?? ''} ${item?.description ?? ''} ${item?.goal ?? ''}`, tokens) }))
    .sort((a, b) => b.score - a.score)
  const picked = ranked.filter((entry) => entry.score > 0).slice(0, limit)
  const fallback = ranked.filter((entry) => entry.score === 0).slice(0, Math.max(0, limit - picked.length))
  return [...picked, ...fallback].map(({ item }) => {
    const parts = [`- **${String(item?.name ?? '未命名')}**（${String(item?.role ?? '角色')}）`]
    if (item?.goal) parts.push(`目标：${clip(item.goal, 120)}`)
    if (item?.personality) parts.push(`性格：${clip(item.personality, 120)}`)
    if (item?.status) parts.push(`当前状态：${clip(item.status, 160)}`)
    else if (item?.description) parts.push(clip(item.description, 200))
    return parts.join('；')
  })
}

function formatWorldRules(items, tokens, limit) {
  return items
    .map((item) => ({ item, score: relevanceScore(`${item?.name ?? ''} ${item?.category ?? ''} ${item?.description ?? ''}`, tokens) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => `- ${String(item?.name ?? '规则')}${item?.category ? `（${item.category}）` : ''}：${clip(item.description, 220)}`)
}

function formatForeshadow(items, tokens, limit) {
  return items
    .filter((item) => isOpenStatus(item?.status))
    .map((item) => ({ item, score: relevanceScore(`${item?.id ?? ''} ${item?.description ?? ''}`, tokens) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => {
      const chapters = Array.isArray(item?.chapters) ? item.chapters.filter((value) => value !== undefined && value !== null) : []
      const where = chapters.length > 0 ? `（章节：${chapters.join('、')}）` : ''
      return `- [${String(item?.id ?? '伏笔')}] ${clip(item?.description ?? item?.event ?? '', 200)}｜状态：${String(item?.status ?? '未标注')}${where}`
    })
}

async function recentDecisionLines(root, limit, tokens) {
  const dir = join(root, 'story/decisions')
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files = entries
    .filter((entry) => entry.isFile() && /\.(md|txt)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse()
    .slice(0, limit)
  const lines = []
  for (const file of files) {
    const head = await readHead(join(dir, file), 500)
    if (head === undefined) continue
    lines.push(`- ${clip(head.replace(/\s+/gu, ' '), 360)}`)
  }
  return lines.sort((a, b) => relevanceScore(b, tokens) - relevanceScore(a, tokens))
}

/**
 * 组装某一章的有界上下文包：前提、当前大纲目标、最近摘要、上一章结尾、文风卡、
 * 相关人物/世界规则、未回收伏笔、近期裁定与时间线。默认目标 ≤ 6000 汉字。
 */
export async function buildContextPack(root, chapter, options = {}) {
  const role = ['writer', 'editor', 'arbiter', 'architect'].includes(options.role) ? options.role : 'writer'
  const budgetTokens = Number.isFinite(options.budgetTokens) ? Math.max(1200, Number(options.budgetTokens)) : 5000
  const files = []
  const missing = []
  const outlines = await collectOutlines(root)
  const outlineWindow = outlines.filter((item) => item.chapter >= chapter - 1 && item.chapter <= chapter + 2)
  const currentOutline = outlines.find((item) => item.chapter === chapter)
  const focusSource = `${options.focus ?? ''} ${outlineWindow.map((item) => `${item.title} ${item.goal}`).join(' ')}`
  const tokens = focusTokens(focusSource)

  const tryRead = async (rel, limit) => {
    const text = await readHead(join(root, rel), limit)
    if (text === undefined) {
      missing.push(rel)
      return undefined
    }
    files.push(rel)
    return text
  }

  const premise = await tryRead(MATERIAL_FILES.premise, 1100)
  const compass = await tryRead(MATERIAL_FILES.compass, 600)
  const style = await tryRead(MATERIAL_FILES.style, 900)
  const state = await tryRead(MATERIAL_FILES.state, 400)
  const progress = await tryRead(MATERIAL_FILES.progress, 700)

  const charactersRaw = (await readJsonFile(root, MATERIAL_FILES.characters, [])) || []
  const characters = Array.isArray(charactersRaw)
    ? formatCharacters(charactersRaw.filter((item) => item !== null && typeof item === 'object'), tokens, role === 'architect' ? 8 : 6)
    : []
  const worldRaw = (await readJsonFile(root, MATERIAL_FILES.worldRules, [])) || []
  const worldRules = Array.isArray(worldRaw)
    ? formatWorldRules(worldRaw.filter((item) => item !== null && typeof item === 'object'), tokens, role === 'architect' ? 8 : 6)
    : []
  const foreshadowRaw = (await readJsonFile(root, MATERIAL_FILES.foreshadow, [])) || []
  const foreshadow = Array.isArray(foreshadowRaw)
    ? formatForeshadow(foreshadowRaw.filter((item) => item !== null && typeof item === 'object'), tokens, role === 'arbiter' ? 10 : 6)
    : []

  const summaries = []
  for (let offset = 1; offset <= 2; offset += 1) {
    const n = chapter - offset
    if (n < 1) break
    const file = await findNumberedFile(join(root, 'story/summaries'), n)
    if (file === undefined) {
      missing.push(`story/summaries/${padChapter(n)}.md`)
      continue
    }
    const text = await readHead(file, 700)
    if (text !== undefined) {
      files.push(toPosix(file.slice(root.length + 1)))
      summaries.unshift(`### 第${n}章摘要\n${clip(text.replace(/^#.*$/m, ''), 650)}`)
    }
  }

  let previousTail = ''
  const previousFile = chapter > 1 ? await findChapterFile(root, chapter - 1) : undefined
  if (previousFile !== undefined) {
    const tail = await readTail(previousFile, 1000)
    if (tail !== undefined) {
      previousTail = clip(tail, 1000)
      files.push(toPosix(previousFile.slice(root.length + 1)))
    }
  } else if (chapter > 1) {
    missing.push(`chapters/（第 ${chapter - 1} 章）`)
  }

  const decisions = await recentDecisionLines(root, 5, tokens)

  const timelineFile = join(root, MATERIAL_FILES.timeline)
  const timelineText = await readTextIfExists(timelineFile)
  let timelineLines = []
  if (timelineText !== undefined) {
    files.push(MATERIAL_FILES.timeline)
    const parsed = parseJsonLines(timelineText)
    timelineLines = parsed.items
      .filter((event) => event !== null && typeof event === 'object' && Number(event.chapter) <= chapter)
      .slice(-8)
      .map((event) => `- 第${event.chapter ?? '?'}章｜${clip(event.time ?? '', 40)}｜${clip(event.event ?? '', 160)}`)
  }

  const outlineLines = outlineWindow.map((item) => {
    const isCurrent = item.chapter === chapter
    return `- ${isCurrent ? '**本章**' : `第${item.chapter}章`}${item.title ? `「${item.title}」` : ''}：${clip(item.goal, 300)}`
  })

  // 本章计划（若 Writer 已产出，正文阶段必须对齐）
  const planFile = await findNumberedFile(join(root, 'story/plans'), chapter)
  let planText = ''
  if (planFile !== undefined) {
    const planHead = await readHead(planFile, 1600)
    if (planHead !== undefined) {
      planText = clip(planHead, 1500)
      files.push(toPosix(planFile.slice(root.length + 1)))
    }
  }

  // 导入后的续写方案（当前路线），续写初期对 Writer/Editor 很关键
  const continuationFile = join(root, 'story/continuation-plan.md')
  const continuation = await readHead(continuationFile, 1400)
  let continuationText = ''
  if (continuation !== undefined) {
    continuationText = clip(continuation, 1300)
    files.push('story/continuation-plan.md')
  }

  // 架构师视角：给全部大纲的紧凑总览，避免逐章翻文件
  let outlineOverview = ''
  if (role === 'architect') {
    outlineOverview = outlines
      .slice(0, 80)
      .map((item) => `- 第${item.chapter}章${item.title !== '' ? `「${item.title}」` : ''}：${clip(item.goal, 90)}`)
      .join('\n')
  }

  let conflicts = ''
  if (role === 'editor' || role === 'arbiter') {
    const conflictText = await tryRead('story/import/conflicts.md', 1200)
    if (conflictText !== undefined) conflicts = conflictText
  }

  const sections = [
    { title: '故事前提', body: premise === undefined ? '' : clip(premise, 1100) },
    { title: '终局指南针 / 进度', body: [compass === undefined ? '' : clip(compass, 500), progress === undefined ? '' : clip(progress, 500)].filter(Boolean).join('\n\n') },
    { title: `第${chapter}章所在大纲`, body: outlineLines.join('\n') || '（大纲尚未生成）' },
    { title: '本章计划（如已产出）', body: planText },
    { title: '续写方案（如已归档）', body: continuationText },
    { title: '全书大纲总览（架构师视角）', body: outlineOverview },
    { title: '最近章节摘要', body: summaries.join('\n\n') || '（暂无摘要）' },
    { title: '上一章结尾', body: previousTail || '（暂无正文）' },
    { title: '文风卡', body: style === undefined ? '' : clip(style, 900) },
    { title: '相关人物', body: characters.join('\n') },
    { title: '相关世界规则', body: worldRules.join('\n') },
    { title: '未回收伏笔', body: foreshadow.join('\n') },
    { title: '近期裁定', body: decisions.join('\n') },
    { title: '最近时间线', body: timelineLines.join('\n') },
    { title: '导入冲突清单（节选）', body: conflicts },
    { title: '当前创作状态', body: state === undefined ? '' : clip(state, 400) },
  ].filter((section) => String(section.body ?? '').trim() !== '')

  const header = `# 第${chapter}章上下文包（${role}）\n\n> 由 novel_context 自动组装；只包含与本章相关的有界资料。`
  let markdown = `${header}\n\n${sections.map((section) => `## ${section.title}\n\n${section.body}`).join('\n\n')}\n`
  const maxChars = Math.round(budgetTokens * 2)
  let truncated = false
  if (markdown.length > maxChars) {
    markdown = `${markdown.slice(0, maxChars)}\n\n…（上下文包超出预算，已截断；需要更多细节请直接读取对应文件）\n`
    truncated = true
  }
  const approxTokens = Math.ceil(markdown.length / 1.7)

  const contextDir = join(root, 'story/context')
  await ensureDir(contextDir)
  const cacheFile = join(contextDir, `ch-${padChapter(chapter)}-${role}.md`)
  await writeText(cacheFile, markdown)

  return {
    chapter,
    role,
    approxTokens,
    truncated,
    markdown,
    cacheFile: toPosix(cacheFile),
    files: [...new Set(files)],
    missing: [...new Set(missing)],
    outline: currentOutline ?? outlineWindow[0] ?? null,
  }
}

// ------------------------------------------------------------ 章节定稿 / 记录

export async function promoteChapter(root, options = {}) {
  const chapter = Number(options.chapter)
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error('promoteChapter: chapter 必须是正整数')
  const fromInput = String(options.from ?? 'polished').toLowerCase()
  const from = fromInput === 'draft' || fromInput === 'drafts' ? 'drafts' : 'polished'
  let sourceFile = await findNumberedFile(join(root, 'story', from), chapter)
  let actualFrom = from === 'drafts' ? 'draft' : 'polished'
  if (sourceFile === undefined && from === 'polished') {
    sourceFile = await findNumberedFile(join(root, 'story/drafts'), chapter)
    if (sourceFile !== undefined) actualFrom = 'draft'
  }
  if (sourceFile === undefined) {
    throw new Error(`找不到第 ${chapter} 章的稿件（story/${from}/）；先让 Writer 产出计划与初稿、Editor 产出打磨稿`)
  }
  let content = await readFile(sourceFile, 'utf8')
  const title = typeof options.title === 'string' ? options.title.trim() : ''
  if (title !== '' && !/^\s*#\s+/m.test(content)) content = `# 第${chapter}章 ${title}\n\n${content}`
  let target = await findChapterFile(root, chapter)
  if (target === undefined) target = join(root, 'chapters', `${padChapter(chapter)}.md`)

  // 定稿覆盖保护：已有内容相同则幂等返回；不同则必须显式 force=true（覆盖前自动备份）。
  let backupFile
  const current = await readTextIfExists(target)
  if (current !== undefined) {
    if (current === content) {
      return {
        chapter,
        target: toPosix(target),
        source: toPosix(sourceFile),
        from: actualFrom,
        chars: countChars(content),
        unchanged: true,
        skipped: '内容与现有定稿一致，未重复写入',
      }
    }
    if (options.force !== true) {
      throw new Error(
        `第 ${chapter} 章已有定稿且内容不同：${toPosix(target)}。确认覆盖请传 force=true（覆盖前会自动写 .bak 备份）`,
      )
    }
    backupFile = `${target}.bak`
    await writeText(backupFile, current)
  }

  await writeText(target, content)
  const chars = countChars(content)

  const progress = (await readJsonFile(root, MATERIAL_FILES.progress, {})) || {}
  const completed = Array.isArray(progress.completed_chapters)
    ? progress.completed_chapters.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    : []
  if (!completed.includes(chapter)) completed.push(chapter)
  completed.sort((a, b) => a - b)
  const words = (await countWords(root)).chars
  const nextProgress = { ...progress, completed_chapters: completed, words, updated_at: new Date().toISOString() }
  await writeText(join(root, MATERIAL_FILES.progress), `${JSON.stringify(nextProgress, null, 2)}\n`)

  const state = (await readJsonFile(root, MATERIAL_FILES.state, {})) || {}
  const nextState = {
    ...state,
    stage: 'writing',
    last_chapter: Math.max(Number.isInteger(Number(state.last_chapter)) ? Number(state.last_chapter) : 0, chapter),
    updated_at: new Date().toISOString(),
  }
  await writeText(join(root, MATERIAL_FILES.state), `${JSON.stringify(nextState, null, 2)}\n`)

  return {
    chapter,
    target: toPosix(target),
    source: toPosix(sourceFile),
    from: actualFrom,
    chars,
    totalChars: words,
    completed,
    progressFile: toPosix(join(root, MATERIAL_FILES.progress)),
    ...(backupFile === undefined ? {} : { backup: toPosix(backupFile) }),
  }
}

/** 把导入的既有章节归位为 chapters/NNN.md，并把进度标记为已导入。 */
export async function writeImportedChapters(root, chapters, options = {}) {
  const existing = await listChapterFiles(root)
  if (existing.length > 0 && options.force !== true) {
    throw new Error(`chapters/ 已有 ${existing.length} 章；确认要覆盖/重建请传 force=true`)
  }
  const dir = join(root, 'chapters')
  await ensureDir(dir)
  const written = []
  for (const chapter of chapters) {
    const n = Number(chapter.index)
    if (!Number.isInteger(n) || n < 1) continue
    const file = `${padChapter(n)}.md`
    const text = String(chapter.text ?? '').trim()
    if (text === '') continue
    const hasHeading = /^\s*#\s+/m.test(text)
    const heading = hasHeading ? '' : `# ${String(chapter.title ?? `第${n}章`).trim()}\n\n`
    await writeText(join(dir, file), `${heading}${text}\n`)
    written.push({ chapter: n, file, chars: countChars(text) })
  }
  const completed = written.map((item) => item.chapter)
  const words = (await countWords(root)).chars
  const progress = (await readJsonFile(root, MATERIAL_FILES.progress, {})) || {}
  const nextProgress = {
    ...progress,
    completed_chapters: completed,
    words,
    phase: 'imported',
    updated_at: new Date().toISOString(),
  }
  await writeText(join(root, MATERIAL_FILES.progress), `${JSON.stringify(nextProgress, null, 2)}\n`)
  const state = (await readJsonFile(root, MATERIAL_FILES.state, {})) || {}
  const last = completed.length > 0 ? completed[completed.length - 1] : 0
  await writeText(
    join(root, MATERIAL_FILES.state),
    `${JSON.stringify({ ...state, stage: 'imported', last_chapter: last, updated_at: new Date().toISOString() }, null, 2)}\n`,
  )
  return { chapters: written, completed, words, lastChapter: last }
}

export async function writeChapterSummary(root, chapter, summary) {
  const n = Number(chapter)
  if (!Number.isInteger(n) || n < 1) throw new Error('writeChapterSummary: chapter 必须是正整数')
  if (typeof summary !== 'string' || summary.trim() === '') throw new Error('writeChapterSummary: summary 不能为空')
  const dir = join(root, 'story/summaries')
  await ensureDir(dir)
  const target = (await findNumberedFile(dir, n)) ?? join(dir, `${padChapter(n)}.md`)
  const content = `# 第${n}章 摘要\n\n${summary.trim()}\n`
  await writeText(target, content)
  return { target: toPosix(target), chars: countChars(content) }
}

export async function writeCheckpoint(root, options = {}) {
  const state = (await readJsonFile(root, MATERIAL_FILES.state, {})) || {}
  const next = { ...state, updated_at: new Date().toISOString() }
  if (typeof options.stage === 'string' && options.stage.trim() !== '') next.stage = options.stage.trim()
  if (typeof options.note === 'string' && options.note.trim() !== '') next.note = options.note.trim()
  await writeText(join(root, MATERIAL_FILES.state), `${JSON.stringify(next, null, 2)}\n`)
  return next
}

export async function exportNovel(root, options = {}) {
  const progress = (await readJsonFile(root, MATERIAL_FILES.progress, {})) || {}
  const title =
    (typeof options.title === 'string' && options.title.trim() !== ''
      ? options.title
      : typeof progress.title === 'string' && progress.title !== ''
        ? progress.title
        : '未命名小说') || '未命名小说'
  const chapters = await listChapterFiles(root)
  const parts = [`# ${title}\n`]
  for (const chapter of chapters) {
    const text = (await readTextIfExists(join(root, 'chapters', chapter.file))) ?? ''
    const heading = /^\s*#\s+(.+)$/m.exec(text)
    const headingTitle =
      heading === null ? '' : heading[1].replace(/^第\s*[0-9零一二三四五六七八九十百千]+\s*[章回节]\s*/u, '').trim()
    const body = text.replace(/^\s*#\s+.*$/m, '').trim()
    parts.push(`\n\n---\n\n## 第${chapter.n}章${headingTitle !== '' ? ` ${headingTitle}` : ''}\n\n${body}\n`)
  }
  const markdown = parts.join('')
  const format = options.format === 'docx' ? 'docx' : 'md'
  await ensureDir(join(root, 'export'))
  const chars = countChars(markdown)
  if (format === 'docx') {
    const { buildDocxBuffer } = await import('./docx.js')
    const buffer = buildDocxBuffer(markdown)
    const target = join(root, 'export', 'novel.docx')
    await writeFile(target, buffer)
    return { target: toPosix(target), chapters: chapters.length, chars, format, bytes: buffer.length }
  }
  const target = join(root, 'export', 'novel.md')
  await writeText(target, markdown)
  return { target: toPosix(target), chapters: chapters.length, chars, format }
}
