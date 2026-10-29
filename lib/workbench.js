// 写作台的只读内容接口：仅访问预先约定的小说文件，并检查符号链接的真实目标。
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { createHash } from 'node:crypto'

import { countChars, listChapterFiles, toPosix } from './core.js'

export const LIBRARY_CATEGORIES = [
  'premise', 'characters', 'worldRules', 'outline', 'timeline', 'foreshadows',
  'relationships', 'compass', 'style', 'summaries', 'reviews', 'decisions', 'continuation',
]

const MAX_FILE_BYTES = 8 * 1024 * 1024
const SOURCES = [
  ['premise', 'premise.md', 'markdown', '故事前提'],
  ['characters', 'characters.json', 'array', '人物'],
  ['worldRules', 'world_rules.json', 'array', '世界规则'],
  ['outline', 'outline.json', 'json', '章节大纲'],
  ['outline', 'layered_outline.json', 'json', '分层大纲'],
  ['timeline', 'timeline.jsonl', 'jsonl', '时间线'],
  ['foreshadows', 'foreshadow_ledger.json', 'array', '伏笔'],
  ['relationships', 'relationship_state.json', 'array', '人物关系'],
  ['compass', 'meta/compass.json', 'json', '故事指南针'],
  ['style', 'story/style.md', 'markdown', '文风卡'],
  ['continuation', 'story/continuation-plan.md', 'markdown', '续写方案'],
]
const DIRECTORIES = [
  ['summaries', 'story/summaries', '章节摘要'],
  ['reviews', 'story/reviews', '审阅报告'],
  ['decisions', 'story/decisions', '裁定记录'],
]

function message(error) {
  return String(error && error.message ? error.message : error)
}

function canonicalJson(value) {
  return JSON.stringify(value, (_key, item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item
    const ordered = Object.create(null)
    for (const key of Object.keys(item).sort()) ordered[key] = item[key]
    return ordered
  })
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 24)
}

