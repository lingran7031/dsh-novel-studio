// 生成「雾港夜航」演示项目：直接走生产工具链（novel_import/n materialize）+ 归档资料，
// 供用户打开后立即测试「续写第 7 章」；脚本自带校验，失败即抛错。
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ensureDir, readJsonFile, toPosix, writeText } from '../lib/core.js'
import { apply } from '../lib/tools.js'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(here, '..')
const samplePath = join(packageRoot, 'samples', '半成品-都市悬疑.txt')
const root = join(packageRoot, 'samples', '雾港夜航')

const registered = []
apply({ get: () => undefined, tools: { register: (definition) => { registered.push(definition); return () => {} } } })
const [projectTool, validateTool, importTool, contextTool] = registered
const exec = { agent: undefined, signal: new AbortController().signal }

const chars = [
  {
    name: '陈砚',
    role: '主角 / 市局法医',
    description: '市局法医，冷静克制，习惯用专业判断压住情绪。',
    background: '姐姐陈棠十年前在雾港七号泊位失踪，父亲陈渡更早失踪。',
    goal: '查清姐姐与父亲的失踪真相，找回被抹掉的记忆。',
    personality: '寡言、细致、对尸体与潮声异常敏感。',
    status: '因第 6 章冷库倒灌被困，听到通风管三短两长敲击声。',
  },
  {
    name: '林岚',
    role: '刑侦副支队长',
    description: '行动派，负责把陈砚的推断落成证据链。',
    background: '与陈砚搭档多年，知道陈家旧事却一直没说完。',
    goal: '在上级压力下尽快结案，同时保住陈砚。',
    personality: '干脆、护短、关键时刻敢赌。',
    status: '第 6 章与陈砚一同被困冷库。',
  },
  {
    name: '陈棠',
    role: '失踪者 / 姐姐',
    description: '十年前在雾港七号泊位失踪，只留下白色海鸥吊坠。',
    background: '失踪前在旧港做夜班记录员。',
    goal: '（作为失踪者）留下线索，等待被找到。',
    personality: '温和、细心、喜欢录潮声。',
    status: '下落不明；第 6 章通风管敲击暗号疑似其本人。',
  },
  {
    name: '陈渡',
    role: '失踪者 / 父亲',
    description: '更早失踪的港务系统职工，留下一条蓝色八股缆绳。',
    background: '1998 年失踪案的关键人物。',
    goal: '（作为失踪者）留下证据链。',
    personality: '沉默、固执。',
    status: '下落不明。',
  },
  {
    name: '周启明',
    role: '雾港派出所老民警',
    description: '熟悉旧港人情与旧案卷宗。',
    background: '1998 年时是片警，见过陈渡最后一次。',
    goal: '在退休前把旧案说清楚。',
    personality: '圆滑、念旧、怕事。',
    status: '第 3 章提供失踪名单后失联。',
  },
  {
    name: '许蔓',
    role: '调查记者',
    description: '盯旧港利益链多年的记者。',
    background: '手里有一份未公开的夜巡签到表复印件。',
    goal: '拿到能公开的证据。',
    personality: '锋利、冒险。',
    status: '第 5 章把潮声录音带交给陈砚。',
  },
  {
    name: '韩东',
    role: '港务公司经理 / 反派线',
    description: '旧港改造项目的实际受益人。',
    background: '与三起失踪案都有时间交集。',
    goal: '让旧港按期拆迁，掩盖旧账。',
    personality: '体面、冷酷。',
    status: '第 6 章下令提前涨潮清场。',
  },
]

const worldRules = [
  { name: '雾港潮汐', category: '地理', description: '旧港冷库低于海平面，涨潮时倒灌，夜间无人值守。' },
  { name: '旧港利益链', category: '势力', description: '1998/2015/2025 三起失踪案都与旧港改造利益链有关，卷宗被人为拆分。' },
  { name: '法医鉴定流程', category: '规则', description: '尸体证据链必须两人复核；陈砚单方面发现常被上级压回。' },
  { name: '潮声录音带', category: '物件', description: '旧式磁带，录有涨潮前的港区环境声，可反推时间与位置。' },
]

const foreshadows = [
  { id: 'F-001', status: '未回收', description: '陈砚手臂旧疤的来历与 2015 年失踪案现场一致。', chapters: [1, 4] },
  { id: 'F-002', status: '未回收', description: '白色海鸥吊坠在第二具尸体手中出现。', chapters: [1, 4] },
  { id: 'F-003', status: '未回收', description: '许蔓给的潮声录音带里有一段被剪掉的三短两长敲击。', chapters: [5, 6] },
  { id: 'F-004', status: '未回收', description: '夜巡签到表缺了 2015 年 7 月 14 日那一页。', chapters: [3, 5] },
]

