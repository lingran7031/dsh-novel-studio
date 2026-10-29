// P0 纯函数与工具定义冒烟测试（不依赖 DSH 进程）。
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { detectProject, initProject, projectStatus, projectStatus as status, splitChapters, parseJsonLines } from '../lib/core.js'
import { apply as applyTools } from '../lib/tools.js'

const root = await mkdtemp(join(tmpdir(), 'novel-studio-'))
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

try {
  const before = await detectProject(root)
  assert(before.isNovel === false, 'empty dir should not be a novel project')

  const seeded = await initProject(root, { title: '测试书', genre: '悬疑' })
  assert(seeded.created.includes('premise.md'), 'premise.md should be created')

  const after = await detectProject(root)
  assert(after.isNovel === true, 'seeded dir should be a novel project')
  assert(after.chapterCount === 0, 'chapter count should be 0')

  await writeFile(join(root, 'chapters', '001.md'), '# 第一章 起点\n\n' + '字'.repeat(500), 'utf8')
  await writeFile(join(root, 'chapters', '002.md'), '# 第二章 转折\n\n' + '字'.repeat(300), 'utf8')

  const progress = JSON.parse(await readFile(join(root, 'meta/progress.json'), 'utf8'))
  progress.completed_chapters = [1]
  await writeFile(join(root, 'meta/progress.json'), JSON.stringify(progress), 'utf8')

  const summary = await status(root)
  assert(summary.chapters.length === 2, 'two chapters')
  assert(summary.lastChapter === 2, 'last chapter is 2')
  assert(summary.nextChapter === 3, 'next chapter is 3')
  assert(summary.totalChars >= 800, `total chars should include both chapters, got ${summary.totalChars}`)
  assert(Array.isArray(summary.missing), 'missing list exists')

  const chunks = splitChapters(
    ['第一章 开端', '甲'.repeat(100), '第二章 发展', '乙'.repeat(100), '第三章 高潮', '丙'.repeat(100)].join('\n'),
    { maxChars: 150 },
  )
  assert(chunks.length === 3, `split into 3 chapters, got ${chunks.length}`)
  assert(chunks[0].title.includes('第一章'), 'first chunk keeps chapter title')

  const long = splitChapters(['第一章 很长'].join('\n') + '\n\n' + Array.from({ length: 20 }, () => '段'.repeat(100)).join('\n\n'), { maxChars: 500 })
  assert(long.length > 1, 'long chapter is split into parts')

  const lines = parseJsonLines('{"chapter":1,"event":"a"}\nbad\n{"chapter":2,"event":"b"}\n')
  assert(lines.items.length === 2 && lines.badLines.length === 1, 'jsonl parsing reports bad lines')

  const registered = []
  const fakeCtx = {
    get: () => undefined,
    tools: { register: (definition) => { registered.push(definition); return () => {} } },
  }
  applyTools(fakeCtx)
  assert(registered.length === 6, 'six tools registered')
  assert(
    registered.map((item) => item.name).join(',') === 'novel_project,novel_validate,novel_import,novel_context,novel_chapter,novel_rewrite',
    'tool names',
  )
  for (const definition of registered) {
    assert(typeof definition.description === 'string' && definition.description.length > 20, `${definition.name} description`)
    assert(definition.parameters && definition.parameters.type === 'object', `${definition.name} parameters are object schema`)
    assert(definition.output && typeof definition.output.render === 'function', `${definition.name} output render`)
    assert(typeof definition.execute === 'function', `${definition.name} execute`)
  }

  // execute 路径冒烟：novel_project detect/init/status 在临时目录上跑通
  const exec = { agent: undefined, signal: new AbortController().signal }
  const projectTool = registered[0]
  const detectResult = await projectTool.execute({ action: 'detect', path: root }, exec)
  assert(detectResult.ok === true && detectResult.isNovel === true, 'novel_project detect works')
  const statusResult = await projectTool.execute({ action: 'status', path: root }, exec)
  assert(statusResult.ok === true && statusResult.totalChars >= 800, 'novel_project status works')

  const validateTool = registered[1]
  const validateResult = await validateTool.execute({ path: root }, exec)
  assert(validateResult.ok === true, `validate should pass on seeded project: ${JSON.stringify(validateResult.errors)}`)

  // ---- P2/P3：导入 → 上下文包 → 定稿 → 摘要 → 断点 → 导出 ----
  const importTool = registered[2]
  const sample = ['第一章 雨夜', '第一段内容。'.repeat(20), '第二章 线索', '第二段内容。'.repeat(20)].join('\n')
  const importResult = await importTool.execute({ action: 'prepare', path: root, text: sample }, exec)
  assert(importResult.ok === true && importResult.chunkCount === 2, `import prepares 2 chunks, got ${importResult.chunkCount}`)
  const manifest = JSON.parse(await readFile(join(root, 'story/import/manifest.json'), 'utf8'))
  assert(manifest.chunks.length === 2 && manifest.encoding === 'inline-text', 'manifest records chunks and encoding')
  const importStatus = await importTool.execute({ action: 'status', path: root }, exec)
  assert(importStatus.ok === true && importStatus.chunkCount === 2, 'import status reads manifest')
  const materialized = await importTool.execute({ action: 'materialize', path: root, force: true }, exec)
  assert(materialized.ok === true && materialized.chapters.length === 2, 'materialize writes imported chapters')
  assert(materialized.lastChapter === 2, 'materialize updates last chapter')

  const chapterTool = registered[4]
  await writeFile(join(root, 'story/polished/001.md'), '# 第一章 雨夜\n\n打磨后的正文。', 'utf8')
  let promoteConflict = ''
  try {
    await chapterTool.execute({ action: 'promote', path: root, chapter: 1, from: 'polished' }, exec)
  } catch (error) {
    promoteConflict = String(error && error.message ? error.message : error)
  }
  assert(promoteConflict.includes('force'), 'promote refuses to overwrite a different finalized chapter without force')
  const promote = await chapterTool.execute({ action: 'promote', path: root, chapter: 1, from: 'polished', force: true }, exec)
  assert(promote.ok === true && promote.chars > 0, 'promote chapter 1 with force')
  assert(typeof promote.backup === 'string' && promote.backup.endsWith('.bak'), 'promote writes a .bak backup before overwrite')
  assert((await readFile(join(root, 'chapters/001.md'), 'utf8')).includes('打磨后的正文'), 'chapter file written')
  const repeated = await chapterTool.execute({ action: 'promote', path: root, chapter: 1, from: 'polished' }, exec)
  assert(repeated.ok === true && repeated.unchanged === true, 'promote identical content is idempotent')
  const progressAfter = JSON.parse(await readFile(join(root, 'meta/progress.json'), 'utf8'))
  assert(progressAfter.completed_chapters.includes(1), 'progress updated')

  const summaryResult = await chapterTool.execute({ action: 'summary', path: root, chapter: 1, summary: '本章摘要：雨夜命案。' }, exec)
  assert(summaryResult.ok === true, 'summary written')
  let checkpointChapterError = ''
  try {
    await chapterTool.execute({ action: 'checkpoint', path: root, stage: 'writing', chapter: 1 }, exec)
  } catch (error) {
    checkpointChapterError = String(error && error.message ? error.message : error)
  }
  assert(checkpointChapterError.includes('chapter'), 'checkpoint rejects the chapter parameter')
  const checkpoint = await chapterTool.execute({ action: 'checkpoint', path: root, stage: 'writing', note: '下一章继续' }, exec)
  assert(checkpoint.ok === true && checkpoint.state.stage === 'writing', 'checkpoint updated')

  const contextTool = registered[3]
  const pack = await contextTool.execute({ path: root, chapter: 2, role: 'writer', focus: '雨夜 线索' }, exec)
  assert(pack.ok === true && typeof pack.markdown === 'string' && pack.markdown.length > 50, 'context pack assembled')
  assert(pack.approxTokens > 0 && pack.cacheFile.includes('story/context/'), 'context pack metadata')
  assert(pack.markdown.includes('第2章上下文包'), 'context pack header')

  const exported = await chapterTool.execute({ action: 'export', path: root, title: '测试书' }, exec)
  assert(exported.ok === true && exported.chapters === 2, 'export assembles chapters')
  assert((await readFile(join(root, 'export/novel.md'), 'utf8')).startsWith('# 测试书'), 'export title')

  const exportedDocx = await chapterTool.execute({ action: 'export', path: root, title: '测试书', format: 'docx' }, exec)
  assert(exportedDocx.ok === true && exportedDocx.format === 'docx' && exportedDocx.bytes > 1000, 'docx export')
  const docxBytes = await readFile(join(root, 'export/novel.docx'))
  assert(docxBytes[0] === 0x50 && docxBytes[1] === 0x4b, 'docx is a zip package')

  // ---- P4：模式内快捷命令 ----
  const commandDefinitions = []
  const commandsPlugin = await import('../lib/commands.js')
  commandsPlugin.apply({
    get: () => undefined,
    effect: (register) => {
      register()
      return () => {}
    },
    commands: {
      register: (definition) => {
        commandDefinitions.push(definition)
        return () => {}
      },
    },
  })
  assert(commandDefinitions.length === 2, 'two novel commands registered')
  assert(commandDefinitions.map((definition) => definition.name).join(',') === 'novel-status,novel-export', 'command names')
  const previousCwd = process.cwd()
  process.chdir(root)
  try {
    const commandResult = await commandDefinitions[0].handler({
      commandId: 'test',
      agent: undefined,
      rawInput: '',
      attachments: [],
      signal: new AbortController().signal,
    })
    assert(commandResult.kind === 'success' && commandResult.text.includes('测试书'), 'novel-status command reports the project')
  } finally {
    process.chdir(previousCwd)
  }

  // ---- 技能注册：SkillDefinition 校验要求 source 是字符串，否则 skill 工具加载报错 ----
  const skillRegistrations = []
  const skillsPlugin = await import('../lib/skills.js')
  skillsPlugin.apply({
    effect: (register) => {
      register()
      return () => {}
    },
    skills: {
      register: (skill) => {
        skillRegistrations.push(skill)
        return () => {}
      },
    },
  })
  assert(skillRegistrations.length === 8, `eight skills registered, got ${skillRegistrations.length}`)
  for (const skill of skillRegistrations) {
    assert(typeof skill.source === 'string' && skill.source !== '', `skill ${skill.name} carries a string source`)
    assert(typeof skill.content === 'string' && skill.content.length > 500, `skill ${skill.name} carries its body`)
  }

  console.log(failures.length === 0 ? 'PASS: all core smoke checks' : `FAIL:\n- ${failures.join('\n- ')}`)
  process.exitCode = failures.length === 0 ? 0 : 1
} finally {
  await rm(root, { recursive: true, force: true })
}
