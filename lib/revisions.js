// 导入批次、剧情改写与正式版本的持久化核心；不依赖宿主或模型服务。
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile, rename, unlink, lstat, realpath, open } from 'node:fs/promises'
import { resolve, join, relative, isAbsolute, dirname, basename } from 'node:path'
import { countChars, decodeTextBuffer, initProject, padChapter } from './core.js'

const MAX_BYTES = 16 * 1024 * 1024
const MAX_PROJECT_BYTES = 128 * 1024 * 1024
const MAX_CHAPTERS = 5000
const FIXED_FILES = ['premise.md', 'characters.json', 'world_rules.json', 'outline.json', 'layered_outline.json', 'timeline.jsonl', 'foreshadow_ledger.json', 'relationship_state.json', 'meta/progress.json', 'meta/compass.json', 'story/style.md', 'story/state.json', 'story/continuation-plan.md']
const MANAGED_DIRS = ['chapters', 'story/plans', 'story/drafts', 'story/polished', 'story/reviews', 'story/summaries', 'story/decisions']
const MATERIAL_PATHS = { premise: 'premise.md', characters: 'characters.json', worldRules: 'world_rules.json', outline: 'outline.json', layeredOutline: 'layered_outline.json', timeline: 'timeline.jsonl', foreshadows: 'foreshadow_ledger.json', relationships: 'relationship_state.json', compass: 'meta/compass.json', style: 'story/style.md' }
const ARRAY_MATERIALS = ['characters', 'worldRules', 'foreshadows', 'relationships', 'timeline']
const rootQueues = new Map()
const now = () => new Date().toISOString()
const sha = (value) => createHash('sha256').update(value).digest('hex')
const clone = (value) => JSON.parse(JSON.stringify(value))

function fail(status, message) { const error = new Error(message); error.status = status; throw error }
function id(value, label = '编号') { const text = String(value ?? ''); if (!/^[a-z][a-z0-9-]{8,90}$/.test(text)) fail(400, `${label}无效`); return text }
function newId(prefix) { return `${prefix}-${randomUUID()}` }
function isInside(root, target) { const rel = relative(root, target); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\')) }
function managed(rel) { return FIXED_FILES.includes(rel) || MANAGED_DIRS.some((dir) => rel.startsWith(`${dir}/`) && !rel.slice(dir.length + 1).includes('/') && /\.(md|txt|json)$/i.test(rel)) }

async function rootPath(root, create = false) {
  const target = resolve(String(root || ''))
  if (create) await mkdir(target, { recursive: true })
  try { const actual = await realpath(target); if (!(await lstat(actual)).isDirectory()) fail(400, '项目根路径必须是目录'); return actual }
  catch (error) { if (error.code === 'ENOENT') fail(404, '项目目录不存在'); throw error }
}

// 即使目标尚未创建，也逐级检查现有父目录，拒绝目录联接与符号链接。
async function safe(root, rel, parents = false) {
  const boundary = await realpath(root)
  if (!isInside(root, boundary) || !isInside(boundary, root) || (await lstat(root)).isSymbolicLink()) fail(403, '候选项目根目录不能是符号链接')
  if (typeof rel !== 'string' || isAbsolute(rel) || rel.includes('\\') || rel.split('/').some((part) => !part || part === '.' || part === '..' || part.includes(':'))) fail(400, '项目内路径无效')
  const target = resolve(root, rel)
  if (!isInside(root, target)) fail(403, '禁止跨出小说项目目录')
  const parts = rel.split('/')
  let current = root
  for (let index = 0; index < parts.length; index++) {
    current = join(current, parts[index])
    try {
      const info = await lstat(current)
      if (info.isSymbolicLink()) fail(403, `禁止通过符号链接访问：${rel}`)
      if (index < parts.length - 1 && !info.isDirectory()) fail(400, `父路径不是目录：${rel}`)
      const actual = await realpath(current)
      if (!isInside(root, actual)) fail(403, `禁止访问项目外路径：${rel}`)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      if (parents && index < parts.length - 1) await mkdir(current)
    }
  }
  return target
}

async function readBytes(root, rel, fallback) {
  try { const target = await safe(root, rel); const info = await lstat(target); if (!info.isFile()) fail(400, `不是普通文件：${rel}`); if (info.size > MAX_BYTES) fail(413, `文件超过 16 MiB：${rel}`); return await readFile(target) }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error }
}
async function readJson(root, rel, fallback) {
  const bytes = await readBytes(root, rel)
  if (bytes === undefined) return fallback
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { fail(422, `数据文件损坏：${rel}`) }
}
async function atomic(root, rel, bytes) {
  const target = await safe(root, rel, true)
  const tempRel = `${rel}.tmp-${randomUUID()}`
  const temp = await safe(root, tempRel, true)
  const handle = await open(temp, 'wx')
  try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
  try {
    for (let attempt = 0; ; attempt++) {
      try { await safe(root, rel); await rename(temp, target); break }
      catch (error) {
        // Windows 的杀毒或并发只读句柄可能短暂阻止覆盖，保留原文件并有界重试。
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 7) throw error
        await new Promise((done) => setTimeout(done, 25 * (attempt + 1)))
      }
    }
  }
  catch (error) { await unlink(temp).catch(() => {}); throw error }
}
async function json(root, rel, value) { await atomic(root, rel, `${JSON.stringify(value, null, 2)}\n`) }
async function removeFile(root, rel) { try { await unlink(await safe(root, rel)) } catch (error) { if (error.code !== 'ENOENT') throw error } }
async function listDir(root, rel) {
  try { return await readdir(await safe(root, rel), { withFileTypes: true }) }
  catch (error) { if (error.code === 'ENOENT') return []; throw error }
}
function processAlive(pid) { try { process.kill(Number(pid), 0); return true } catch (error) { return error.code === 'EPERM' } }

async function withRoot(root, work, create = true) {
  const actual = await rootPath(root, create)
  const previous = rootQueues.get(actual) || Promise.resolve()
  let release
  const waiting = new Promise((done) => { release = done })
  const queued = previous.catch(() => {}).then(() => waiting)
  rootQueues.set(actual, queued)
  await previous.catch(() => {})
  const lockRel = 'story/versions/.write-lock.json'
  const owner = randomUUID()
  let hasLock = false
  try {
    const lockPath = await safe(actual, lockRel, true)
    for (let attempt = 0; attempt < 2; attempt++) {
      try { const handle = await open(lockPath, 'wx'); try { await handle.writeFile(JSON.stringify({ pid: process.pid, owner, at: now() })); await handle.sync() } finally { await handle.close() }; hasLock = true; break }
      catch (error) {
        if (error.code !== 'EEXIST') throw error
        let lock
        try { lock = await readJson(actual, lockRel, {}) }
        catch (error) {
          const info = await lstat(lockPath)
          if (error.status === 422 && Date.now() - info.mtimeMs > 30000) { await removeFile(actual, lockRel); continue }
          fail(409, '项目锁尚未写完，请稍后重试；遗留的损坏锁会自动回收')
        }
        if (lock.pid && processAlive(lock.pid)) fail(409, '项目正在保存，请稍后重试')
        await removeFile(actual, lockRel)
      }
    }
    if (!hasLock) fail(409, '无法取得项目写入锁')
    await recoverTransaction(actual)
    return await work(actual)
  } finally {
    try { if (hasLock) { const lock = await readJson(actual, lockRel, {}); if (lock.owner === owner) await removeFile(actual, lockRel) } }
    finally { release(); if (rootQueues.get(actual) === queued) rootQueues.delete(actual) }
  }
}