const timeline = [
  { chapter: 1, time: '2025-07-14 夜', event: '雨夜尸检发现第二具尸体与海鸥吊坠', characters: ['陈砚', '林岚'] },
  { chapter: 2, time: '2025-07-15 凌晨', event: '雾港泵站找到 2015 年旧物与蓝色缆绳', characters: ['陈砚', '林岚'] },
  { chapter: 3, time: '2025-07-15 上午', event: '周启明交出失踪名单后失联', characters: ['陈砚', '周启明'] },
  { chapter: 4, time: '2025-07-15 下午', event: '第二具尸体身份确认，旧疤线索出现', characters: ['陈砚', '林岚'] },
  { chapter: 5, time: '2025-07-15 傍晚', event: '许蔓交出潮声录音带与签到表线索', characters: ['陈砚', '许蔓'] },
  { chapter: 6, time: '2025-07-15 夜', event: '三人被困七号冷库，倒灌开始，通风管传来暗号', characters: ['陈砚', '林岚', '陈棠'] },
]

const relationships = [
  { character_a: '陈砚', character_b: '林岚', relation: '搭档 / 互相信任', chapter: 6 },
  { character_a: '陈砚', character_b: '陈棠', relation: '姐弟 / 十年失踪', chapter: 6 },
  { character_a: '陈砚', character_b: '陈渡', relation: '父子 / 更早失踪', chapter: 3 },
  { character_a: '韩东', character_b: '陈渡', relation: '旧港利益链上下游', chapter: 5 },
  { character_a: '许蔓', character_b: '陈砚', relation: '交换证据的盟友', chapter: 5 },
]

const chapters = [
  { chapter: 1, title: '雨夜尸检', goal: '雨夜尸检引出第二具尸体与海鸥吊坠，建立陈砚的执念。' },
  { chapter: 2, title: '雾港泵站', goal: '泵站找到 2015 年旧物，确认两案时间缝合。' },
  { chapter: 3, title: '失踪名单', goal: '周启明交出失踪名单后失联，扩大阴谋范围。' },
  { chapter: 4, title: '第二具尸体', goal: '尸体身份与陈砚旧疤关联，主线收紧。' },
  { chapter: 5, title: '录音带', goal: '许蔓交出潮声录音带，指向冷库与敲击暗号。' },
  { chapter: 6, title: '涨潮之前', goal: '三人被困冷库，停在三短两长敲击与陈砚喊出姐姐名字。' },
  { chapter: 7, title: '（待写）', goal: '确认敲击者身份；在倒灌前找到冷库暗门；揭开 2015 年签到表缺页。' },
  { chapter: 8, title: '（待写）', goal: '韩东线第一次正面冲突；陈渡 1998 年旧案的物证浮出水面。' },
]

const summaries = {
  1: '雨夜尸检发现第二具尸体，尸体手中握着白色海鸥吊坠；陈砚在解剖室第一次听见潮声幻听，旧疤发作。',
  2: '陈砚与林岚进入雾港泵站，找到 2015 年遗留的蓝色八股缆绳与一段被剪断的录音带；泵站值班记录缺页。',
  3: '周启明交出 1998/2015/2025 三份失踪名单的合并版后失联；名单上出现陈渡与陈棠的名字。',
  4: '第二具尸体身份确认，其手臂旧疤与陈砚一致；林岚开始怀疑陈砚隐瞒了 2015 年的记忆。',
  5: '许蔓交出潮声录音带与夜巡签到表复印件；录音带末尾有三短两长的敲击声，陈砚辨认出姐姐的节奏。',
  6: '三人追到七号冷库，韩东下令提前涨潮清场；冷库开始倒灌，通风管传来三短两长敲击，陈砚喊出陈棠的名字，章节在此中断。',
}

const style = `# 文风卡

- 视角：第三人称限知，主要贴陈砚；关键场景可短暂切林岚。
- 时态：过去时叙事，短句为主，环境细节压情绪。
- 语言风格：冷峻克制，少形容词，用动作与器物承载情绪。
- 句子节奏：长短句交替；紧张段落用短句与单句成段。
- 对话风格：克制、带潜台词；林岚直，陈砚绕。
- 意象/母题：潮声、缆绳、冷库白雾、海鸥吊坠、旧录音带的电流底噪。
- 禁忌：不写超自然解释；不靠巧合破案；不轻易让主角情绪外露。
`

