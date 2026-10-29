// dsh-novel-studio — 端到端验收脚本（独立验收者编写；只读 lib/，不修改插件实现）。
//
// 覆盖场景：半成品导入 → 资料归档 → 资料体检 → 第 7 章上下文包 → 打磨稿定稿
//          → 再体检 → 整本导出。
// 运行：node dsh-novel-studio/test/acceptance.mjs
// 退出码：0 = 全部 PASS；1 = 存在 FAIL（明细逐条打印）。
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { apply as applyTools } from '../lib/tools.js'
import { countChars, padChapter, splitChapters } from '../lib/core.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SAMPLE_FILE = resolve(HERE, '../samples/半成品-都市悬疑.txt')

// ---------------------------------------------------------------- 断言与输出
const checks = []
let failed = 0

function check(name, condition, detail) {
  const ok = Boolean(condition)
  checks.push({ name, ok, detail })
  if (!ok) failed += 1
  const tag = ok ? 'PASS' : 'FAIL'
  const suffix = !ok && detail !== undefined ? `\n       └─ ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''
  console.log(`[${tag}] ${name}${suffix}`)
}

function section(title) {
  console.log(`\n---- ${title} ----`)
}

async function writeJson(root, rel, value) {
  await writeFile(join(root, rel), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

// 被验收的工具注册表：fake ctx 只实现 tools.register（与 smoke.mjs 同构）
const toolDefinitions = []
const fakeCtx = {
  get: () => undefined,
  tools: {
    register(definition) {
      toolDefinitions.push(definition)
      return () => {}
    },
  },
}
applyTools(fakeCtx)

const tools = new Map(toolDefinitions.map((definition) => [definition.name, definition]))
const exec = { agent: undefined, signal: new AbortController().signal }
const call = (name, args) => {
  const tool = tools.get(name)
  if (tool === undefined) throw new Error(`工具未注册：${name}`)
  return tool.execute(args, exec)
}

// ---------------------------------------------------------------- 主流程
const tempRoot = await mkdtemp(join(tmpdir(), 'novel-studio-accept-'))
const project = join(tempRoot, '雾港夜航')

console.log('小说工作室 · 端到端验收')
console.log(`临时项目：${project}`)
console.log(`样本文件：${SAMPLE_FILE}`)

try {
  const sampleText = await readFile(SAMPLE_FILE, 'utf8')
  const sampleChars = countChars(sampleText)
  check('样本文件存在且 8000–12000 字', existsSync(SAMPLE_FILE) && sampleChars >= 8000 && sampleChars <= 12000, `实际 ${sampleChars} 字`)
  const sampleChapters = splitChapters(sampleText)
  check('样本可按「第N章」切出 6 章', sampleChapters.length === 6, `实际 ${sampleChapters.length} 块：${sampleChapters.map((c) => c.title).join(' / ')}`)

  // 0. 空目录检测
  section('0. 空目录 detect')
  const emptyDetect = await call('novel_project', { action: 'detect', path: tempRoot })
  check('空目录 detect 结果为非小说项目', emptyDetect.ok === true && emptyDetect.isNovel === false, emptyDetect)

  // 1. init → detect／status
  section('1. novel_project init → detect/status')
  const initResult = await call('novel_project', { action: 'init', path: project, title: '雾港夜航', genre: '都市悬疑' })
  check('init 返回 ok 并创建资料骨架', initResult.ok === true && initResult.createdFiles.includes('premise.md') && initResult.createdFiles.includes('characters.json') && initResult.createdFiles.includes('story/state.json'), initResult.createdFiles)
  const detectResult = await call('novel_project', { action: 'detect', path: project })
  check('init 后 detect.isNovel 为真', detectResult.ok === true && detectResult.isNovel === true, detectResult)
  const statusEmpty = await call('novel_project', { action: 'status', path: project })
  check('init 后 status 报告 0 章、nextChapter=1', statusEmpty.ok === true && statusEmpty.chapters.length === 0 && statusEmpty.nextChapter === 1, { chapters: statusEmpty.chapters, nextChapter: statusEmpty.nextChapter })
  for (const rel of ['premise.md', 'characters.json', 'world_rules.json', 'outline.json', 'timeline.jsonl', 'foreshadow_ledger.json', 'relationship_state.json', 'meta/progress.json', 'meta/compass.json', 'story/style.md', 'story/state.json']) {
    check(`init 种子文件存在：${rel}`, existsSync(join(project, rel)))
  }

  // 2. novel_import prepare（读样本文件）
  section('2. novel_import prepare（source=样本文件）')
  const importResult = await call('novel_import', { action: 'prepare', path: project, source: SAMPLE_FILE })
  check('import prepare 返回 ok', importResult.ok === true, importResult)
  check('切章数量 ≥ 6', importResult.chunkCount >= 6, `chunkCount=${importResult.chunkCount}`)
  check('totalChars > 0 且等于样本字数', importResult.totalChars > 0 && importResult.totalChars === sampleChars, `totalChars=${importResult.totalChars} sample=${sampleChars}`)
  check('编码识别为 UTF-8 系', importResult.encoding.startsWith('utf-8'), importResult.encoding)
  const manifestFile = join(project, 'story/import/manifest.json')
  check('story/import/manifest.json 存在', existsSync(manifestFile))
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
  check('manifest.chunks 数量与返回一致', Array.isArray(manifest.chunks) && manifest.chunks.length === importResult.chunkCount, `manifest=${manifest.chunks?.length} result=${importResult.chunkCount}`)
  check('manifest.totalChars > 0', manifest.totalChars > 0, manifest.totalChars)
  check('story/import/source.txt 存在且与样本一致', existsSync(join(project, 'story/import/source.txt')) && countChars(await readFile(join(project, 'story/import/source.txt'), 'utf8')) === sampleChars)
  let chunkFilesOk = true
  let chunkBody = []
  for (const record of manifest.chunks) {
    const abs = join(project, ...record.file.split('/'))
    if (!existsSync(abs) || record.chars <= 0) chunkFilesOk = false
    const raw = await readFile(abs, 'utf8')
    if (!raw.startsWith('<!-- chunk')) chunkFilesOk = false
    const body = raw.replace(/^<!-- chunk [^\n]*-->\n\n/, '').trim()
    if (!body.startsWith('第')) chunkFilesOk = false
    chunkBody.push({ index: record.index, title: record.title, file: record.file, body })
  }
  check('每个 chunk 文件存在且含正文', chunkFilesOk, chunkBody.map((c) => c.file))
  check('chunk 标题保留「第N章 标题」', chunkBody.every((c) => /^第\d+章\s+\S/.test(c.title)), chunkBody.map((c) => c.title))
  check('prepare 返回 chapterCount 与样本章数一致', importResult.chapterCount === 6, importResult.chapterCount)
  check('prepare 写入 story/import/chapters.json', existsSync(join(project, 'story/import/chapters.json')))

  // 3. novel_import materialize：把已导入的既有章节归位到 chapters/
  section('3. novel_import materialize（既有章节归位）')
  const materialize = await call('novel_import', { action: 'materialize', path: project })
  check('materialize 返回 ok 并归位 6 章', materialize.ok === true && materialize.chapters.length === 6 && materialize.completed.join(',') === '1,2,3,4,5,6', materialize.completed)
  check('chapters/001–006.md 已生成', [1, 2, 3, 4, 5, 6].every((n) => existsSync(join(project, 'chapters', `${padChapter(n)}.md`))))
  const progressImported = JSON.parse(await readFile(join(project, 'meta/progress.json'), 'utf8'))
  check('materialize 后 progress 记录 1–6 章且 phase=imported', progressImported.completed_chapters.join(',') === '1,2,3,4,5,6' && progressImported.phase === 'imported', progressImported)
  const stateImported = JSON.parse(await readFile(join(project, 'story/state.json'), 'utf8'))
  check('materialize 后 state.last_chapter=6、stage=imported', Number(stateImported.last_chapter) === 6 && stateImported.stage === 'imported', stateImported)
  let forceGuardMessage = ''
  try {
    await call('novel_import', { action: 'materialize', path: project })
  } catch (error) {
    forceGuardMessage = String(error.message)
  }
  check('已有 chapters/ 时 materialize 默认拒绝覆盖（需 force=true）', forceGuardMessage.includes('force'), forceGuardMessage)

  // 4. 模拟架构师/作者归档（资料库 + 文风卡 + 摘要）
  section('4. 模拟资料归档')
  await writeJson(project, 'characters.json', [
    { name: '陈砚', role: '主角/市局法医', description: '三十四岁，主检法医师，冷静寡言，左手腕有旧疤', background: '父亲陈渡一九九八年跑船失踪，姐姐陈棠二零一五年在雾港七号泊位失踪', goal: '查清父亲与姐姐失踪的真相', personality: '克制、偏执、对谎言敏感', status: '在场' },
    { name: '林岚', role: '市局刑侦支队副支队长', description: '三十六岁，冷峻，二零一五年的夜巡签到表上写过“未到场”', background: '十九岁时在雾港目击有人深夜装船，被要求隐瞒', goal: '把十年前的案子翻过来，这一次签一次真实的到场', personality: '强硬、内疚、护短', status: '在场' },
    { name: '周野', role: '调查记者/播客主播', description: '二十八岁，做播客《雾港夜航》，马德把录音带交给了他', background: '原晚报社会新闻记者，长期跟踪雾港失踪案', goal: '把真相播出去', personality: '话多、胆大、重承诺', status: '在场' },
    { name: '秦九', role: '反派/九记典当行老板', description: '五十五岁，原江城航运留守经理，方脸细眼，嘴角有深笑纹', background: '掌控雾港旧港区地皮与码头人脉，涉案三十年', goal: '封住所有知情人的嘴，等旧港改造落地', personality: '阴狠、缜密、讲规矩', status: '在场' },
    { name: '马德', role: '关键证人（已死亡）', description: '四十八岁，码头临时工，右手无名指缺一截', background: '孙悦的舅舅，一九九八年与二零一五年两晚都在七号泊位', goal: '保护外甥女，把录音带交出去', personality: '胆小、讲义气', status: '死亡' },
    { name: '陈棠', role: '陈砚的姐姐（失踪）', description: '二零一五年失踪时二十二岁，说话慢，尾音轻', background: '二零一五年七月十一日在雾港七号泊位失踪，留下“七号泊位，涨潮前”的字条', goal: '查清父亲当年在船上的遭遇', personality: '倔强、细心、护弟弟', status: '失联' },
    { name: '魏建国', role: '雾港守夜人', description: '六十二岁，耳背，听收音机，给陈砚留了七号库侧门的铜钥匙', background: '在雾港看夜四十年的老人', goal: '守住十年前答应那丫头的事', personality: '嘴严、心软', status: '在场' },
  ])
  await writeJson(project, 'world_rules.json', [
    { name: '涨潮倒灌', category: '物理', description: '雾港旧港排洪暗渠与三号泵站相连，最高潮前后两小时内，七号库地面会被倒灌的江水淹没，水位可达膝盖以上，可用于毁尸灭迹。' },
    { name: '七号泊位不夜航', category: '社会', description: '旧港改造期间七号泊位名义上停用，夜里靠泊的船不开灯、不鸣笛、不报港，只能靠吃水与缆绳痕迹追查。' },
    { name: '九记的规矩', category: '组织', description: '秦九控制雾港东街的门面与临时工，凡在码头讨生活的人都不敢向警方提供证词；违背者会被逐出港区并遭报复。' },
    { name: '八股缆绳', category: '历史', description: '九十年代江城航运的老船使用八股编蓝色尼龙缆绳，这种纤维只留在旧船与旧手套上，可据此把案发现场与旧船关联起来。' },
  ])
  await writeJson(project, 'foreshadow_ledger.json', [
    { id: 'F-001', status: 'planted', description: '陈砚左手腕的旧疤来自二零一五年拉住姐姐的那一夜，他始终对警方隐瞒自己与旧案的关系。', chapters: [1] },
    { id: 'F-002', status: 'active', description: '白色海鸥吊坠在三个案发现场反复出现，背面刻着“棠”字，但陈棠遗物清单里没有它。', chapters: [1, 2, 4] },
    { id: 'F-003', status: 'planted', description: '潮声录像带标签写着“二零一五·七·十一 夜航 B-07”，最后三秒是三短两长的敲击暗号。', chapters: [3, 4, 5] },
    { id: 'F-004', status: 'active', description: '林岚二零一五年夜巡签到表上的“未到场”不是她本人笔迹，当年带班老刑警是谁尚未揭晓。', chapters: [2, 4, 5] },
    { id: 'F-005', status: 'resolved', description: '马德右手无名指缺一截，与雨夜跟踪陈砚的面包车司机是同一人。', chapters: [1, 3, 4] },
  ])
  await writeFile(
    join(project, 'timeline.jsonl'),
    [
      { chapter: 1, time: '第1日 22:10', event: '孙悦的尸体在雾港三号泵站排水口被发现，指甲缝检出蓝色缆绳纤维', characters: ['陈砚', '林岚'] },
      { chapter: 2, time: '第2日 15:30', event: '陈砚复勘泵站，老魏提到无灯夜航船与穿蓝雨衣的人', characters: ['陈砚', '魏建国'] },
      { chapter: 3, time: '第3日 21:00', event: '陈砚调出二零一五年三人失踪案卷，发现缺页与江城航运的关联；周野交来磁带', characters: ['陈砚', '周野', '林岚'] },
      { chapter: 4, time: '第4日 09:20', event: '马德死于出租屋，死因为溺死但室内无水；林岚坦白二零一五年夜巡真相', characters: ['陈砚', '林岚', '马德'] },
      { chapter: 5, time: '第5日 20:00', event: '录音带还原二零一五年七号泊位最后十分钟，陈砚认出父亲的名字出现在账本计划中', characters: ['陈砚', '周野', '林岚', '陈棠'] },
      { chapter: 6, time: '第6日 23:10', event: '三人进入七号库，在 B-07 冰柜发现蓝色手套与账本；秦九封门，倒灌开始', characters: ['陈砚', '林岚', '周野', '秦九'] },
    ]
      .map((line) => JSON.stringify(line))
      .join('\n') + '\n',
    'utf8',
  )
  await writeFile(
    join(project, 'story/style.md'),
    `# 文风卡

- 视角：第三人称限知，紧跟陈砚，偶尔切林岚
- 时态：过去时，线性推进，章节内允许短暂闪回
- 语言风格：冷峻克制，短句为主，少形容词，多动作与物证细节
- 句子节奏：长短交替，紧张段落用短句，回忆段落放慢
- 对话风格：对话短、留白多，人物不说破关键信息
- 意象/母题：雨、潮水、蓝色缆绳、白色海鸥吊坠、敲墙暗号
- 禁忌：不写超自然解释，不使用网络流行语，不给反派过度独白
`,
    'utf8',
  )
  await writeJson(project, 'outline.json', [
    { chapter: 1, title: '雨夜尸检', goal: '孙悦之死牵出十年前旧案的蓝色纤维，陈砚选择隐瞒' },
    { chapter: 2, title: '雾港泵站', goal: '现场复勘发现海鸥吊坠与“涨潮”字样' },
    { chapter: 3, title: '失踪名单', goal: '旧案卷宗缺页，马德失联，周野交出磁带' },
    { chapter: 4, title: '第二具尸体', goal: '马德溺死于无水房间，林岚坦白隐瞒了十年' },
    { chapter: 5, title: '录音带', goal: '录音带揭示二零一五年真相，三人决定夜探七号库' },
    { chapter: 6, title: '涨潮之前', goal: '七号库 B-07 冰柜与账本曝光，秦九封门放水' },
    { chapter: 7, title: '通风管', goal: '陈砚在倒灌的库房里听见姐姐的敲击暗号，必须活着带账本出去' },
    { chapter: 8, title: '退潮之后', goal: '账本与名单公开，秦九背后的保护网浮出水面' },
  ])
  const summaryTitles = ['雨夜尸检', '雾港泵站', '失踪名单', '第二具尸体', '录音带', '涨潮之前']
  for (let n = 1; n <= 6; n += 1) {
    await writeFile(
      join(project, 'story/summaries', `${padChapter(n)}.md`),
      `# 第${n}章 摘要\n\n本章「${summaryTitles[n - 1]}」：陈砚与林岚推进雾港旧案，重要线索与人物状态发生变化，具体伏笔见 foreshadow_ledger.json。\n`,
      'utf8',
    )
  }
  const progress = JSON.parse(await readFile(join(project, 'meta/progress.json'), 'utf8'))
  progress.completed_chapters = [1, 2, 3, 4, 5, 6]
  progress.phase = 'writing'
  progress.title = '雾港夜航'
  progress.genre = '都市悬疑'
  await writeJson(project, 'meta/progress.json', progress)
  check('归档文件齐备（人物/规则/伏笔/时间线/文风/摘要/大纲）', [1, 2, 3, 4, 5, 6].every((n) => existsSync(join(project, 'story/summaries', `${padChapter(n)}.md`))))
  const ledger = JSON.parse(await readFile(join(project, 'foreshadow_ledger.json'), 'utf8'))
  check('伏笔账本至少 2 条未回收', ledger.filter((item) => item.status !== 'resolved').length >= 2, ledger.map((item) => `${item.id}:${item.status}`))

  // 5. novel_validate（应 ok）
  section('5. novel_validate（归档后）')
  const validate1 = await call('novel_validate', { path: project })
  check('归档后 validate.ok === true（errors 为 0）', validate1.ok === true && validate1.errors.length === 0, validate1.errors)
  console.log(`       warnings=${validate1.warnings.length}${validate1.warnings.length > 0 ? `：${JSON.stringify(validate1.warnings)}` : ''}`)
  check('validate 统计章节数与归档一致', validate1.counts.chapters === 6 && validate1.counts.completed === 6 && validate1.counts.characters === 7, validate1.counts)

  // 6. novel_context 第 7 章 writer
  section('6. novel_context chapter=7 role=writer')
  const packResult = await call('novel_context', { path: project, chapter: 7, role: 'writer', budgetTokens: 6000, focus: '陈砚 林岚 七号库 冰柜 账本 录音带 涨潮 通风管' })
  check('context 返回 ok 且 chapter=7 role=writer', packResult.ok === true && packResult.chapter === 7 && packResult.role === 'writer', { chapter: packResult.chapter, role: packResult.role })
  check('context markdown 含主角名「陈砚」', packResult.markdown.includes('陈砚'))
  check('context markdown 含第7章上下文包标题', packResult.markdown.includes('第7章上下文包'))
  check('context markdown 含至少一条未回收伏笔', /F-00[1-4]/.test(packResult.markdown), packResult.markdown.match(/F-\d+/g))
  check('context markdown 含本章大纲目标', packResult.markdown.includes('通风管') || packResult.markdown.includes('第7章'))
  check('context 从已归位正文取到「上一章结尾」', packResult.markdown.includes('喊出了那个十年没有喊过的名字'), packResult.missing)
  check('context approxTokens > 0', packResult.approxTokens > 0, packResult.approxTokens)
  check('context 缓存文件已落盘', existsSync(packResult.cacheFile) && packResult.cacheFile.includes('story/context'), packResult.cacheFile)

  // 7. 打磨稿 → promote 第 7 章
  section('7. story/polished/007.md → novel_chapter promote')
  await writeFile(
    join(project, 'story/polished/007.md'),
    `# 第7章 通风管

水已经漫过膝盖。陈砚把账本和防水袋塞进林岚怀里，自己踩上冰柜侧面的铁架，够到那根通风管的管口。铁皮冰凉，锈屑扎进掌心。他敲回去，三下，停一拍，两下。

管道那头静了三秒，然后传来同样的节奏，比刚才更急。

“陈棠。”他压低声音，喉咙里像塞了沙子，“是我。”

管道里传来一阵脚步拖拽的声音，接着是磁带转动一样的沙沙声。周野在下面喊他：“水到腰了，门缝在渗光，外面有人在撬门。”

林岚把枪重新上膛，退到冰柜背后：“秦九以为水能淹死我们，可他忘了冰柜是浮的。”

陈砚低头。七号库里的七个冰柜，正在慢慢离开地面。
`,
    'utf8',
  )
  check('story/polished/007.md 已写入', existsSync(join(project, 'story/polished/007.md')))
  const promoteResult = await call('novel_chapter', { action: 'promote', path: project, chapter: 7, from: 'polished' })
  check('promote 返回 ok 且章节号=7', promoteResult.ok === true && promoteResult.chapter === 7, promoteResult)
  check('chapters/007.md 已生成', existsSync(join(project, 'chapters/007.md')))
  const progressAfter = JSON.parse(await readFile(join(project, 'meta/progress.json'), 'utf8'))
  check('progress.completed_chapters 含 7', Array.isArray(progressAfter.completed_chapters) && progressAfter.completed_chapters.includes(7), progressAfter.completed_chapters)
  check('progress.words 已更新为正数', progressAfter.words > 0, progressAfter.words)
  const stateAfter = JSON.parse(await readFile(join(project, 'story/state.json'), 'utf8'))
  check('story/state.json 记录 last_chapter=7 且 stage=writing', Number(stateAfter.last_chapter) === 7 && stateAfter.stage === 'writing', stateAfter)
  const summary7 = await call('novel_chapter', { action: 'summary', path: project, chapter: 7, summary: '陈砚在七号库通风管听到姐姐陈棠的敲击暗号，秦九封门放水，冰柜开始上浮。' })
  check('novel_chapter summary 写入第 7 章摘要', summary7.ok === true && existsSync(join(project, 'story/summaries/007.md')), summary7)

  // 8. 再体检
  section('8. novel_validate（定稿后）')
  const validate2 = await call('novel_validate', { path: project })
  check('定稿后 validate.ok === true（errors 必须为 0）', validate2.ok === true && validate2.errors.length === 0, validate2.errors)
  console.log(`       warnings=${validate2.warnings.length}${validate2.warnings.length > 0 ? `：${JSON.stringify(validate2.warnings)}` : ''}`)
  check('validate 统计 7 章、7 章完成', validate2.counts.chapters === 7 && validate2.counts.completed === 7, validate2.counts)

  // 9. 整本导出
  section('9. novel_chapter export')
  const exportResult = await call('novel_chapter', { action: 'export', path: project, title: '雾港夜航' })
  check('export 返回 ok 且导出 7 章', exportResult.ok === true && exportResult.chapters === 7, exportResult)
  const exportFile = join(project, 'export/novel.md')
  check('export/novel.md 存在', existsSync(exportFile))
  const exportText = await readFile(exportFile, 'utf8')
  check('导出内容含书名与第 7 章标题', exportText.startsWith('# 雾港夜航') && exportText.includes('## 第7章'), exportText.slice(0, 60))
  check('导出字数 > 0', exportResult.chars > 0, exportResult.chars)

  // 10. 导入 status 复查
  section('10. novel_import status 复查')
  const importStatus = await call('novel_import', { action: 'status', path: project })
  check('import status 报告 chunkCount ≥ 6', importStatus.ok === true && importStatus.chunkCount >= 6 && importStatus.totalChars > 0, { chunkCount: importStatus.chunkCount, totalChars: importStatus.totalChars })
} catch (error) {
  failed += 1
  console.log(`[FAIL] 未捕获异常：${error && error.stack ? error.stack : error}`)
} finally {
  await rm(tempRoot, { recursive: true, force: true }).catch(() => {})
}

// ---------------------------------------------------------------- 汇总
console.log('\n============================================')
const passed = checks.length - failed
console.log(`PASS/FAIL 明细：共 ${checks.length} 项，PASS ${passed}，FAIL ${failed}`)
if (failed > 0) {
  console.log('\n失败明细：')
  for (const item of checks.filter((entry) => !entry.ok)) {
    console.log(`- ${item.name}${item.detail === undefined ? '' : `：${typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail)}`}`)
  }
}
console.log(`验收结果：${failed === 0 ? 'PASS' : 'FAIL'}`)
process.exitCode = failed === 0 ? 0 : 1