// 宿主的既有读写也使用同一把锁，避免在采用或回退中观察到跨版本文件。
export async function withRevisionLock(root, callback, options = {}) { return await withRoot(root, callback, options.create === true) }

async function managedFiles(root) {
  const files = {}
  let total = 0
  const add = async (rel) => {
    const content = await readBytes(root, rel)
    if (content === undefined) return
    total += content.length
    if (total > MAX_PROJECT_BYTES) fail(413, '小说项目受管内容超过 128 MiB')
    files[rel] = { hash: sha(content), content }
  }
  for (const rel of FIXED_FILES) await add(rel)
  for (const dir of MANAGED_DIRS) {
    for (const entry of await listDir(root, dir)) {
      if (entry.isSymbolicLink()) fail(403, `正文或资料目录含符号链接：${dir}/${entry.name}`)
      if (entry.isFile() && managed(`${dir}/${entry.name}`)) await add(`${dir}/${entry.name}`)
    }
  }
  return files
}
function fingerprint(files) { return sha(JSON.stringify(Object.keys(files).sort().map((rel) => [rel, files[rel].hash]))) }
async function copyManaged(from, to) {
  const files = await managedFiles(from)
  for (const [rel, value] of Object.entries(files)) await atomic(to, rel, value.content)
  return files
}
async function replaceManaged(root, files) {
  for (const rel of Object.keys(files)) if (!managed(rel)) fail(400, `快照包含不受管理的路径：${rel}`)
  const existing = await managedFiles(root)
  for (const [rel, value] of Object.entries(files)) await atomic(root, rel, value.content)
  for (const rel of Object.keys(existing)) if (!files[rel]) await removeFile(root, rel)
  // 上下文是可重建缓存，不参与版本指纹；正式内容变化后丢弃旧缓存。
  for (const entry of await listDir(root, 'story/context')) if (entry.isFile() && /\.md$/i.test(entry.name)) await removeFile(root, `story/context/${entry.name}`)
}
async function indexOf(root) { return await readJson(root, 'story/versions/index.json', { schema: 1, activeVersionId: null, currentHash: null, versions: [] }) }
function versionMeta(value) { const { files, ...metadata } = value; return { ...metadata, fileCount: Array.isArray(files) ? files.length : value.fileCount || 0 } }
async function saveSnapshot(root, files, meta) {
  const versionId = newId('version')
  const prefix = `story/versions/${versionId}`
  for (const [rel, value] of Object.entries(files)) await atomic(root, `${prefix}/project/${rel}`, value.content)
  const manifest = { id: versionId, createdAt: now(), ...meta, hash: fingerprint(files), files: Object.keys(files).sort().map((rel) => ({ file: rel, hash: files[rel].hash })) }
  await json(root, `${prefix}/manifest.json`, manifest)
  return versionMeta(manifest)
}
async function snapshotFiles(root, versionId) {
  const value = await readJson(root, `story/versions/${id(versionId)}/manifest.json`)
  if (!value || value.id !== versionId || !Array.isArray(value.files)) fail(404, '版本不存在')
  const files = {}
  for (const item of value.files) {
    if (!managed(item.file)) fail(422, '版本包含非法项目路径')
    const content = await readBytes(root, `story/versions/${versionId}/project/${item.file}`)
    if (content === undefined || sha(content) !== item.hash) fail(422, `版本文件缺失或损坏：${item.file}`)
    files[item.file] = { hash: item.hash, content }
  }
  if (fingerprint(files) !== value.hash) fail(422, '版本清单校验失败')
  return { manifest: value, files }
}
async function recoverTransaction(root) {
  const journal = await readJson(root, 'story/versions/transaction.json')
  if (!journal) return
  if (journal.phase === 'committed') { await json(root, 'story/versions/index.json', journal.afterIndex); await removeFile(root, 'story/versions/transaction.json'); return }
  const before = await snapshotFiles(root, journal.beforeVersionId)
  await replaceManaged(root, before.files)
  await json(root, 'story/versions/index.json', journal.beforeIndex)
  await removeFile(root, 'story/versions/transaction.json')
}
async function installVersion(root, files, meta, expectedHash) {
  const current = await managedFiles(root)
  if (expectedHash && fingerprint(current) !== expectedHash) fail(409, '正式项目已被修改，请重新核对后创建改写版本，不能覆盖人工修改')
  let beforeIndex = await indexOf(root)
  let beforeVersionId = beforeIndex.activeVersionId
  if (!beforeVersionId || beforeIndex.currentHash !== fingerprint(current)) {
    const base = await saveSnapshot(root, current, { title: '采用前版本', kind: 'baseline' })
    beforeVersionId = base.id
    beforeIndex = { ...beforeIndex, activeVersionId: base.id, currentHash: base.hash, versions: [...beforeIndex.versions, base] }
    await json(root, 'story/versions/index.json', beforeIndex)
  }
  const next = await saveSnapshot(root, files, { ...meta, previousVersionId: beforeVersionId })
  const afterIndex = { ...beforeIndex, activeVersionId: next.id, currentHash: next.hash, versions: [...beforeIndex.versions, next] }
  const journal = { id: newId('transaction'), phase: 'prepared', beforeVersionId, beforeIndex, afterIndex }
  await json(root, 'story/versions/transaction.json', journal)
  try {
    await replaceManaged(root, files)
    await json(root, 'story/versions/index.json', afterIndex)
    await json(root, 'story/versions/transaction.json', { ...journal, phase: 'committed' })
    await removeFile(root, 'story/versions/transaction.json')
    return next
  } catch (error) {
    try { await replaceManaged(root, current); await json(root, 'story/versions/index.json', beforeIndex); await removeFile(root, 'story/versions/transaction.json') }
    catch { fail(500, '采用中断，恢复记录已保留；重新打开项目后将恢复采用前版本') }
    throw error
  }
}

