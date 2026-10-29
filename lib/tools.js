// dsh-novel-studio — 模型工具（preset「小说工作室」作用域）。
// 说明：本包以本地目录 link 安装，运行时解析不到 @deepseek-ai/* 宿主包，
// 因此这里用 ctx.tools.register 的原生 JSON Schema 定义 + 纯 node 内建实现，
// 不 import 任何宿主包。

import { readFile, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createRewriteTool } from './rewrite-tools.js'
import { withRevisionLock } from './revisions.js'

import {
  MATERIAL_FILES,
  buildContextPack,
  countChars,
  decodeTextBuffer,
  detectProject,
  ensureDir,
  exists,
  exportNovel,
  initProject,
  listChapterFiles,
  parseJsonLines,
  parseJsonSafe,
  projectStatus,
  promoteChapter,
  readJsonFile,
  readTextIfExists,
  splitChapters,
  splitManuscript,
  toPosix,
  writeChapterSummary,
  writeCheckpoint,
  writeIfAbsent,
  writeImportedChapters,
  writeText,
} from './core.js'

export const name = 'novel-tools'

export const inject = ['tools']

const JSON_OUTPUT = {
  schema: {},
  render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
}

async function workspaceRoot(ctx, exec) {
  const workingDirectory = ctx.get('workingDirectory')
  if (workingDirectory !== undefined && exec.agent !== undefined) {
    try {
      return await workingDirectory.ensure(exec.agent, exec.signal)
    } catch {
      /* fall through */
    }
  }
  return process.cwd()
}

async function projectRootOf(ctx, exec, explicit) {
  const base = await workspaceRoot(ctx, exec)
  const raw = typeof explicit === 'string' ? explicit.trim() : ''
  return raw === '' ? base : resolve(base, raw)
}

function stringArg(args, key) {
  const value = args[key]
  return typeof value === 'string' ? value.trim() : ''
}