const continuationPlan = `# 续写方案（演示版，已选路线 A）

## 当前进度
第 1–6 章已归档，停在第 6 章冷库倒灌的中段。

## 未回收线
- F-001 陈砚旧疤与 2015 案现场一致
- F-002 海鸥吊坠出现在第二具尸体手中
- F-003 潮声磁带被剪掉的三短两长敲击
- F-004 夜巡签到表缺 2015-07-14 一页

## 三个方向（演示选用 A）
- A（推荐）：冷库逃生 + 确认敲击者身份，把陈棠线正式拉回主线；节奏紧，回收 F-002/F-003。
- B：先破韩东的拆迁时间表，用程序正义逼出旧账；偏群像与推理。
- C：陈砚记忆错位，2015 年他可能在场；风险最大，人物弧光最狠。

## 建议
第 7 章完成“冷库逃生 + 敲击者身份确认”，第 8 章正面撞上韩东。
`

const premise = `# 故事前提

> 一句话前提：一名法医追查姐姐十年前的失踪，发现三起失踪案被同一条旧港利益链串起。

## 核心冲突
陈砚要在亲人失踪与体制压力之间，挖出旧港改造背后的旧账。

## 主角与目标
陈砚（市局法医）：查清姐姐陈棠与父亲陈渡的失踪真相。

## 主要阻力
韩东与旧港利益链、被拆分的卷宗、陈砚自己被动过的记忆。

## 结局方向
旧港拆迁前夜，陈砚用一条完整的证据链逼出真相；代价是必须公开陈家的旧事。
`

async function main() {
  const source = await readFile(samplePath, 'utf8')
  await ensureDir(root)
  await projectTool.execute({ action: 'init', path: root, title: '雾港夜航', genre: '都市悬疑' }, exec)
  const imported = await importTool.execute({ action: 'prepare', path: root, source: samplePath, maxChars: 12000 }, exec)
  if (imported.chapterCount !== 6) throw new Error(`demo: expected 6 chapters, got ${imported.chapterCount}`)
  await importTool.execute({ action: 'materialize', path: root }, exec)

  await writeText(join(root, 'premise.md'), premise)
  await writeText(join(root, 'characters.json'), `${JSON.stringify(chars, null, 2)}\n`)
  await writeText(join(root, 'world_rules.json'), `${JSON.stringify(worldRules, null, 2)}\n`)
  await writeText(join(root, 'foreshadow_ledger.json'), `${JSON.stringify(foreshadows, null, 2)}\n`)
  await writeText(join(root, 'relationship_state.json'), `${JSON.stringify(relationships, null, 2)}\n`)
  await writeText(join(root, 'outline.json'), `${JSON.stringify(chapters, null, 2)}\n`)
  await writeText(join(root, 'timeline.jsonl'), `${timeline.map((item) => JSON.stringify(item)).join('\n')}\n`)
  await writeText(join(root, 'story/style.md'), style)
  await writeText(join(root, 'story/continuation-plan.md'), continuationPlan)
  for (const [chapter, text] of Object.entries(summaries)) {
    await writeText(join(root, 'story/summaries', `${String(chapter).padStart(3, '0')}.md`), `# 第${chapter}章 摘要\n\n${text}\n`)
  }

  const progressFile = join(root, 'meta/progress.json')
  const progress = (await readJsonFile(root, 'meta/progress.json', {})) || {}
  await writeText(
    progressFile,
    `${JSON.stringify(
      {
        ...progress,
        title: '雾港夜航',
        genre: '都市悬疑',
        phase: 'writing',
        current_volume: 1,
        current_arc: 1,
        completed_chapters: [1, 2, 3, 4, 5, 6],
      },
      null,
      2,
    )}\n`,
  )
  await writeText(
    join(root, 'meta/compass.json'),
    `${JSON.stringify(
      {
        final_direction: '旧港拆迁前夜，陈砚用完整证据链逼出真相；代价是公开陈家旧事。',
        active_threads: ['F-001 旧疤', 'F-002 海鸥吊坠', 'F-003 潮声磁带', 'F-004 签到表缺页'],
        scale_estimate: '12 章 / 约 12 万字',
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  )

  const validation = await validateTool.execute({ path: root }, exec)
  if (validation.ok !== true) throw new Error(`demo validation failed: ${JSON.stringify(validation.errors)}`)

  const pack = await contextTool.execute({ path: root, chapter: 7, role: 'writer', budgetTokens: 6000, focus: '冷库 敲击 姐姐 录音带' }, exec)
  const mustHave = ['陈砚', 'F-00', '第6章']
  for (const token of mustHave) {
    if (!pack.markdown.includes(token)) throw new Error(`demo context pack missing ${token}`)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        root: toPosix(root),
        chapters: 6,
        words: validation.counts.chapters && progress.words,
        validate: { errors: validation.counts.errors, warnings: validation.counts.warnings },
        context: { tokens: pack.approxTokens, cache: pack.cacheFile },
        files: ['premise.md', 'characters.json', 'outline.json', 'story/continuation-plan.md'],
      },
      null,
      2,
    ),
  )
}

await import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true }))
await main()
