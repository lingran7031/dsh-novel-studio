// dsh-novel-studio — Host 半。
// 提供写作台与自检接口，全部带 Host 头回环信任围栏，避免 DNS 重绑定。
//   1. GET  /novel-studio/api/status  —— preset 激活自检（子插件 fiber、工具/技能/提示词、Client 入口）；
//   2. GET  /novel-studio/api/project —— 右栏「写作台」的数据源（按 sessionId 或显式 path 解析小说项目）；
//   3. POST /novel-studio/api/export  —— 写作台导出整本（md/docx），结果写回项目 export/。
//   4. GET  /novel-studio/api/chapter —— 按正整数章号打开完整正文。
//   5. GET  /novel-studio/api/library —— 浏览白名单内的故事资料。
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

import {
  detectProject,
  exportNovel,
  findChapterFile,
  projectStatus,
  readChapterTitle,
  readJsonFile,
  readTail,
  toPosix,
} from './core.js'
import { checkWorkbenchProjectPaths, readWorkbenchChapter, readWorkbenchLibrary } from './workbench.js'
import { handleWorkflowRequest } from './workflow-http.js'
import { withRevisionLock } from './revisions.js'

export const name = 'novel-studio-host'

export const inject = ['webServer']

const FIBER_STATES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']

function fiberName(state) {
  return typeof state === 'number' ? FIBER_STATES[state] ?? String(state) : state
}

function sendJson(res, code, payload) {
  try {
    res.statusCode = code
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(payload, null, 2))
  } catch {
    /* 客户端已断开连接。 */
  }
}

function errorText(error) {
  return String(error && error.message ? error.message : error)
}