function numberArg(args, key) {
  const value = args[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

// ---------------------------------------------------------------- novel_project

function projectTool(ctx) {
  return {
    name: 'novel_project',
    description:
      '小说项目工具。action=detect 检查当前工作目录（或 path）是否已有小说项目；action=init 创建写作目录骨架与空资料文件（只补缺失，不覆盖已有内容）；action=status 汇总章节、字数、进度、摘要/裁定数量与缺失资料。返回结构化 JSON。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['detect', 'init', 'status'],
          description: 'detect 检查项目；init 初始化目录；status 查看进度。',
        },
        path: { type: 'string', description: '小说项目目录；缺省为当前会话工作目录。相对路径按工作目录解析。' },
        title: { type: 'string', description: 'init 时的暂定书名（可选）。' },
        genre: { type: 'string', description: 'init 时的题材/类型（可选）。' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: JSON_OUTPUT,
    async execute(args, exec) {
      const action = stringArg(args, 'action')
      if (action === '') throw new Error('novel_project: action 不能为空，可选 detect / init / status')
      const root = await projectRootOf(ctx, exec, args.path)

      if (action === 'detect') {
        const detected = await detectProject(root)
        return { ok: true, ...detected }
      }

      if (action === 'init') {
        const detected = await detectProject(root)
        const seeded = await initProject(root, { title: stringArg(args, 'title'), genre: stringArg(args, 'genre') })
        return {
          ok: true,
          root,
          alreadyNovel: detected.isNovel,
          createdFiles: seeded.created,
          createdDirs: seeded.dirs,
        }
      }

      if (action === 'status') {
        return { ok: true, ...(await projectStatus(root)) }
      }

      throw new Error(`novel_project: 未知 action "${action}"，可选 detect / init / status`)
    },
  }
}

// --------------------------------------------------------------- novel_validate

function chapterNumberFromFile(file) {
  const match = /^0*(\d+)/.exec(file)
  return match === null ? undefined : Number(match[1])
}

async function loadArrayFile(root, rel, key) {
  const text = await readTextIfExists(join(root, rel))
  if (text === undefined) return { missing: true, rel, key, items: [] }
  const parsed = parseJsonSafe(text)
  if (!parsed.ok) return { missing: false, rel, key, parseError: parsed.error, items: [] }
  if (!Array.isArray(parsed.value)) return { missing: false, rel, key, shapeError: `应为 JSON 数组，实际是 ${typeof parsed.value}`, items: [] }
  return { missing: false, rel, key, items: parsed.value }
}

function validateTool(ctx) {
  return {
    name: 'novel_validate',
    description:
      '校验小说资料库：JSON 可解析与字段形状、人物/关系/伏笔引用、时间线、章节编号连续性、进度与正文章节一致、摘要覆盖。返回 errors（需修复）与 warnings（建议修复）清单，用于编辑审阅前的确定性体检。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '小说项目目录；缺省为当前会话工作目录。' },
        maxItems: {
          type: 'number',
          description: '每类问题最多返回多少条，默认 40。',
        },
      },
      additionalProperties: false,
    },
    output: JSON_OUTPUT,
    async execute(args, exec) {
      const root = await projectRootOf(ctx, exec, args.path)
      const maxItems = Math.min(Math.max(numberArg(args, 'maxItems') ?? 40, 1), 200)
      const errors = []
      const warnings = []
      const push = (list, message, extra) => list.push(extra === undefined ? message : { message, ...extra })

      const chapterFiles = await listChapterFiles(root)
      const chapterNumbers = new Set(chapterFiles.map((item) => item.n))
      const maxChapter = chapterFiles.length > 0 ? chapterFiles[chapterFiles.length - 1].n : 0

      const characters = await loadArrayFile(root, MATERIAL_FILES.characters, 'characters')
      const worldRules = await loadArrayFile(root, MATERIAL_FILES.worldRules, 'worldRules')
      const foreshadow = await loadArrayFile(root, MATERIAL_FILES.foreshadow, 'foreshadow')
      const relationships = await loadArrayFile(root, MATERIAL_FILES.relationships, 'relationships')

      const outlineText = await readTextIfExists(join(root, MATERIAL_FILES.outline))
      if (outlineText === undefined) {
        push(warnings, `缺少大纲文件 ${MATERIAL_FILES.outline}（或使用 layered_outline.json）`, { file: MATERIAL_FILES.outline })
      } else {
        const parsedOutline = parseJsonSafe(outlineText)
        if (!parsedOutline.ok) {
          push(errors, `${MATERIAL_FILES.outline} 不是合法 JSON：${parsedOutline.error}`, { file: MATERIAL_FILES.outline })
        } else if (!Array.isArray(parsedOutline.value) && (parsedOutline.value === null || typeof parsedOutline.value !== 'object')) {
          push(errors, `${MATERIAL_FILES.outline} 应为 JSON 数组（简版）或对象（分层大纲）`, { file: MATERIAL_FILES.outline })
        }
      }

      for (const file of [characters, worldRules, foreshadow, relationships]) {
        if (file.missing) push(warnings, `缺少资料文件 ${file.rel}`, { file: file.rel })
        if (file.parseError !== undefined) push(errors, `${file.rel} 不是合法 JSON：${file.parseError}`, { file: file.rel })
        if (file.shapeError !== undefined) push(errors, `${file.rel} ${file.shapeError}`, { file: file.rel })
      }

      const knownCharacters = new Set()
      const characterNameCounts = new Map()
      for (const item of characters.items) {
        if (typeof item !== 'object' || item === null) {
          push(errors, 'characters.json 中存在非对象条目', { file: MATERIAL_FILES.characters })
          continue
        }
        const characterName = typeof item.name === 'string' ? item.name.trim() : ''
        if (characterName === '') push(errors, 'characters.json 存在缺少 name 的人物条目', { file: MATERIAL_FILES.characters })
        else {
          knownCharacters.add(characterName)
          characterNameCounts.set(characterName, (characterNameCounts.get(characterName) ?? 0) + 1)
        }
      }
      for (const [characterName, count] of characterNameCounts) {
        if (count > 1) push(warnings, `人物重名：${characterName}（出现 ${count} 次）`, { file: MATERIAL_FILES.characters })
      }

      for (const item of worldRules.items) {
        if (typeof item !== 'object' || item === null) {
          push(errors, 'world_rules.json 中存在非对象条目', { file: MATERIAL_FILES.worldRules })
          continue
        }
        const name = typeof item.name === 'string' ? item.name.trim() : ''
        if (name === '') push(errors, 'world_rules.json 存在缺少 name 的规则', { file: MATERIAL_FILES.worldRules })
      }

      for (const item of foreshadow.items) {
        if (typeof item !== 'object' || item === null) {
          push(errors, 'foreshadow_ledger.json 中存在非对象条目', { file: MATERIAL_FILES.foreshadow })
          continue
        }
        const id = item.id === undefined || item.id === null ? '' : String(item.id)
        if (id === '') push(warnings, '伏笔条目缺少 id（建议补唯一编号）', { file: MATERIAL_FILES.foreshadow })
        const refs = Array.isArray(item.chapters) ? item.chapters : []
        for (const ref of refs) {
          const chapterNumber = Number(ref)
          if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
            push(warnings, `伏笔 ${id || '(无 id)'} 的章节引用不是正整数：${String(ref)}`, { file: MATERIAL_FILES.foreshadow })
          } else if (chapterNumber > maxChapter) {
            push(warnings, `伏笔 ${id || '(无 id)'} 引用了尚未写到的第 ${chapterNumber} 章`, { file: MATERIAL_FILES.foreshadow })
          }
        }
      }

      for (const item of relationships.items) {
        if (typeof item !== 'object' || item === null) {
          push(errors, 'relationship_state.json 中存在非对象条目', { file: MATERIAL_FILES.relationships })
          continue
        }
        const a = typeof item.character_a === 'string' ? item.character_a.trim() : ''
        const b = typeof item.character_b === 'string' ? item.character_b.trim() : ''
        if (a === '' || b === '') push(errors, '关系条目缺少 character_a / character_b', { file: MATERIAL_FILES.relationships })
        for (const name of [a, b]) {
          if (name !== '' && knownCharacters.size > 0 && !knownCharacters.has(name)) {
            push(warnings, `关系引用了人物档案中不存在的人物：${name}`, { file: MATERIAL_FILES.relationships })
          }
        }
      }

      const timelineText = await readTextIfExists(join(root, MATERIAL_FILES.timeline))
      if (timelineText !== undefined) {
        const parsedLines = parseJsonLines(timelineText)
        for (const bad of parsedLines.badLines.slice(0, maxItems)) {
          push(errors, `timeline.jsonl 第 ${bad.line} 行不是合法 JSON：${bad.error}`, { file: MATERIAL_FILES.timeline })
        }
        for (const event of parsedLines.items) {
          if (typeof event !== 'object' || event === null) {
            push(warnings, 'timeline.jsonl 存在非对象条目', { file: MATERIAL_FILES.timeline })
            continue
          }
          if (typeof event.event !== 'string' || event.event.trim() === '') {
            push(warnings, 'timeline 条目缺少 event 文本', { file: MATERIAL_FILES.timeline })
          }
          const chapterNumber = Number(event.chapter)
          if (event.chapter !== undefined && (!Number.isInteger(chapterNumber) || chapterNumber < 1)) {
            push(warnings, `timeline 条目的 chapter 不是正整数：${String(event.chapter)}`, { file: MATERIAL_FILES.timeline })
          } else if (Number.isInteger(chapterNumber) && chapterNumber > maxChapter) {
            push(warnings, `timeline 条目引用了尚未写到的第 ${chapterNumber} 章`, { file: MATERIAL_FILES.timeline })
          }
        }
      } else {
        push(warnings, `缺少时间线文件 ${MATERIAL_FILES.timeline}`, { file: MATERIAL_FILES.timeline })
      }

      // 章节编号连续性
      for (let index = 1; index < chapterFiles.length; index += 1) {
        const prev = chapterFiles[index - 1].n
        const current = chapterFiles[index].n
        if (current !== prev + 1 && current !== prev) {
          push(warnings, `章节编号不连续：${prev} → ${current}`, { file: 'chapters' })
          break
        }
      }

      // 进度与正文章节
      const progressText = await readTextIfExists(join(root, MATERIAL_FILES.progress))
      let completed = []
      if (progressText === undefined) {
        push(warnings, `缺少进度文件 ${MATERIAL_FILES.progress}`, { file: MATERIAL_FILES.progress })
      } else {
        const parsed = parseJsonSafe(progressText)
        if (!parsed.ok) push(errors, `${MATERIAL_FILES.progress} 不是合法 JSON：${parsed.error}`, { file: MATERIAL_FILES.progress })
        else if (typeof parsed.value !== 'object' || parsed.value === null) push(errors, `${MATERIAL_FILES.progress} 应为 JSON 对象`, { file: MATERIAL_FILES.progress })
        else {
          const list = Array.isArray(parsed.value.completed_chapters) ? parsed.value.completed_chapters : []
          completed = list.map((value) => Number(value)).filter((value) => Number.isInteger(value))
          for (const chapterNumber of completed) {
            if (!chapterNumbers.has(chapterNumber)) {
              push(errors, `进度记录完成第 ${chapterNumber} 章，但 chapters/ 下没有对应文件`, { file: MATERIAL_FILES.progress })
            }
          }
          for (const chapterNumber of [...chapterNumbers].sort((a, b) => a - b)) {
            if (!completed.includes(chapterNumber)) {
              push(warnings, `第 ${chapterNumber} 章有正文但未记入进度`, { file: MATERIAL_FILES.progress })
            }
          }
        }
      }

      // 摘要覆盖
      let summaryFiles = []
      try {
        const { readdir } = await import('node:fs/promises')
        const entries = await readdir(join(root, 'story/summaries'), { withFileTypes: true })
        summaryFiles = entries.filter((entry) => entry.isFile() && /\.md$/i.test(entry.name)).map((entry) => chapterNumberFromFile(entry.name))
      } catch {
        summaryFiles = []
      }
      for (const chapterNumber of completed) {
        if (!summaryFiles.includes(chapterNumber)) {
          push(warnings, `第 ${chapterNumber} 章缺少章节摘要（story/summaries/）`, { file: 'story/summaries' })
        }
      }

      const stateText = await readTextIfExists(join(root, MATERIAL_FILES.state))
      if (stateText !== undefined) {
        const parsed = parseJsonSafe(stateText)
        if (!parsed.ok) push(errors, `${MATERIAL_FILES.state} 不是合法 JSON：${parsed.error}`, { file: MATERIAL_FILES.state })
      }

      if (!(await detectProject(root)).isNovel) {
        push(errors, `当前目录不是小说项目：${root}`, { file: root })
      }

      const slice = (list) => list.slice(0, maxItems)
      return {
        ok: errors.length === 0,
        root,
        errors: slice(errors),
        warnings: slice(warnings),
        counts: {
          errors: errors.length,
          warnings: warnings.length,
          chapters: chapterFiles.length,
          completed: completed.length,
          characters: characters.items.length,
          worldRules: worldRules.items.length,
          foreshadow: foreshadow.items.length,
          relationships: relationships.items.length,
          summaries: summaryFiles.filter((value) => value !== undefined).length,
          maxChapter,
        },
      }
    },
  }
}