function identityText(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

function recordIdentity(category, fields) {
  const id = identityText(fields.id)
  if (id !== '') return ['id', id]
  const chapter = identityText(fields.chapter ?? fields.chapter_index ?? fields.chapterIndex ?? fields.n)
  const time = identityText(fields.time)
  const event = identityText(fields.event)
  // 同一章可有多条时间线；时间优先，缺时间时再用事件区分。
  if (category === 'timeline' && (chapter !== '' || time !== '' || event !== '')) return ['timeline', chapter, time, time !== '' ? '' : event]
  const a = identityText(fields.character_a)
  const b = identityText(fields.character_b)
  if (category === 'relationships' && a !== '' && b !== '') return ['relationship', a, b]
  const name = identityText(fields.name)
  if (name !== '') return ['name', name]
  if (chapter !== '') return ['chapter', chapter]
  const title = identityText(fields.title)
  if (title !== '') return ['title', title]
  return ['content', canonicalJson(fields)]
}

function distinguishDuplicateIds(items) {
  const counts = new Map()
  for (const item of items) counts.set(item.id, (counts.get(item.id) || 0) + 1)
  const exactDuplicates = new Map()
  return items.map((item) => {
    if (counts.get(item.id) < 2) return item
    // 同名资料按完整内容区分，只有完全相同的副本才使用组内序号。
    const base = `${item.id}:${digest(canonicalJson(item.fields ?? item.content))}`
    const duplicate = exactDuplicates.get(base) || 0
    exactDuplicates.set(base, duplicate + 1)
    return { ...item, id: `${base}:${duplicate}` }
  })
}

export function apiError(status, text) {
  const error = new Error(text)
  error.status = status
  return error
}

function inside(root, target) {
  const rel = relative(root, target)
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../'))
}

async function checkedPath(root, rel) {
  const actualRoot = await realpath(root)
  const actualFile = await realpath(join(root, rel))
  if (!inside(actualRoot, actualFile)) throw apiError(403, `禁止读取项目目录外的文件：${toPosix(rel)}`)
  return actualFile
}

async function checkRoot(root) {
  try {
    const target = await realpath(root)
    if (!(await stat(target)).isDirectory()) throw apiError(400, '小说项目根路径必须是目录')
  } catch (error) {
    if (error && error.code === 'ENOENT') throw apiError(404, '小说项目目录不存在')
    throw error
  }
}

// 概览仍复用核心统计函数，先检查其访问的固定路径，防止正文尾段从项目外泄漏。
export async function checkWorkbenchProjectPaths(root) {
  await checkRoot(root)
  const files = new Set([
    ...SOURCES.map((source) => source[1]),
    ...DIRECTORIES.map((source) => source[1]),
    'chapters', 'meta/progress.json', 'story/state.json', 'story/drafts',
  ])
  for (const file of files) {
    try {
      await checkedPath(root, file)
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
  }
}

async function readProjectText(root, rel) {
  try {
    const target = await checkedPath(root, rel)
    const info = await stat(target)
    if (!info.isFile()) throw apiError(400, `不是可读取的文件：${toPosix(rel)}`)
    if (info.size > MAX_FILE_BYTES) throw apiError(413, `文件超过 8 MiB，暂无法在面板内打开：${toPosix(rel)}`)
    // 严格解码，损坏的文本不能伪装成正常章节或空资料。
    return new TextDecoder('utf-8', { fatal: true }).decode(await readFile(target))
  } catch (error) {
    if (error && error.code === 'ENOENT') return undefined
    throw error
  }
}

function parseJson(text, file) {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch (error) {
    throw apiError(422, `JSON 格式错误（${file}）：${message(error)}`)
  }
}

function titleFromText(text, fallback) {
  const match = /^\s*#\s+(.+)$/m.exec(text)
  return match ? match[1].trim() : fallback
}

export async function readWorkbenchChapter(root, value) {
  if (!/^[1-9]\d*$/.test(String(value ?? '')) || !Number.isSafeInteger(Number(value))) {
    throw apiError(400, 'chapter 必须是正整数')
  }
  await checkRoot(root)
  const n = Number(value)
  // 编号只用于查找真实目录条目，不能拼接用户提供的文件路径。
  try {
    await checkedPath(root, 'chapters')
  } catch (error) {
    if (error && error.code === 'ENOENT') throw apiError(404, `第 ${n} 章不存在`)
    throw error
  }
  const entries = await listChapterFiles(root)
  const found = entries.find((entry) => entry.n === n)
  if (!found) throw apiError(404, `第 ${n} 章不存在`)
  const file = `chapters/${found.file}`
  const content = await readProjectText(root, file)
  if (content === undefined) throw apiError(404, `第 ${n} 章已不存在，请刷新章节目录`)
  let completed = false
  const progress = await readProjectText(root, 'meta/progress.json')
  if (progress !== undefined) {
    // 进度损坏只影响状态标记，不应阻止阅读已存在的正文。
    try {
      const parsed = JSON.parse(progress.replace(/^\uFEFF/, ''))
      completed = Array.isArray(parsed?.completed_chapters) && parsed.completed_chapters.some((entry) => Number(entry) === n)
    } catch {}
  }
  return {
    ok: true,
    root: toPosix(root),
    chapter: { n, title: titleFromText(content, `第 ${n} 章`), chars: countChars(content), completed, file, content },
  }
}

function errorItem(category, file, error, index = '') {
  const text = message(error)
  return {
    id: `${category}:${file}:error:${digest(text)}`,
    category,
    title: `读取失败 · ${file}${index !== '' ? `:${index}` : ''}`,
    subtitle: text,
    file,
    content: text,
    format: 'fields',
    fields: { 错误: text },
    error: text,
    tags: ['格式或读取错误'],
  }
}

function recordItem(category, file, value, index, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return errorItem(category, file, new Error(`资料格式错误：第 ${index + 1} 条应为 JSON 对象`), index + 1)
  }
  const fields = value
  const chapter = fields.chapter ?? fields.chapter_index ?? fields.chapterIndex ?? fields.n
  const relation = fields.character_a && fields.character_b ? `${fields.character_a} ↔ ${fields.character_b}` : ''
  const name = fields.name ?? fields.title ?? relation
  const title = String(name || fields.id || (chapter ? `第 ${chapter} 章 · ${label}` : `${label} ${index + 1}`))
  const subtitle = String(fields.role ?? fields.description ?? fields.event ?? fields.goal ?? fields.relation ?? '')
  const tags = [fields.status, fields.category, chapter ? `第 ${chapter} 章` : '']
    .filter((entry) => entry !== undefined && entry !== null && String(entry) !== '')
    .map(String)
  return { id: `${category}:${file}:${digest(canonicalJson(recordIdentity(category, fields)))}`, category, title, subtitle, file, content: JSON.stringify(value, null, 2), format: 'fields', fields, tags }
}

async function sourceItems(root, [category, file, type, label]) {
  try {
    const text = await readProjectText(root, file)
    if (text === undefined) return []
    if (type === 'markdown') {
      return [{ id: `${category}:${file}`, category, title: titleFromText(text, label), file, content: text, format: 'markdown', tags: [] }]
    }
    if (type === 'jsonl') {
      const items = []
      for (const [index, line] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
        if (line.trim() === '') continue
        try {
          items.push(recordItem(category, file, parseJson(line, `${file}:${index + 1}`), index, label))
        } catch (error) {
          items.push(errorItem(category, file, error, index + 1))
        }
      }
      return items
    }
    const data = parseJson(text, file)
    if (type === 'array' && !Array.isArray(data)) throw apiError(422, `资料格式错误（${file}）：应为 JSON 数组`)
    if (type === 'json' && (data === null || typeof data !== 'object')) throw apiError(422, `资料格式错误（${file}）：应为 JSON 对象或数组`)
    if (Array.isArray(data)) return data.map((value, index) => recordItem(category, file, value, index, label))
    return [{ ...recordItem(category, file, data, 0, label), title: label }]
  } catch (error) {
    return [errorItem(category, file, error)]
  }
}

async function directoryItems(root, [category, directory, label]) {
  try {
    const target = await checkedPath(root, directory)
    const entries = await readdir(target, { withFileTypes: true })
    const items = []
    for (const entry of entries.filter((item) => (item.isFile() || item.isSymbolicLink()) && /\.(md|txt)$/i.test(item.name)).sort((a, b) => a.name.localeCompare(b.name))) {
      items.push(...await sourceItems(root, [category, `${directory}/${entry.name}`, 'markdown', `${label} · ${entry.name.replace(/\.(md|txt)$/i, '')}`]))
    }
    return items
  } catch (error) {
    if (error && error.code === 'ENOENT') return []
    return [errorItem(category, directory, error)]
  }
}

export async function readWorkbenchLibrary(root) {
  await checkRoot(root)
  const groups = await Promise.all([
    ...SOURCES.map((source) => sourceItems(root, source)),
    ...DIRECTORIES.map((source) => directoryItems(root, source)),
  ])
  const items = distinguishDuplicateIds(groups.flat())
  return {
    ok: true,
    root: toPosix(root),
    categories: LIBRARY_CATEGORIES.map((id) => ({ id, count: items.filter((item) => item.category === id).length })),
    items,
  }
}