function isOpenForeshadow(status) {
  const text = String(status ?? '').trim().toLowerCase()
  const key = text.replace(/[（(].*$/u, '').trim()
  return !new Set(['已回收', '已完成', '已解决', '已关闭', '已兑现', '已废弃', '废弃', '放弃', 'resolved', 'closed', 'done', 'abandoned', 'dropped', 'paid']).has(key)
    && !/已回收|已完成|已解决|已关闭|已兑现|已废弃/u.test(text)
}

async function readJsonBody(req, limit = 65536) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('payload too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// 右栏写作台只关心「这个会话现在在写哪本书」。优先读活 Agent 的 Session header；
// 后台/冷会话再退回 sessionQuery 的持久 header。
async function resolveProjectRoot(ctx, url, body) {
  const explicit = String(
    (url.searchParams.get('path') || (body && typeof body.path === 'string' ? body.path : '') || '').trim(),
  )
  if (explicit !== '') return { root: explicit, source: 'path' }
  const sessionId = String(
    (url.searchParams.get('sessionId') || (body && typeof body.sessionId === 'string' ? body.sessionId : '') || '').trim(),
  )
  if (sessionId === '') return { root: undefined, source: 'none' }

  const agents = ctx.get('agents')
  if (agents !== undefined && typeof agents.get === 'function') {
    try {
      const agent = agents.get(sessionId)
      const cwd = agent && agent.session && agent.session.header ? agent.session.header.cwd : undefined
      if (typeof cwd === 'string' && cwd !== '') return { root: cwd, source: 'agent', sessionId }
    } catch {
      /* 活跃会话不可用时，继续尝试持久化的会话头。 */
    }
  }
  const query = ctx.get('sessionQuery')
  if (query !== undefined && typeof query.observeSession === 'function') {
    try {
      const observation = await query.observeSession(sessionId)
      const cwd = observation && observation.header ? observation.header.cwd : undefined
      if (typeof cwd === 'string' && cwd !== '') return { root: cwd, source: 'session', sessionId }
    } catch {
      /* 会话未知或尚未持久化。 */
    }
  }
  return { root: undefined, source: 'session', sessionId }
}

async function recentDecisions(root, limit) {
  try {
    const entries = await readdir(join(root, 'story/decisions'), { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && /\.(md|txt)$/i.test(entry.name))
      .map((entry) => entry.name.replace(/\.(md|txt)$/i, ''))
      .sort()
      .reverse()
      .slice(0, limit)
  } catch {
    return []
  }
}

/** 写作台数据：有界、只读，不返回整章正文（只给上一章结尾片段）。 */
async function buildProjectPayload(root) {
  await checkWorkbenchProjectPaths(root)
  const detected = await detectProject(root)
  const payload = {
    ok: true,
    root: toPosix(root),
    isNovel: detected.isNovel === true,
    chapterCount: detected.chapterCount || 0,
    time: new Date().toISOString(),
  }
  if (payload.isNovel !== true) return payload

  const status = await projectStatus(root)
  const progress = status.progress !== null && typeof status.progress === 'object' ? status.progress : {}
  const state = status.state !== null && typeof status.state === 'object' ? status.state : {}
  const completed = Array.isArray(progress.completed_chapters)
    ? progress.completed_chapters.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    : []

  const chapters = []
  for (const chapter of status.chapters) {
    chapters.push({
      n: chapter.n,
      title: await readChapterTitle(root, chapter.file),
      chars: chapter.chars,
      completed: completed.includes(chapter.n),
    })
  }

  const characters = await readJsonFile(root, 'characters.json', [])
  const worldRules = await readJsonFile(root, 'world_rules.json', [])
  const relationships = await readJsonFile(root, 'relationship_state.json', [])
  const foreshadow = await readJsonFile(root, 'foreshadow_ledger.json', [])
  const openForeshadowItems = Array.isArray(foreshadow)
    ? foreshadow.filter((item) => item !== null && typeof item === 'object' && isOpenForeshadow(item.status))
    : []
  const openForeshadow = openForeshadowItems
    .slice(0, 10)
    .map((item) => ({
      id: String(item.id ?? ''),
      status: String(item.status ?? ''),
      description: String(item.description ?? '').slice(0, 120),
    }))
  const allDecisions = await recentDecisions(root, Number.MAX_SAFE_INTEGER)
  const decisions = allDecisions.slice(0, 5)

  let lastTail = ''
  let lastTitle = ''
  if (status.lastChapter > 0) {
    const file = await findChapterFile(root, status.lastChapter)
    if (file !== undefined) {
      lastTail = (await readTail(file, 700)) ?? ''
      const last = status.chapters[status.chapters.length - 1]
      if (last !== undefined) lastTitle = await readChapterTitle(root, last.file)
    }
  }

  return {
    ...payload,
    title: typeof progress.title === 'string' ? progress.title : '',
    phase: String(progress.phase ?? state.stage ?? ''),
    totalChars: status.totalChars,
    lastChapter: status.lastChapter,
    nextChapter: status.nextChapter,
    chapters,
    lastTitle,
    lastTail: String(lastTail).slice(0, 700),
    materials: {
      characters: Array.isArray(characters) ? characters.length : 0,
      worldRules: Array.isArray(worldRules) ? worldRules.length : 0,
      relationships: Array.isArray(relationships) ? relationships.length : 0,
      foreshadows: Array.isArray(foreshadow) ? foreshadow.length : 0,
      decisions: allDecisions.length,
      summaries: status.counts.summaries,
      reviews: status.counts.reviews,
    },
    openForeshadow,
    openForeshadowCount: openForeshadowItems.length,
    decisions,
    progress: {
      completed,
      words: Number(progress.words ?? status.totalChars) || 0,
      current_volume: progress.current_volume ?? null,
      current_arc: progress.current_arc ?? null,
      updated_at: progress.updated_at ?? null,
    },
    state: {
      stage: String(state.stage ?? ''),
      last_chapter: Number(state.last_chapter ?? 0) || 0,
      note: String(state.note ?? '').slice(0, 200),
      updated_at: state.updated_at ?? null,
    },
    missing: status.missing.slice(0, 8).map((item) => item.file),
  }
}

/** preset 自检数据。 */
async function buildStatusPayload(ctx) {
  const payload = {
    ok: true,
    plugin: 'dsh-novel-studio',
    build: 'p6-rewrite-v1',
    time: new Date().toISOString(),
    preset: null,
    composition: null,
    presets: [],
    client: null,
    error: undefined,
  }

  const presets = ctx.get('agentPresets')
  if (presets === undefined) {
    payload.error = 'agentPresets service unavailable'
    return payload
  }

  try {
    const list = await presets.list()
    payload.presets = list.map((item) => ({ id: item.id, name: item.name, broken: item.broken }))
    const found = list.find((item) => item.id === 'novel-studio')
    payload.preset = found === undefined ? null : { id: found.id, name: found.name, broken: found.broken }

    if (typeof presets.compositionInventory === 'function') {
      const inventory = await presets.compositionInventory()
      const composition = inventory.find((item) => item.id === 'novel-studio')
      payload.composition =
        composition === undefined
          ? null
          : {
              id: composition.id,
              broken: composition.broken,
              rows: composition.rows.map((row) => ({
                entryId: row.entryId,
                moduleName: row.moduleName,
                enabled: row.enabled,
                condition: row.condition,
                fiberState: fiberName(row.fiberState),
              })),
            }
    }

    if (typeof presets.acquireScope === 'function') {
      const lease = await presets.acquireScope('novel-studio')
      try {
        const tools = ctx.get('tools')
        if (tools !== undefined && typeof tools.schemas === 'function') {
          payload.tools = tools.schemas(lease.key).map((schema) => schema.name)
        }
        const skills = ctx.get('skills')
        if (skills !== undefined) {
          const summaries = await skills.list({ scope: lease.key })
          payload.skills = summaries.map((item) => item.name)
          // 验证技能不仅能被列出，也能被 get() 装载（SkillDefinition 的 source 等校验）。
          try {
            const sample = await skills.get('novel-studio', { scope: lease.key })
            payload.skillSample =
              sample === undefined
                ? null
                : { name: sample.name, source: sample.source, chars: String(sample.content || '').length }
          } catch (error) {
            payload.skillSample = { error: errorText(error) }
          }
        }

        const systemPrompt = ctx.get('systemPrompt')
        if (systemPrompt !== undefined && typeof systemPrompt.assemble === 'function') {
          try {
            const assembly = await systemPrompt.assemble({ scope: lease.key })
            const sectionText = (name) => {
              const section = assembly.sections.find((item) => item.name === name)
              return section === undefined ? '' : String(section.text)
            }
            payload.prompt = {
              sectionCount: assembly.sections.length,
              totalChars: assembly.sections.reduce((total, item) => total + String(item.text).length, 0),
              toolCount: assembly.tools.length,
              novelTools: assembly.tools.map((item) => item.name).filter((toolName) => toolName.startsWith('novel_')),
              hasStudioPersona: sectionText('deployment:persona-prefix').includes('小说工作室'),
              hasStudioHandbook: sectionText('novel:studio-handbook').includes('Lead（总编）'),
            }
          } catch (error) {
            payload.prompt = { error: errorText(error) }
          }
        }
      } finally {
        const dispose = lease[Symbol.asyncDispose]
        if (typeof dispose === 'function') await dispose.call(lease)
      }

      const standardLease = await presets.acquireScope('standard')
      try {
        const tools = ctx.get('tools')
        payload.novelToolsInStandard =
          tools === undefined || typeof tools.schemas !== 'function'
            ? []
            : tools.schemas(standardLease.key).map((schema) => schema.name).filter((toolName) => toolName.startsWith('novel_'))
      } finally {
        const dispose = standardLease[Symbol.asyncDispose]
        if (typeof dispose === 'function') await dispose.call(standardLease)
      }
    }
  } catch (error) {
    payload.error = errorText(error)
  }

  // Client 半入口：确认 clientModules 已把本包的 dsh.client 组合进 boot graph。
  const clientModules = ctx.get('clientModules')
  if (clientModules !== undefined && typeof clientModules.graph === 'function') {
    try {
      const graph = clientModules.graph()
      const entry = Array.isArray(graph.entries)
        ? graph.entries.find((item) => item.id === 'dsh-novel-studio')
        : undefined
      payload.client = {
        entry:
          entry === undefined
            ? null
            : {
                id: entry.id,
                url: entry.url,
                rev: entry.rev,
                immediately: entry.immediately === true,
                inject: entry.inject,
              },
        path:
          typeof clientModules.clientPath === 'function'
            ? clientModules.clientPath('dsh-novel-studio')
            : undefined,
      }
    } catch (error) {
      payload.client = { error: errorText(error) }
    }
  }

  if (payload.error === undefined) delete payload.error
  return payload
}

export function apply(ctx) {
  const webServer = ctx.webServer
  if (webServer === undefined) return

  let expectedHost = ''
  try {
    const origin = typeof webServer.getOrigin === 'function' ? webServer.getOrigin() : ''
    if (origin !== '') expectedHost = new URL(origin).host
  } catch {
    expectedHost = ''
  }

  const handler = async (req, res) => {
    try {
      const host = String(req.headers.host || '')
      if (expectedHost !== '' && host !== expectedHost) return sendJson(res, 403, { ok: false, error: 'untrusted host' })
      const url = new URL(String(req.url || '/'), 'http://localhost')
      const pathname = url.pathname

      const workflow = await handleWorkflowRequest(ctx, req, url, resolveProjectRoot)
      if (workflow !== undefined) return sendJson(res, 200, workflow)

      if (pathname === '/novel-studio/api/project') {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET only' })
        const resolved = await resolveProjectRoot(ctx, url)
        if (resolved.root === undefined) {
          return sendJson(res, 200, {
            ok: false,
            error: 'no-project-root',
            source: resolved.source,
            sessionId: resolved.sessionId,
          })
        }
        return sendJson(res, 200, await withRevisionLock(resolved.root, (root) => buildProjectPayload(root)))
      }

      if (pathname === '/novel-studio/api/chapter' || pathname === '/novel-studio/api/library') {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET only' })
        const resolved = await resolveProjectRoot(ctx, url)
        if (resolved.root === undefined) return sendJson(res, 200, { ok: false, error: 'no-project-root', source: resolved.source })
        const payload = await withRevisionLock(resolved.root, (root) => pathname.endsWith('/chapter')
          ? readWorkbenchChapter(root, url.searchParams.get('chapter'))
          : readWorkbenchLibrary(root))
        return sendJson(res, 200, payload)
      }

      if (pathname === '/novel-studio/api/export') {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' })
        let parsed = {}
        try {
          const body = await readJsonBody(req)
          if (body.trim() !== '') parsed = JSON.parse(body)
        } catch {
          return sendJson(res, 400, { ok: false, error: 'bad json' })
        }
        const resolved = await resolveProjectRoot(ctx, url, parsed)
        if (resolved.root === undefined) {
          return sendJson(res, 200, { ok: false, error: 'no-project-root', source: resolved.source })
        }
        const format = parsed.format === 'docx' ? 'docx' : 'md'
        const result = await withRevisionLock(resolved.root, (root) => exportNovel(root, { format }))
        return sendJson(res, 200, { ok: true, ...result })
      }

      if (pathname === '/novel-studio/api/client/rebuild') {
        if (req.method !== 'GET' && req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'GET only' })
        const clientModules = ctx.get('clientModules')
        if (clientModules === undefined) return sendJson(res, 200, { ok: false, error: 'clientModules unavailable' })
        const clientPath =
          typeof clientModules.clientPath === 'function' ? clientModules.clientPath('dsh-novel-studio') : undefined
        const baseline =
          typeof clientModules.artifactBaseline === 'function'
            ? clientModules.artifactBaseline('dsh-novel-studio')
            : undefined
        if (typeof clientModules.rebuilt !== 'function') {
          return sendJson(res, 200, { ok: false, error: 'clientModules.rebuilt unavailable', clientPath, baseline })
        }
        let rev
        try {
          rev = clientModules.rebuilt('dsh-novel-studio')
        } catch (error) {
          return sendJson(res, 200, { ok: false, error: errorText(error), clientPath, baseline })
        }
        const graph = typeof clientModules.graph === 'function' ? clientModules.graph() : undefined
        const entry =
          graph && Array.isArray(graph.entries)
            ? graph.entries.find((item) => item.id === 'dsh-novel-studio')
            : undefined
        let current
        if (clientPath !== undefined) {
          try {
            const info = await stat(clientPath)
            current = { mtimeMs: info.mtimeMs, size: info.size }
          } catch (error) {
            current = { error: errorText(error) }
          }
        }
        const methods = [
          ...new Set([
            ...Object.keys(clientModules),
            ...Object.getOwnPropertyNames(Object.getPrototypeOf(clientModules)),
          ]),
        ]
        // 检查 clientModules 记录里真正会被 page 拉取的 bundle 内容是否已包含修正后的 guide thunk。
        let bundleGuide = null
        const table = clientModules.table
        if (table !== undefined && typeof table.get === 'function') {
          const record = table.get('dsh-novel-studio')
          if (record !== undefined && record.bundle !== undefined) {
            const text = Buffer.isBuffer(record.bundle) ? record.bundle.toString('utf8') : String(record.bundle)
            const marker = text.indexOf('novel-workbench')
            const guideMarker = text.indexOf('guide: [')
            bundleGuide =
              marker === -1
                ? { found: false, bytes: text.length }
                : {
                    found: true,
                    bytes: text.length,
                    snippet: text.slice(Math.max(0, marker - 260), marker + 280),
                    guideSnippet:
                      guideMarker === -1
                        ? null
                        : text.slice(Math.max(0, guideMarker - 120), guideMarker + 320),
                  }
          }
        }
        return sendJson(res, 200, {
          ok: true,
          rev,
          clientPath,
          baseline,
          current,
          methods,
          bundleGuide,
          entry: entry === undefined ? null : { id: entry.id, url: entry.url, rev: entry.rev },
        })
      }

      if (pathname === '/novel-studio/api/status') {
        if (req.method !== 'GET' && req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'GET only' })
        return sendJson(res, 200, await buildStatusPayload(ctx))
      }

      return sendJson(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      return sendJson(res, Number.isInteger(error && error.status) ? error.status : 500, { ok: false, error: errorText(error) })
    }
  }

  ctx.effect(() => webServer.register({ kind: 'prefix', path: '/novel-studio/api', handler }))
}