// ---------------------------------------------------------------- novel_import

function importTool(ctx) {
  return {
    name: 'novel_import',
    description:
      '半成品导入工具。action=prepare：读取半成品小说（source 文件或内联 text），自动识别 UTF-8/GB18030 编码，按「第N章 / Chapter N / 卷N」标题切章、超长章节按段落切块，写入 story/import/chunks/、chapters.json 与 manifest.json，并生成分析报告模板；返回紧凑清单（不返回全文）。action=status：读取已导入清单摘要。action=materialize：用户确认后把既有章节归位为 chapters/NNN.md，并把进度标为已导入（已有 chapters 需 force=true）。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['prepare', 'status', 'materialize'] },
        path: { type: 'string', description: '小说项目目录；缺省为当前会话工作目录。' },
        source: { type: 'string', description: '半成品文件路径（相对项目根或绝对路径）；prepare 时与 text 二选一。' },
        text: { type: 'string', description: '直接传入的半成品文本（适合短篇/片段）；prepare 时优先于 source。' },
        maxChars: { type: 'number', description: '单块最大字符数，默认 12000，范围 2000–40000。' },
        force: { type: 'boolean', description: 'materialize 时允许覆盖已有 chapters/ 内容，默认 false。' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: JSON_OUTPUT,
    async execute(args, exec) {
      const action = stringArg(args, 'action')
      const root = await projectRootOf(ctx, exec, args.path)

      if (action === 'status') {
        const manifest = await readJsonFile(root, 'story/import/manifest.json', undefined)
        if (manifest === undefined) return { ok: false, root, error: '尚未导入半成品：story/import/manifest.json 不存在' }
        return {
          ok: true,
          root,
          source: manifest.source,
          encoding: manifest.encoding,
          chunkCount: Array.isArray(manifest.chunks) ? manifest.chunks.length : 0,
          chapterCount: manifest.chapterCount ?? (Array.isArray(manifest.chapters) ? manifest.chapters.length : 0),
          detection: manifest.detection,
          totalChars: manifest.totalChars ?? 0,
          createdAt: manifest.createdAt,
          manifestFile: 'story/import/manifest.json',
          chaptersFile: 'story/import/chapters.json',
        }
      }
      if (action === 'materialize') {
        const sourcePath = join(root, 'story/import/source.txt')
        let sourceText
        try {
          sourceText = await readFile(sourcePath, 'utf8')
        } catch {
          throw new Error('尚未导入源文件：先执行 novel_import action="prepare"')
        }
        const manuscript = splitManuscript(sourceText)
        const result = await writeImportedChapters(root, manuscript.chapters, { force: args.force === true })
        return {
          ok: true,
          root,
          detection: manuscript.mode,
          ...result,
          hint: '既有章节已归位到 chapters/；接下来让 Architect 归档资料、Editor 回查冲突、Arbiter 裁定，再进入续写',
        }
      }
      if (action !== 'prepare') throw new Error(`novel_import: 未知 action "${action}"，可选 prepare / status / materialize`)

      const detected = await detectProject(root)
      if (!detected.isNovel) throw new Error('当前目录还不是小说项目：先调 novel_project init 建目录骨架')

      const maxChars = Math.min(Math.max(numberArg(args, 'maxChars') ?? 12000, 2000), 40000)
      const inlineText = typeof args.text === 'string' ? args.text : ''
      const sourceArg = stringArg(args, 'source')
      let text = ''
      let encoding = ''
      let sourceLabel = ''

      if (inlineText.trim() !== '') {
        text = inlineText
        encoding = 'inline-text'
        sourceLabel = '（对话内联文本）'
      } else if (sourceArg !== '') {
        const absolute = resolve(root, sourceArg)
        let buffer
        try {
          buffer = await readFile(absolute)
        } catch (error) {
          throw new Error(`读取半成品文件失败：${absolute}：${error && error.message ? error.message : error}`)
        }
        const decoded = decodeTextBuffer(buffer)
        text = decoded.text
        encoding = decoded.encoding
        sourceLabel = toPosix(sourceArg)
      } else {
        throw new Error('novel_import prepare 需要 source（文件路径）或 text（内联文本）之一')
      }
      if (text.trim() === '') throw new Error('半成品内容为空')

      const chunks = splitChapters(text, { maxChars })
      if (chunks.length === 0) throw new Error('切章后没有内容；请检查源文件')
      const manuscript = splitManuscript(text)
      const chapterRecords = manuscript.chapters.map((chapter) => ({
        index: chapter.index,
        title: chapter.title,
        chars: chapter.chars,
      }))

      const sourceFile = join(root, 'story/import/source.txt')
      await writeText(sourceFile, text)

      const chunkDir = join(root, 'story/import/chunks')
      await ensureDir(chunkDir)
      const chunkRecords = []
      for (const chunk of chunks) {
        const file = `${String(chunk.index).padStart(4, '0')}.md`
        const header = `<!-- chunk ${file} · ${chunk.title || '未命名'} · ${chunk.chars} 字 -->\n\n`
        await writeText(join(chunkDir, file), `${header}${chunk.text}\n`)
        chunkRecords.push({ index: chunk.index, title: chunk.title, chars: chunk.chars, file: `story/import/chunks/${file}` })
      }
      // 清掉上一次导入留下的过期块，避免新旧 chunk 混用
      const written = new Set(chunkRecords.map((record) => record.file.split('/').pop()))
      try {
        const entries = await readdir(chunkDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile() || !/^\d{4}\.md$/.test(entry.name)) continue
          if (!written.has(entry.name)) await rm(join(chunkDir, entry.name), { force: true })
        }
      } catch {
        /* chunk dir missing is handled by writeText above */
      }

      const manifest = {
        version: 1,
        createdAt: new Date().toISOString(),
        source: sourceLabel,
        encoding,
        maxChars,
        detection: manuscript.mode,
        totalChars: countChars(text),
        chapterCount: chapterRecords.length,
        chunks: chunkRecords,
        chunkCount: chunkRecords.length,
      }
      await writeText(join(root, 'story/import/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
      await writeText(
        join(root, 'story/import/chapters.json'),
        `${JSON.stringify({ mode: manuscript.mode, createdAt: manifest.createdAt, chapters: chapterRecords }, null, 2)}\n`,
      )

      await writeIfAbsent(
        join(root, 'story/import/report.md'),
        `# 半成品分析报告\n\n> 由分析子代理与四位角色共同填写；每条结论请标注 chunk/章节出处。\n\n## 概览\n\n- 书名/来源：\n- 现有体量：\n- 当前进度与断点：\n\n## 人物档案\n\n## 世界观与规则\n\n## 时间线\n\n## 伏笔与未解线\n\n## 文风样本\n\n## 疑似矛盾\n\n## 续写建议\n`,
      )

      return {
        ok: true,
        root,
        source: sourceLabel,
        encoding,
        manifestFile: 'story/import/manifest.json',
        sourceFile: 'story/import/source.txt',
        reportFile: 'story/import/report.md',
        detection: manuscript.mode,
        chapterCount: chapterRecords.length,
        chunkCount: chunkRecords.length,
        totalChars: manifest.totalChars,
        chunks: chunkRecords.slice(0, 200),
        truncated: chunkRecords.length > 200,
      }
    },
  }
}

// ---------------------------------------------------------------- novel_context

function contextTool(ctx) {
  return {
    name: 'novel_context',
    description:
      '组装某一章的有界上下文包：故事前提、当前大纲目标、最近两章摘要、上一章结尾、文风卡、相关人物/世界规则、未回收伏笔、近期裁定与时间线。写正文或审阅前先调用，避免通读全书。返回 markdown、近似 token 数与缓存文件路径。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '小说项目目录；缺省为当前会话工作目录。' },
        chapter: { type: 'number', description: '目标章节号（正整数）；可以是还没写的下一章。' },
        role: {
          type: 'string',
          enum: ['writer', 'editor', 'arbiter', 'architect'],
          description: '调用角色，影响上下文取舍，默认 writer。',
        },
        budgetTokens: { type: 'number', description: '近似 token 预算，默认 5000。' },
        focus: { type: 'string', description: '可选的本章关注点（章节计划节选、人名、线索），用于相关性筛选。' },
      },
      required: ['chapter'],
      additionalProperties: false,
    },
    output: JSON_OUTPUT,
    async execute(args, exec) {
      const chapter = numberArg(args, 'chapter')
      if (!Number.isInteger(chapter) || chapter < 1) throw new Error('novel_context: chapter 必须是正整数')
      const root = await projectRootOf(ctx, exec, args.path)
      const pack = await buildContextPack(root, chapter, {
        role: stringArg(args, 'role') || 'writer',
        budgetTokens: numberArg(args, 'budgetTokens') ?? 5000,
        focus: typeof args.focus === 'string' ? args.focus : '',
      })
      return { ok: true, root, ...pack }
    },
  }
}