function normalizeText(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'), encoding: 'utf-8-bom' } }
    catch { fail(422, 'UTF-8 BOM 文件含损坏的字符编码') }
  }
  const decoded = decodeTextBuffer(bytes)
  if (decoded.encoding === 'utf-8-lossy' || decoded.text.includes('\u0000')) fail(422, '文件不是有效的 UTF-8 / GB18030 纯文本')
  return { ...decoded, text: decoded.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n') }
}
function splitImport(text) {
  const lines = text.split('\n')
  const heads = []
  const pattern = /^(?:第\s*[0-9０-９一二三四五六七八九十百千零两]+\s*[章回节卷]|chapter\s+\d+|卷[0-9一二三四五六七八九十]+)/i
  lines.forEach((line, index) => { const title = line.trim().replace(/^#{1,6}\s*/, ''); if (title.length <= 100 && pattern.test(title)) heads.push(index) })
  const values = []
  if (!heads.length) values.push({ title: /^\s*#\s+(.+)$/m.exec(text)?.[1]?.trim() || '全文', text })
  else {
    if (heads[0] > 0 && lines.slice(0, heads[0]).join('\n').trim()) values.push({ title: '卷首 / 引子', text: lines.slice(0, heads[0]).join('\n').trim() })
    for (let i = 0; i < heads.length; i++) values.push({ title: lines[heads[i]].trim().replace(/^#{1,6}\s*/, ''), text: lines.slice(heads[i], heads[i + 1] ?? lines.length).join('\n').trim() })
  }
  return normalizeChapters(values)
}
function normalizeChapters(values) {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_CHAPTERS) fail(400, `章节清单必须包含 1–${MAX_CHAPTERS} 章`)
  let bytes = 0
  const used = new Set()
  return values.map((item, index) => {
    if (!item || typeof item !== 'object') fail(400, '章节条目必须是对象')
    let text = String(item.text ?? item.content ?? '').replace(/\r\n?/g, '\n').trim()
    const title = String(item.title || `第 ${index + 1} 章`).trim().slice(0, 200)
    const firstLine = text.split('\n', 1)[0]
    if (/^#\s+/.test(firstLine) || /^(?:#{1,6}\s*)?(?:第\s*[0-9０-９一二三四五六七八九十百千零两]+\s*[章回节卷]|chapter\s+\d+)/i.test(firstLine)) text = `# ${title}${text.slice(firstLine.length)}`
    if (!text) fail(400, `第 ${index + 1} 章正文为空`)
    bytes += Buffer.byteLength(text)
    if (bytes > MAX_BYTES) fail(413, '切章后正文超过 16 MiB')
    if (item.complete === false && index !== values.length - 1) fail(400, '只能将最后一章标记为残缺半章')
    const chapterId = typeof item.id === 'string' && /^[a-z0-9-]{8,90}$/.test(item.id) ? item.id : newId('chapter')
    if (used.has(chapterId)) fail(400, '章节编号重复')
    used.add(chapterId)
    return { id: chapterId, n: index + 1, title, text, content: text, chars: countChars(text), hash: sha(text), complete: item.complete !== false }
  })
}
function cutHash(chapters) { return sha(JSON.stringify(chapters.map(({ id: chapterId, title, text, complete }) => ({ id: chapterId, title, text, complete })))) }
function importSummary(value) { const { analysis, ...rest } = value; return rest }
export function importRoot(root, importId) { return join(resolve(root), 'story', 'imports', id(importId, '导入编号')) }
export function candidateRoot(root, rewriteId) { return join(resolve(root), 'story', 'rewrites', id(rewriteId, '改写编号'), 'project') }
export async function checkedRevisionProjectRoot(root, rewriteId, kind = 'candidate') {
  const actual = await rootPath(root)
  if (!['candidate', 'original'].includes(kind)) fail(400, '版本资料来源无效')
  const segment = kind === 'original' ? 'original' : 'project'
  const target = await safe(actual, `story/rewrites/${id(rewriteId, '改写编号')}/${segment}`)
  if (!(await lstat(target)).isDirectory()) fail(404, '版本项目目录不存在')
  return target
}
export async function readImport(root, importId) {
  const actual = await rootPath(root)
  const value = await readJson(actual, `story/imports/${id(importId, '导入编号')}/manifest.json`)
  if (!value || value.id !== importId) fail(404, '导入批次不存在')
  const analysis = await readJson(actual, `story/imports/${importId}/analysis.json`)
  if (analysis && analysis.sourceHash !== value.contentHash) fail(409, '导入分析与当前切章不匹配，请重新分析')
  return { ...value, ...(analysis ? { analysis } : {}) }
}
export async function updateImport(root, importId, updater) {
  return await withRoot(root, async (actual) => {
    const value = await readImport(actual, importId)
    const original = importSummary(value)
    const copy = clone(original)
    const result = typeof updater === 'function' ? updater(copy) : { ...copy, ...updater }
    if (result && typeof result.then === 'function') fail(400, '导入状态更新必须同步完成')
    const next = result || copy
    for (const key of ['id', 'sourceHash', 'contentHash', 'analysisReady', 'status', 'chapterCount', 'completeChapters']) if (next[key] !== original[key]) fail(400, `不能通过调度状态修改导入内容：${key}`)
    next.updatedAt = now()
    await json(actual, `story/imports/${importId}/manifest.json`, next)
    return next
  }, false)
}
export async function getImportChapters(root, importId) {
  const actual = await rootPath(root)
  const manifest = await readImport(actual, importId)
  const chapters = await readJson(actual, `story/imports/${importId}/chapters.json`)
  if (!Array.isArray(chapters) || cutHash(chapters) !== manifest.contentHash) fail(422, '导入章节清单校验失败')
  return chapters
}
async function importManuscript(root, args) {
  const filename = basename(String(args.filename || '半成品.txt')).replace(/[\x00-\x1f]/g, '')
  if (!/\.(txt|md|markdown)$/i.test(filename)) fail(400, '首版仅支持 TXT、Markdown 文件')
  let bytes
  if (typeof args.text === 'string' && args.text.trim()) bytes = Buffer.from(args.text, 'utf8')
  else {
    const encoded = typeof args.contentBase64 === 'string' ? args.contentBase64 : ''
    if (!encoded || encoded.length > Math.ceil(MAX_BYTES / 3) * 4 || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail(400, '文件编码无效或超过 16 MiB')
    bytes = Buffer.from(encoded, 'base64')
    if (bytes.toString('base64') !== encoded) fail(400, '文件 Base64 编码无效')
  }
  if (bytes.length > MAX_BYTES) fail(413, '导入文件超过 16 MiB')
  const decoded = normalizeText(bytes)
  if (!decoded.text.trim()) fail(400, '半成品文件为空')
  const chapters = splitImport(decoded.text)
  const importId = newId('import')
  const manifest = { schema: 1, id: importId, title: String(args.title || filename.replace(/\.(txt|md|markdown)$/i, '')).slice(0, 200), filename, encoding: decoded.encoding, sourceHash: sha(bytes), contentHash: cutHash(chapters), chapterCount: chapters.length, completeChapters: chapters.length, totalChars: countChars(decoded.text), createdAt: now(), updatedAt: now(), status: 'prepared', analysisReady: false }
  await atomic(root, `story/imports/${importId}/original.bin`, bytes)
  await atomic(root, `story/imports/${importId}/source.txt`, decoded.text)
  await json(root, `story/imports/${importId}/chapters.json`, chapters)
  await json(root, `story/imports/${importId}/manifest.json`, manifest)
  return { ok: true, import: manifest, chapters }
}
async function saveChapters(root, args) {
  const value = await readImport(root, args.importId)
  if ((await allTasks(root)).some((task) => task.importId === value.id && !['cancelled', 'applied'].includes(task.status))) fail(409, '此导入稿已建立改写版本，请先取消改写或作为新批次重新导入')
  if (args.expectedHash && args.expectedHash !== value.contentHash) fail(409, '章节清单已变化，请刷新后重试')
  const chapters = normalizeChapters(args.chapters)
  const contentHash = cutHash(chapters)
  if (contentHash === value.contentHash) return { ok: true, import: importSummary(value), chapters, unchanged: true }
  const next = { ...importSummary(value), contentHash, chapterCount: chapters.length, completeChapters: chapters.filter((chapter) => chapter.complete).length, totalChars: chapters.reduce((sum, chapter) => sum + chapter.chars, 0), analysisReady: false, analysisHash: null, status: 'prepared', updatedAt: now() }
  await json(root, `story/imports/${value.id}/chapters.json`, chapters)
  await json(root, `story/imports/${value.id}/manifest.json`, next)
  await removeFile(root, `story/imports/${value.id}/analysis.json`)
  return { ok: true, import: next, chapters }
}
function materialObject(value, required = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, '故事资料必须是对象')
  for (const key of ARRAY_MATERIALS) if ((required || value[key] !== undefined) && !Array.isArray(value[key])) fail(400, `故事资料 ${key} 必须是数组`)
  for (const key of ARRAY_MATERIALS) if (Array.isArray(value[key]) && value[key].some((entry) => entry === null || typeof entry !== 'object' || Array.isArray(entry))) fail(400, `故事资料 ${key} 含非对象条目`)
  for (const key of ['premise', 'style']) if (value[key] !== undefined && typeof value[key] !== 'string') fail(400, `故事资料 ${key} 必须是文本`)
  for (const key of ['outline', 'layeredOutline', 'compass']) if (value[key] !== undefined && (value[key] === null || typeof value[key] !== 'object')) fail(400, `故事资料 ${key} 必须是对象或数组`)
  if (required && value.outline === undefined) fail(400, '故事资料缺少新版大纲')
  return value
}
function mergeAnalysis(previous = {}, delta = {}) {
  const next = { ...previous, ...delta }
  const keys = {
    chapters: (entry) => Number(entry.n ?? entry.chapter),
    characters: (entry) => entry.name,
    worldRules: (entry) => entry.name,
    foreshadows: (entry) => entry.id,
    relationships: (entry) => `${entry.character_a}|${entry.character_b}`,
    timeline: (entry) => `${entry.chapter}|${entry.time || ''}|${entry.event || ''}`,
    outline: (entry) => Number(entry.chapter ?? entry.n),
  }
  for (const [key, identity] of Object.entries(keys)) {
    if (delta[key] === undefined) { if (previous[key] !== undefined) next[key] = previous[key]; continue }
    if (!Array.isArray(delta[key])) continue
    const merged = new Map()
    for (const item of [...(Array.isArray(previous[key]) ? previous[key] : []), ...delta[key]]) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) fail(400, `分析资料 ${key} 含非对象条目`)
      const value = identity(item)
      const stable = value === undefined || value === '' || Number.isNaN(value) ? `content:${sha(JSON.stringify(item))}` : String(value)
      merged.set(stable, { ...(merged.get(stable) || {}), ...item })
    }
    next[key] = [...merged.values()]
    if (['chapters', 'outline'].includes(key)) next[key].sort((a, b) => Number(a.n ?? a.chapter) - Number(b.n ?? b.chapter))
  }
  return next
}
async function writeMaterials(root, materials) {
  materialObject(materials)
  for (const [key, file] of Object.entries(MATERIAL_PATHS)) {
    if (materials[key] === undefined) continue
    const value = materials[key]
    const content = key === 'timeline' ? value.map((entry) => JSON.stringify(entry)).join('\n') + (value.length ? '\n' : '') : typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`
    await atomic(root, file, content)
  }
}
async function readMaterials(root) {
  const materials = {}
  for (const [key, file] of Object.entries(MATERIAL_PATHS)) {
    const bytes = await readBytes(root, file)
    if (bytes === undefined) continue
    if (['premise', 'style'].includes(key)) materials[key] = bytes.toString('utf8')
    else if (key === 'timeline') {
      materials.timeline = bytes.toString('utf8').split(/\r?\n/).filter((line) => line.trim()).map((line) => { try { return JSON.parse(line) } catch { fail(422, '原稿时间线含损坏的 JSON 行') } })
    } else materials[key] = await readJson(root, file)
  }
  return materials
}
async function saveAnalysis(root, args) {
  const value = await readImport(root, args.importId)
  if (!args.expectedHash) fail(400, '保存分析必须提供 expectedHash')
  if (args.expectedHash !== value.contentHash) fail(409, '切章已变化，旧分析不能写回，请重新分析')
  const analysis = args.merge === true ? mergeAnalysis(value.analysis || {}, args.analysis || {}) : args.analysis
  const complete = args.complete !== false
  materialObject(analysis, complete)
  if (!Array.isArray(analysis.chapters)) fail(400, '原稿分析必须包含逐章摘要')
  const chapters = await getImportChapters(root, value.id)
  const seen = new Set()
  for (const item of analysis.chapters) {
    if (!chapters.some((chapter) => chapter.n === Number(item.n ?? item.chapter)) || seen.has(Number(item.n ?? item.chapter)) || !String(item.summary || '').trim()) fail(400, '逐章分析编号重复、越界或缺少摘要')
    seen.add(Number(item.n ?? item.chapter))
  }
  if (complete && !chapters.filter((chapter) => chapter.complete).every((chapter) => seen.has(chapter.n))) fail(400, '逐章分析尚未覆盖全部完整原稿章节')
  if (complete && (!String(analysis.summary || '').trim() || !String(analysis.style || '').trim() || !String(analysis.premise || '').trim())) fail(400, '完整原稿分析必须包含概述、故事前提和文风卡')
  const nextAnalysis = { ...analysis, sourceHash: value.contentHash, savedAt: now() }
  await json(root, `story/imports/${value.id}/analysis.json`, nextAnalysis)
  const analysisHash = sha(JSON.stringify({ ...analysis, sourceHash: undefined, savedAt: undefined }))
  const next = { ...importSummary(value), analysisReady: complete, analysisHash, status: complete ? 'analyzed' : 'analyzing', updatedAt: now() }
  await json(root, `story/imports/${value.id}/manifest.json`, next)
  return { ok: true, import: next }
}

async function chaptersAt(root) {
  const values = []
  const used = new Set()
  for (const entry of await listDir(root, 'chapters')) {
    if (entry.isSymbolicLink()) fail(403, '章节目录包含符号链接')
    const match = /^(\d+).*\.md$/i.exec(entry.name)
    if (!entry.isFile() || !match) continue
    const n = Number(match[1])
    if (!Number.isSafeInteger(n) || n < 1 || used.has(n)) fail(422, '章节号无效或重复，首版要求章号唯一')
    used.add(n)
    const bytes = await readBytes(root, `chapters/${entry.name}`)
    let content
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { fail(422, `章节不是 UTF-8：${entry.name}`) }
    if (!content.trim()) fail(422, `章节正文为空：${entry.name}`)
    const title = /^\s*#\s+(.+)$/m.exec(content)?.[1]?.trim() || `第 ${n} 章`
    values.push({ n, title, content, text: content, hash: sha(bytes), chars: countChars(content), file: `chapters/${entry.name}` })
  }
  return values.sort((a, b) => a.n - b.n)
}
// 派单和对照只读目标章；全书扫描仅用于建立版本、验收和内容指纹。
async function chapterAt(root, chapterNumber, knownFile) {
  const n = Number(chapterNumber)
  let file = knownFile
  if (!file) {
    const matches = (await listDir(root, 'chapters')).filter((entry) => entry.isFile() && /^(\d+).*\.md$/i.test(entry.name) && Number(/^(\d+)/.exec(entry.name)[1]) === n)
    if (matches.length !== 1) fail(matches.length ? 422 : 404, `第 ${n} 章不存在或编号重复`)
    file = `chapters/${matches[0].name}`
  }
  if (!/^chapters\/\d+[^/]*\.md$/i.test(file) || Number(/^chapters\/(\d+)/.exec(file)[1]) !== n) fail(422, '任务中的章节路径无效')
  const bytes = await readBytes(root, file)
  if (bytes === undefined) fail(404, `第 ${n} 章正文已不存在`)
  let content
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { fail(422, `第 ${n} 章不是 UTF-8 正文`) }
  if (!content.trim()) fail(422, `第 ${n} 章正文为空`)
  return { n, file, title: /^\s*#\s+(.+)$/m.exec(content)?.[1]?.trim() || `第 ${n} 章`, content, text: content, hash: sha(bytes), chars: countChars(content) }
}
async function projectFromImport(root, importId, rel) {
  const imported = await readImport(root, importId)
  if (!imported.analysisReady) fail(409, '请先完成原稿分析，再采用或改写此导入稿')
  const target = await safe(root, `${rel}/premise.md`, true)
  const project = dirname(target)
  await replaceManaged(project, {})
  await initProject(project, { title: imported.title })
  const chapters = (await getImportChapters(root, importId)).filter((chapter) => chapter.complete)
  if (!chapters.length) fail(400, '没有可采用的完整章节')
  for (const chapter of chapters) {
    const content = /^\s*#\s+[^\n]+/.test(chapter.text) ? chapter.text.replace(/^\s*#\s+[^\n]+/, `# ${chapter.title}`) : `# ${chapter.title}\n\n${chapter.text}`
    await atomic(project, `chapters/${padChapter(chapter.n)}.md`, content)
    const analyzed = imported.analysis.chapters.find((item) => Number(item.n ?? item.chapter) === chapter.n)
    await atomic(project, `story/summaries/${padChapter(chapter.n)}.md`, `# ${chapter.title}\n\n${analyzed.summary}\n`)
  }
  const completeNumbers = new Set(chapters.map((chapter) => chapter.n))
  const materials = clone(imported.analysis)
  // 半章作为原稿证据保留，其事件与引用不能被计入正式完整章的既成事实。
  for (const key of ['timeline', 'relationships', 'characters', 'worldRules']) if (Array.isArray(materials[key])) materials[key] = materials[key].filter((entry) => entry.chapter === undefined || completeNumbers.has(Number(entry.chapter)))
  if (Array.isArray(materials.foreshadows)) materials.foreshadows = materials.foreshadows.map((entry) => ({ ...entry, ...(Array.isArray(entry.chapters) ? { chapters: entry.chapters.filter((n) => completeNumbers.has(Number(n))) } : {}) }))
  await writeMaterials(project, materials)
  const savedChapters = await chaptersAt(project)
  await json(project, 'meta/progress.json', { title: imported.title, completed_chapters: chapters.map((chapter) => chapter.n), words: savedChapters.reduce((sum, chapter) => sum + chapter.chars, 0), phase: 'imported', updated_at: now() })
  await json(project, 'story/state.json', { stage: 'imported', last_chapter: chapters.at(-1).n, updated_at: now(), import_id: importId })
  return { imported, project }
}
async function materializeImport(root, args) {
  const imported = await readImport(root, args.importId)
  const versions = await indexOf(root)
  const previous = versions.versions.findLast((version) => version.kind === 'import' && version.importId === imported.id && version.importContentHash === imported.contentHash && version.importAnalysisHash === imported.analysisHash)
  if (previous && versions.activeVersionId === previous.id && versions.currentHash === fingerprint(await managedFiles(root))) return { ok: true, versionId: previous.id, version: previous, importId: imported.id, unchanged: true }
  const existing = await chaptersAt(root)
  if (existing.length && args.replace !== true) fail(409, '当前项目已有正文；确认整体替换后传 replace=true，采用前会保存完整版本')
  const { project } = await projectFromImport(root, args.importId, `story/imports/${id(args.importId)}/project`)
  await validateCandidate(project)
  const version = await installVersion(root, await managedFiles(project), { title: imported.title, kind: 'import', importId: imported.id, importContentHash: imported.contentHash, importAnalysisHash: imported.analysisHash }, args.expectedHash)
  return { ok: true, versionId: version.id, version, importId: imported.id }
}

async function rawTask(root, rewriteId) {
  const value = await readJson(root, `story/rewrites/${id(rewriteId, '改写编号')}/task.json`)
  if (!value || value.id !== rewriteId) fail(404, '改写任务不存在')
  return value
}
async function persistTask(root, task) { task.updatedAt = now(); await json(root, `story/rewrites/${task.id}/task.json`, task); return task }
async function interruptStaleTask(root, task) {
  if (task.status === 'running' && task.ownerPid && !processAlive(task.ownerPid)) {
    task.status = 'paused'; task.error = '上次进程已结束，可继续恢复改写'; task.interrupted = true
    for (const chapter of task.chapters) if (chapter.status === 'processing') { chapter.status = 'pending'; delete chapter.claimToken }
    await persistTask(root, task)
  }
  return task
}
export async function readRewriteTask(root, rewriteId) {
  return await withRoot(root, async (actual) => interruptStaleTask(actual, await rawTask(actual, rewriteId)), false)
}
export async function updateRewriteTask(root, rewriteId, updater) {
  return await withRoot(root, async (actual) => {
    const task = await rawTask(actual, rewriteId)
    const copy = clone(task)
    const result = typeof updater === 'function' ? updater(copy) : { ...copy, ...updater }
    if (result && typeof result.then === 'function') fail(400, '任务更新必须同步完成，不能在项目锁内等待模型或网络')
    const next = result || copy
    if (next.id !== task.id) fail(400, '不能修改任务编号')
    return await persistTask(actual, next)
  }, false)
}
async function allTasks(root) {
  const out = []
  for (const entry of await listDir(root, 'story/rewrites')) if (entry.isDirectory() && /^[a-z][a-z0-9-]{8,90}$/.test(entry.name)) {
    if (!(await readBytes(root, `story/rewrites/${entry.name}/task.json`))) continue
    const task = await rawTask(root, entry.name)
    out.push(await interruptStaleTask(root, task))
  }
  return out
}
function textList(value) { return (Array.isArray(value) ? value : String(value || '').split('\n')).map((item) => String(item).trim()).filter(Boolean).slice(0, 100) }
async function createRewrite(root, args) {
  const active = (await allTasks(root)).find((task) => !['applied', 'cancelled'].includes(task.status))
  if (active) fail(409, '首版同时只保留一个未结束的候选版本，请先采用或取消现有任务')
  const requirements = String(args.requirements || '').trim()
  if (!requirements) fail(400, '请填写剧情改写要求')
  if (requirements.length > 20000) fail(413, '改写要求过长')
  const rewriteId = newId('rewrite')
  const originalRel = `story/rewrites/${rewriteId}/original`
  const originalPath = dirname(await safe(root, `${originalRel}/premise.md`, true))
  const formal = await managedFiles(root)
  let title = ''
  if (args.importId) {
    const result = await projectFromImport(root, args.importId, originalRel)
    title = result.imported.title
    await json(root, `story/rewrites/${rewriteId}/reference-analysis.json`, result.imported.analysis)
  } else {
    if (!(await chaptersAt(root)).length) fail(400, '当前项目还没有正文，请先导入并分析半成品')
    await copyManaged(root, originalPath)
    title = (await readJson(root, 'meta/progress.json', {})).title || '剧情改写'
    const sourceChapters = await chaptersAt(originalPath)
    const analysis = { ...await readMaterials(originalPath), source: 'original-reference', summary: '当前正式项目的冻结原稿资料', chapters: [] }
    for (const chapter of sourceChapters) {
      const summary = await readBytes(originalPath, `story/summaries/${padChapter(chapter.n)}.md`)
      analysis.chapters.push({ n: chapter.n, title: chapter.title, summary: summary?.toString('utf8') || '', sourceChapter: chapter.n })
    }
    await json(root, `story/rewrites/${rewriteId}/reference-analysis.json`, analysis)
  }
  const chapters = await chaptersAt(originalPath)
  if (!chapters.length) fail(400, '没有可改写的完整章节')
  const from = Number(args.scope?.from ?? chapters[0].n)
  const to = Number(args.scope?.to ?? chapters.at(-1).n)
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from > to || !chapters.some((chapter) => chapter.n === from) || !chapters.some((chapter) => chapter.n === to)) fail(400, '改写范围必须是已有完整章节的有效区间')
  const candidate = dirname(await safe(root, `story/rewrites/${rewriteId}/project/premise.md`, true))
  await copyManaged(originalPath, candidate)
  await initProject(candidate, { title })
  const task = {
    schema: 1, id: rewriteId, title: String(title), importId: args.importId || null, status: 'draft_plan', requirements,
    preserve: textList(args.preserve), forbidden: textList(args.forbidden), degree: ['local', 'plot', 'rebuild'].includes(args.degree) ? args.degree : 'plot',
    scope: { from, to }, lockedChapters: Array.isArray(args.lockedChapters) ? args.lockedChapters.map(Number).filter((n) => Number.isInteger(n)) : [],
    chapters: chapters.map((chapter) => ({ n: chapter.n, file: chapter.file, title: chapter.title, sourceHash: chapter.hash, status: 'pending', change: chapter.n >= from && chapter.n <= to ? 'rewrite' : 'keep', reason: '', chars: chapter.chars })),
    plan: null, planApproved: false, cursor: from, formalHash: fingerprint(formal), originalHash: fingerprint(await managedFiles(originalPath)),
    materialsReady: false, materialsCheckpoint: null, createdAt: now(), updatedAt: now(), error: '',
  }
  await persistTask(root, task)
  return { ok: true, task }
}
async function savePlan(root, args) {
  const task = await rawTask(root, args.rewriteId)
  if (!['draft_plan', 'awaiting_approval', 'ready'].includes(task.status) || task.chapters.some((chapter) => ['passed', 'processing'].includes(chapter.status))) fail(409, '任务已经执行，不能覆盖改写方案')
  const plan = args.plan
  if (!plan || typeof plan !== 'object' || !String(plan.summary || '').trim() || !Array.isArray(plan.outline)) fail(400, '改写方案需要摘要和完整逐章大纲')
  const seen = new Set()
  const outline = plan.outline.map((item) => {
    const n = Number(item.chapter ?? item.n)
    const chapter = task.chapters.find((entry) => entry.n === n)
    if (!chapter || seen.has(n) || !['rewrite', 'check', 'keep'].includes(item.change)) fail(400, '方案章节重复、缺失或处理方式无效')
    if ((n < task.scope.from || n > task.scope.to || task.lockedChapters.includes(n)) && item.change === 'rewrite') fail(400, `第 ${n} 章超出可改写范围；请先调整范围或保留约束`)
    if (task.lockedChapters.includes(n) && item.change !== 'keep') fail(400, `第 ${n} 章已锁定，不能加入改写或联动检查`)
    seen.add(n)
    return { chapter: n, title: item.change === 'rewrite' ? String(item.title || chapter.title).slice(0, 200) : chapter.title, goal: String(item.goal || '').slice(0, 6000), change: item.change, reason: String(item.reason || '').slice(0, 3000) }
  }).sort((a, b) => a.chapter - b.chapter)
  if (seen.size !== task.chapters.length) fail(400, '方案必须覆盖全部章节，并明确保留、改写或联动检查')
  task.plan = { summary: String(plan.summary).slice(0, 20000), outline, impact: plan.impact ?? [], risks: plan.risks ?? [], createdAt: now() }
  task.planApproved = false; task.status = 'awaiting_approval'; task.error = ''
  for (const chapter of task.chapters) { const item = outline.find((entry) => entry.chapter === chapter.n); chapter.change = item.change; chapter.reason = item.reason; chapter.status = 'pending'; chapter.title = item.title }
  await persistTask(root, task)
  return { ok: true, task }
}
function nextPending(task) { return task.chapters.find((chapter) => !['passed', 'kept'].includes(chapter.status)) }
async function taskControl(root, args) {
  const task = await interruptStaleTask(root, await rawTask(root, args.rewriteId))
  const action = args.action
  if (action === 'approve_plan') {
    if (task.status !== 'awaiting_approval' || !task.plan) fail(409, '尚无可确认的改写方案')
    task.planApproved = true; task.status = 'ready'; task.approvedAt = now()
    for (const chapter of task.chapters) if (chapter.change === 'keep') chapter.status = 'kept'
  } else if (['start', 'resume', 'retry'].includes(action)) {
    if (!task.planApproved || !task.plan) fail(409, '请先确认改写方案')
    if (['applied', 'cancelled', 'completed'].includes(task.status)) fail(409, '任务已结束，不能继续执行')
    const other = (await allTasks(root)).find((entry) => entry.id !== task.id && entry.status === 'running')
    if (other) fail(409, '另一个改写任务正在执行')
    if (task.status !== 'running' || action !== 'start') for (const chapter of task.chapters) if (['processing', 'failed'].includes(chapter.status)) { chapter.status = 'pending'; delete chapter.claimToken }
    task.status = 'running'; task.ownerPid = process.pid; task.ownerSessionId = args.sessionId || task.ownerSessionId || null; task.interrupted = false; task.error = ''
  } else if (action === 'pause') {
    if (!['running', 'failed', 'paused'].includes(task.status)) fail(409, '当前任务不能暂停')
    task.status = 'paused'
    for (const chapter of task.chapters) if (chapter.status === 'processing') { chapter.status = 'pending'; delete chapter.claimToken }
  } else if (action === 'cancel') {
    if (task.status === 'applied') fail(409, '已采用的任务请通过版本回退恢复')
    task.status = 'cancelled'
    for (const chapter of task.chapters) delete chapter.claimToken
  }
  task.cursor = nextPending(task)?.n ?? null
  await persistTask(root, task)
  return { ok: true, task }
}

async function inputFor(root, task, chapterNumber) {
  const original = join(root, 'story/rewrites', task.id, 'original')
  const candidate = candidateRoot(root, task.id)
  const row = task.chapters.find((entry) => entry.n === Number(chapterNumber))
  if (!row) fail(404, '改写章节不存在')
  const chapter = await chapterAt(original, row.n, row.file)
  if (chapter.hash !== row.sourceHash) fail(409, '冻结的原稿被修改，请重新建立改写版本')
  const prefix = []
  const prior = task.chapters.filter((item) => item.n < chapter.n && ['passed', 'kept'].includes(item.status))
  const recent = prior.slice(-8)
  for (const [index, entry] of recent.entries()) {
    const source = index >= recent.length - 2 ? await chapterAt(candidate, entry.n, entry.file) : null
    const summary = await readBytes(candidate, `story/summaries/${padChapter(entry.n)}.md`)
    prefix.push({ n: entry.n, title: source?.title || entry.title, content: source ? source.content.slice(-8000) : '', summary: summary ? summary.toString('utf8') : '', status: entry.status })
  }
  const referenceAnalysis = await readJson(root, `story/rewrites/${task.id}/reference-analysis.json`)
  const candidateMaterials = task.materialsCheckpoint ? await readJson(root, `story/rewrites/${task.id}/materials.json`, {}) : { characters: [], worldRules: [], timeline: [], foreshadows: [], relationships: [], source: 'empty' }
  return {
    task,
    chapter: { n: chapter.n, title: chapter.title, content: chapter.content, sourceHash: chapter.hash }, prefix,
    prefixCoverage: { from: prior[0]?.n ?? null, to: prior.at(-1)?.n ?? null, totalChapters: prior.length, returnedChapters: recent.length, truncated: prior.length > recent.length },
    analysis: referenceAnalysis ? { summary: referenceAnalysis.summary || '', chapters: referenceAnalysis.chapters.filter((item) => Number(item.n ?? item.chapter) <= chapter.n), source: 'original-reference' } : null,
    referenceAnalysis: referenceAnalysis ? { ...referenceAnalysis, source: 'original-reference-do-not-treat-as-revised-facts' } : null,
    candidateMaterials: { ...candidateMaterials, source: task.materialsCheckpoint ? 'revised-prefix' : 'empty' },
  }
}
export async function getRewriteInput(root, rewriteId, chapter) {
  return await withRoot(root, async (actual) => inputFor(actual, await rawTask(actual, rewriteId), chapter), false)
}
async function claimChapter(root, args) {
  const task = await rawTask(root, args.rewriteId)
  if (task.status !== 'running') fail(409, '改写任务未在执行，不能领取章节')
  const next = nextPending(task)
  if (!next) return { ok: true, task, finished: true }
  if (Number(args.chapter ?? next.n) !== next.n) fail(409, `必须先完成第 ${next.n} 章`)
  if (next.status === 'processing') fail(409, '该章节已被领取，请等待或恢复任务')
  next.status = 'processing'; next.claimToken = randomUUID(); next.startedAt = now(); task.cursor = next.n
  await persistTask(root, task)
  return { ok: true, task, claimToken: next.claimToken, input: await inputFor(root, task, next.n) }
}
async function saveCandidate(root, args) {
  const task = await rawTask(root, args.rewriteId)
  const next = nextPending(task)
  if (task.status !== 'running' || !next || Number(args.chapter) !== next.n || next.status !== 'processing' || args.claimToken !== next.claimToken) fail(409, '章节提交已过期、任务已暂停或未按顺序领取')
  if (args.expectedHash && args.expectedHash !== next.sourceHash) fail(409, '章节原稿版本不匹配')
  const original = await chapterAt(join(root, 'story/rewrites', task.id, 'original'), next.n, next.file)
  const content = typeof args.content === 'string' ? args.content : next.change === 'rewrite' ? '' : original.content
  if (!content.trim() || Buffer.byteLength(content) > MAX_BYTES) fail(400, '候选正文为空或超限')
  if (next.change !== 'rewrite' && sha(Buffer.from(content)) !== original.hash) fail(400, '保留或检查章节不能修改正文，请先调整改写方案范围')
  if (!args.review || typeof args.review.passed !== 'boolean' || !String(args.review.notes || '').trim()) fail(400, '必须提交明确的审阅结果与说明')
  const candidate = candidateRoot(root, task.id)
  await atomic(candidate, `story/drafts/${padChapter(next.n)}.md`, content)
  await json(root, `story/rewrites/${task.id}/reviews/${padChapter(next.n)}.json`, { ...args.review, at: now(), contentHash: sha(content) })
  await atomic(candidate, `story/reviews/${padChapter(next.n)}.md`, `# 第 ${next.n} 章改写审阅\n\n${args.review.passed ? '通过' : '未通过'}\n\n${args.review.notes}\n`)
  if (!args.review.passed) {
    next.status = 'failed'; delete next.claimToken; task.status = 'failed'; task.error = String(args.review.notes); await persistTask(root, task)
    return { ok: true, task, accepted: false }
  }
  const summary = String(args.summary || '').trim()
  if (!summary) fail(400, '通过审阅后必须保存本章摘要')
  materialObject(args.materials, true)
  for (const event of args.materials.timeline) if (Number(event.chapter) > next.n) fail(400, '逐章新版资料不能将尚未完成的后文当成已发生事实')
  await atomic(candidate, original.file, content)
  await atomic(candidate, `story/polished/${padChapter(next.n)}.md`, content)
  await atomic(candidate, `story/summaries/${padChapter(next.n)}.md`, `# 第 ${next.n} 章摘要\n\n${summary}\n`)
  if (args.materials) {
    await writeMaterials(candidate, args.materials)
    await json(root, `story/rewrites/${task.id}/materials.json`, args.materials)
    task.materialsCheckpoint = next.n
  }
  next.status = 'passed'; next.summary = summary; next.review = clone(args.review); next.candidateHash = sha(content); next.completedAt = now(); next.chars = countChars(content); next.title = /^\s*#\s+(.+)$/m.exec(content)?.[1]?.trim() || next.title; delete next.claimToken
  task.cursor = task.chapters.find((chapter) => !['passed', 'kept'].includes(chapter.status))?.n ?? null
  task.error = ''; task.materialsReady = false
  await persistTask(root, task)
  return { ok: true, task, accepted: true, needsFinalize: task.cursor === null }
}
async function validateCandidate(project) {
  const chapters = await chaptersAt(project)
  if (!chapters.length) fail(422, '候选项目没有完整正文')
  const numbers = new Set(chapters.map((chapter) => chapter.n))
  for (const [key, rel] of Object.entries(MATERIAL_PATHS)) {
    const bytes = await readBytes(project, rel)
    if (bytes === undefined) { if (key !== 'layeredOutline') fail(422, `候选项目缺少资料：${rel}`); continue }
    if (['premise', 'style'].includes(key)) continue
    if (key === 'timeline') {
      for (const line of bytes.toString('utf8').split(/\r?\n/).filter((value) => value.trim())) {
        let event; try { event = JSON.parse(line) } catch { fail(422, '新版时间线含无效 JSON 行') }
        if (!event || typeof event !== 'object' || (event.chapter !== undefined && !numbers.has(Number(event.chapter)))) fail(422, '新版时间线引用不存在的章节')
      }
    } else {
      const value = await readJson(project, rel)
      if (ARRAY_MATERIALS.includes(key) && !Array.isArray(value)) fail(422, `候选资料格式错误：${rel}`)
      if (key === 'foreshadows') for (const entry of value) for (const chapter of entry.chapters || []) if (!numbers.has(Number(chapter))) fail(422, '新版伏笔引用不存在的章节')
    }
  }
  for (const chapter of chapters) if (!(await readBytes(project, `story/summaries/${padChapter(chapter.n)}.md`))?.toString('utf8').trim()) fail(422, `新版缺少第 ${chapter.n} 章摘要`)
  return chapters
}
async function finalize(root, args) {
  const task = await rawTask(root, args.rewriteId)
  if (!['running', 'completed'].includes(task.status)) fail(409, '当前任务不能完成验收')
  if (nextPending(task)) fail(409, '仍有章节未通过审阅，不能完成改写')
  if (!args.review || args.review.passed !== true || !String(args.review.notes || '').trim()) fail(400, '完成改写需要全稿一致性审阅通过并附说明')
  const candidate = candidateRoot(root, task.id)
  if (fingerprint(await managedFiles(join(root, 'story/rewrites', task.id, 'original'))) !== task.originalHash) fail(409, '冻结的原稿版本已被修改')
  const materials = args.materials || await readJson(root, `story/rewrites/${task.id}/materials.json`)
  materialObject(materials, true)
  await writeMaterials(candidate, materials)
  await json(root, `story/rewrites/${task.id}/materials.json`, materials)
  const chapters = await validateCandidate(candidate)
  // 范围外及明确保留章必须逐字保持原稿，不能由模型绕过单章提交接口偷偷修改。
  for (const entry of task.chapters) {
    const actual = chapters.find((chapter) => chapter.n === entry.n)
    if (!actual) fail(422, '首版不允许增删或重排章节')
    if (entry.change !== 'rewrite' && actual.hash !== entry.sourceHash) fail(409, `第 ${entry.n} 章原文被意外修改`)
    if (entry.change === 'rewrite' && actual.hash !== entry.candidateHash) fail(409, `第 ${entry.n} 章在审阅后被修改，请重新审阅`)
  }
  if (chapters.length !== task.chapters.length) fail(422, '首版不允许增删章节')
  const progress = await readJson(candidate, 'meta/progress.json', {})
  await json(candidate, 'meta/progress.json', { ...progress, completed_chapters: chapters.map((chapter) => chapter.n), words: chapters.reduce((sum, chapter) => sum + chapter.chars, 0), phase: 'writing', updated_at: now() })
  await json(candidate, 'story/state.json', { stage: 'writing', last_chapter: chapters.at(-1).n, note: `剧情改写版本 ${task.id} 已完成`, updated_at: now() })
  task.materialsReady = true; task.status = 'completed'; task.cursor = null; task.finalReview = clone(args.review); task.completedAt = now(); task.error = ''; task.candidateProjectHash = fingerprint(await managedFiles(candidate))
  await persistTask(root, task)
  return { ok: true, task }
}
async function applyRewrite(root, args) {
  const task = await rawTask(root, args.rewriteId)
  if (task.status === 'applied') return { ok: true, task, versionId: task.versionId, unchanged: true }
  const index = await indexOf(root)
  const committed = index.versions.find((version) => version.id === index.activeVersionId && version.rewriteId === task.id && version.kind === 'rewrite')
  // 版本事务已提交但任务状态尚未来得及保存时，重试应修复状态而非再次覆盖。
  if (committed && index.currentHash === fingerprint(await managedFiles(root)) && committed.hash === task.candidateProjectHash) {
    task.status = 'applied'; task.versionId = committed.id; task.appliedAt = committed.createdAt; await persistTask(root, task)
    return { ok: true, task, versionId: committed.id, version: committed, unchanged: true }
  }
  if (task.status !== 'completed' || !task.materialsReady || nextPending(task)) fail(409, '改写章节与全稿资料尚未完成验收')
  const candidate = candidateRoot(root, task.id)
  await validateCandidate(candidate)
  const files = await managedFiles(candidate)
  if (fingerprint(files) !== task.candidateProjectHash) fail(409, '候选项目在验收后已被修改，请重新完成验收')
  const version = await installVersion(root, files, { title: task.title, kind: 'rewrite', rewriteId: task.id }, task.formalHash)
  task.status = 'applied'; task.versionId = version.id; task.appliedAt = now(); await persistTask(root, task)
  return { ok: true, task, versionId: version.id, version }
}
async function rollback(root, args) {
  let index = await indexOf(root)
  const versionId = id(args.versionId, '版本编号')
  if (!index.versions.some((version) => version.id === versionId)) fail(404, '版本不存在')
  const current = await managedFiles(root)
  if (index.activeVersionId === versionId && index.currentHash === fingerprint(current)) return { ok: true, versionId, unchanged: true }
  let preservedVersionId
  if (index.currentHash !== fingerprint(current)) {
    const preserved = await saveSnapshot(root, current, { title: '回退前修改', kind: 'manual' })
    preservedVersionId = preserved.id
    index = { ...index, activeVersionId: preserved.id, currentHash: preserved.hash, versions: [...index.versions, preserved] }
    await json(root, 'story/versions/index.json', index)
  }
  const target = await snapshotFiles(root, versionId)
  const beforeVersionId = index.activeVersionId
  const afterIndex = { ...index, activeVersionId: versionId, currentHash: target.manifest.hash }
  const journal = { id: newId('transaction'), phase: 'prepared', beforeVersionId, beforeIndex: index, afterIndex }
  await json(root, 'story/versions/transaction.json', journal)
  try {
    await replaceManaged(root, target.files)
    await json(root, 'story/versions/index.json', afterIndex)
    await json(root, 'story/versions/transaction.json', { ...journal, phase: 'committed' })
    await removeFile(root, 'story/versions/transaction.json')
  } catch (error) { await recoverTransaction(root); throw error }
  return { ok: true, versionId, version: versionMeta(target.manifest), ...(preservedVersionId ? { preservedVersionId } : {}) }
}

export async function getRevisionOverview(root) {
  return await withRoot(root, async (actual) => {
    const imports = []
    for (const entry of await listDir(actual, 'story/imports')) if (entry.isDirectory() && /^[a-z][a-z0-9-]{8,90}$/.test(entry.name)) {
      const manifest = await readJson(actual, `story/imports/${entry.name}/manifest.json`)
      if (manifest) imports.push(importSummary(manifest))
    }
    const rewrites = await allTasks(actual)
    const index = await indexOf(actual)
    return { ok: true, root: actual.replace(/\\/g, '/'), imports: imports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), rewrites: rewrites.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), versions: index.versions.slice().reverse().map(versionMeta), activeVersionId: index.activeVersionId }
  }, false)
}
export async function getRevisionComparison(root, args) {
  return await withRoot(root, async (actual) => {
    const task = await rawTask(actual, args.rewriteId)
    const n = Number(args.chapter)
    if (!Number.isSafeInteger(n) || n < 1) fail(400, '章节号必须是正整数')
    const row = task.chapters.find((chapter) => chapter.n === n)
    if (!row) fail(404, '对照章节不存在')
    const original = await chapterAt(join(actual, 'story/rewrites', task.id, 'original'), n, row.file)
    if (original.hash !== row.sourceHash) fail(409, '冻结原稿已被修改，无法可靠对照')
    const candidate = await chapterAt(candidateRoot(actual, task.id), n, row.file)
    const review = await readJson(actual, `story/rewrites/${task.id}/reviews/${padChapter(n)}.json`, null)
    const draftBytes = review && ['processing', 'failed', 'pending'].includes(row.status) ? await readBytes(candidateRoot(actual, task.id), `story/drafts/${padChapter(n)}.md`) : undefined
    const draft = draftBytes && sha(draftBytes) === review.contentHash ? draftBytes : undefined
    const candidateContent = draft ? draft.toString('utf8') : candidate?.content || ''
    return { ok: true, root: actual.replace(/\\/g, '/'), rewriteId: task.id, chapter: n, original: { title: original.title, content: original.content, chars: original.chars }, candidate: { title: candidate?.title || row.title, content: candidateContent, chars: countChars(candidateContent), status: row.status, isDraft: !!draft }, summary: row.summary || '', review }
  }, false)
}
export async function dispatchRevision(root, args = {}) {
  if (args.action === 'overview') return await getRevisionOverview(root)
  if (args.action === 'comparison') return await getRevisionComparison(root, args)
  return await withRoot(root, async (actual) => {
    switch (args.action) {
      case 'import': return await importManuscript(actual, args)
      case 'get_import': return { ok: true, import: await readImport(actual, args.importId), chapters: await getImportChapters(actual, args.importId) }
      case 'save_chapters': return await saveChapters(actual, args)
      case 'save_analysis': return await saveAnalysis(actual, args)
      case 'materialize_import': return await materializeImport(actual, args)
      case 'create_rewrite': return await createRewrite(actual, args)
      case 'status': return { ok: true, task: await interruptStaleTask(actual, await rawTask(actual, args.rewriteId)) }
      case 'save_plan': return await savePlan(actual, args)
      case 'approve_plan': case 'start': case 'resume': case 'retry': case 'pause': case 'cancel': return await taskControl(actual, args)
      case 'claim_chapter': return await claimChapter(actual, args)
      case 'save_candidate': return await saveCandidate(actual, args)
      case 'save_materials': {
        const task = await rawTask(actual, args.rewriteId)
        if (!['running', 'completed'].includes(task.status) || nextPending(task)) fail(409, '完成所有章节后才能保存全稿资料')
        materialObject(args.materials, true)
        await writeMaterials(candidateRoot(actual, task.id), args.materials)
        await json(actual, `story/rewrites/${task.id}/materials.json`, args.materials)
        task.materialsReady = false
        if (task.status === 'completed') task.status = 'running'
        await persistTask(actual, task)
        return { ok: true, task }
      }
      case 'finalize': return await finalize(actual, args)
      case 'apply': return await applyRewrite(actual, args)
      case 'rollback': return await rollback(actual, args)
      default: fail(400, `未知导入或改写操作：${String(args.action || '')}`)
    }
  })
}