// ---------------------------------------------------------------- novel_chapter

function chapterTool(ctx) {
  return {
    name: 'novel_chapter',
    description:
      '章节定稿与记录工具。action=promote 把打磨稿/初稿提升为 chapters/NNN.md 并更新进度与创作状态；若目标定稿已存在且内容不同，默认拒绝覆盖，需 force=true（覆盖前自动写 .bak 备份），内容一致则幂等跳过。action=summary 写入章节摘要；action=checkpoint 更新阶段/断点（只用 stage/note，不接受 chapter）；action=export 把全部章节导出为 export/novel.md（默认）或 export/novel.docx（format="docx"）。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['promote', 'summary', 'checkpoint', 'export'] },
        path: { type: 'string', description: '小说项目目录；缺省为当前会话工作目录。' },
        chapter: { type: 'number', description: '章节号；promote / summary 必填。' },
        from: { type: 'string', enum: ['polished', 'draft'], description: 'promote 的来源，默认 polished（缺失时自动回退 draft）。' },
        force: {
          type: 'boolean',
          description: 'promote 时若 chapters/NNN.md 已存在且内容不同，需为 true 才允许覆盖；覆盖前会自动写 chapters/NNN.md.bak 备份。',
        },
        title: { type: 'string', description: 'promote 时可选章节标题（正文缺标题时补）或 export 的书名。' },
        summary: { type: 'string', description: 'summary 动作的摘要正文（markdown，建议 ≤800 字）。' },
        stage: { type: 'string', description: 'checkpoint 的阶段名，如 setup / blueprint / writing / importing / paused。' },
        note: { type: 'string', description: 'checkpoint 的备注（断点续跑提示）。' },
        format: { type: 'string', enum: ['md', 'docx'], description: 'export 的格式，默认 md；docx 生成 export/novel.docx。' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: JSON_OUTPUT,
    async execute(args, exec) {
      const action = stringArg(args, 'action')
      const root = await projectRootOf(ctx, exec, args.path)

      if (action === 'promote') {
        const chapter = numberArg(args, 'chapter')
        if (!Number.isInteger(chapter) || chapter < 1) throw new Error('novel_chapter promote: chapter 必须是正整数')
        const result = await promoteChapter(root, {
          chapter,
          from: stringArg(args, 'from') || 'polished',
          title: stringArg(args, 'title'),
          force: args.force === true,
        })
        return {
          ok: true,
          root,
          ...result,
          hint: '定稿后：让 Architect 更新资料库（时间线/伏笔/关系/指南针/摘要），再调 novel_validate 体检',
        }
      }
      if (action === 'summary') {
        const chapter = numberArg(args, 'chapter')
        if (!Number.isInteger(chapter) || chapter < 1) throw new Error('novel_chapter summary: chapter 必须是正整数')
        const summary = typeof args.summary === 'string' ? args.summary : ''
        const result = await writeChapterSummary(root, chapter, summary)
        return { ok: true, root, ...result }
      }
      if (action === 'checkpoint') {
        if (numberArg(args, 'chapter') !== undefined) {
          throw new Error('novel_chapter checkpoint 不使用 chapter 参数：阶段用 stage，断点说明用 note')
        }
        const state = await writeCheckpoint(root, {
          stage: stringArg(args, 'stage'),
          note: typeof args.note === 'string' ? args.note : '',
        })
        return { ok: true, root, state, stateFile: 'story/state.json' }
      }
      if (action === 'export') {
        const result = await exportNovel(root, { title: stringArg(args, 'title'), format: stringArg(args, 'format') || 'md' })
        return { ok: true, root, ...result }
      }
      throw new Error(`novel_chapter: 未知 action "${action}"，可选 promote / summary / checkpoint / export`)
    },
  }
}

// -------------------------------------------------------------------- 注册

export function apply(ctx) {
  // 普通创作与版本采用共用项目锁，读操作也不会观察到跨版本的文件组合。
  const registerLegacy = (definition) => {
    const execute = definition.execute
    ctx.tools.register({ ...definition, async execute(args, exec = {}) {
      const root = await projectRootOf(ctx, exec, args.path)
      const run = (actual = root) => {
        if (exec.signal?.aborted) throw new Error('当前会话已取消')
        return execute({ ...args, path: actual }, exec)
      }
      if (definition.name === 'novel_project' && args.action === 'detect' && !(await exists(root))) return run()
      return withRevisionLock(root, run, { create: definition.name === 'novel_project' && args.action === 'init' })
    } })
  }
  registerLegacy(projectTool(ctx))
  registerLegacy(validateTool(ctx))
  registerLegacy(importTool(ctx))
  registerLegacy(contextTool(ctx))
  registerLegacy(chapterTool(ctx))
  ctx.tools.register(createRewriteTool(ctx, projectRootOf, JSON_OUTPUT))
}
