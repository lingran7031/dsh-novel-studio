// 右栏导入与改写接口只做会话适配，业务状态与文件提交统一交给版本存储。
import { dispatchRevision, getRevisionOverview, getRevisionComparison, checkedRevisionProjectRoot, withRevisionLock } from './revisions.js'
import { dispatchRewriteAgent, getRewriteDispatchCapability } from './rewrite-runtime.js'
import { readWorkbenchLibrary } from './workbench.js'

const PATHS = new Set(['/novel-studio/api/workflow', '/novel-studio/api/import', '/novel-studio/api/compare', '/novel-studio/api/revision-library'])
const ACTIONS = new Set(['import', 'save_chapters', 'materialize_import', 'create_rewrite', 'save_plan', 'approve_plan', 'pause', 'cancel', 'apply', 'rollback'])
const RUN_ACTIONS = new Set(['run', 'start', 'resume', 'retry'])
const MAX_BODY_BYTES = 32 * 1024 * 1024

function failure(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

// JSON 类型和同源检查共同阻止外部网页借本地接口写入项目。
function verifyMutationOrigin(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] || ''))) {
    throw failure(415, '请使用 application/json 提交导入或改写操作')
  }
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') {
    throw failure(403, '不接受跨站项目修改请求')
  }
  const origin = req.headers.origin
  if (origin !== undefined) {
    try {
      if (new URL(String(origin)).host !== String(req.headers.host || '')) throw new Error('origin')
    } catch {
      throw failure(403, '不接受其他来源的项目修改请求')
    }
  }
}

async function readBody(req) {
  const declaredSize = Number(req.headers['content-length'])
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) throw failure(413, '导入请求超过 32 MiB 上限')
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw failure(413, '导入请求超过 32 MiB 上限')
    chunks.push(buffer)
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
    return parsed
  } catch {
    throw failure(400, '请求正文必须是有效的 JSON 对象')
  }
}

export async function handleWorkflowRequest(ctx, req, url, resolveProjectRoot) {
  if (!PATHS.has(url.pathname)) return undefined
  if (req.method !== 'GET' && (req.method !== 'POST' || url.pathname !== '/novel-studio/api/workflow')) {
    throw failure(405, url.pathname.endsWith('/workflow') ? '仅支持 GET 或 POST' : '仅支持 GET')
  }
  let args
  if (req.method === 'POST') {
    verifyMutationOrigin(req)
    args = await readBody(req)
  }
  const resolved = await resolveProjectRoot(ctx, url, args)
  if (resolved.root === undefined) throw failure(404, 'no-project-root')
  const root = resolved.root
  const sessionId = String(url.searchParams.get('sessionId') || args?.sessionId || resolved.sessionId || '')

  if (req.method === 'GET') {
    if (url.pathname.endsWith('/revision-library')) {
      const kind = url.searchParams.get('kind')
      if (!['original', 'candidate'].includes(kind)) throw failure(400, '资料版本必须是 original 或 candidate')
      // 候选资料按多文件提交，读取时共用正式根目录锁，避免混读不同提交的内容。
      return withRevisionLock(root, async (actual) => {
        const project = await checkedRevisionProjectRoot(actual, url.searchParams.get('rewriteId'), kind)
        const library = await readWorkbenchLibrary(project)
        return { ...library, rewriteId: url.searchParams.get('rewriteId'), kind }
      })
    }
    if (url.pathname.endsWith('/import')) {
      return dispatchRevision(root, { action: 'get_import', importId: url.searchParams.get('importId') })
    }
    if (url.pathname.endsWith('/compare')) {
      return getRevisionComparison(root, { rewriteId: url.searchParams.get('rewriteId'), chapter: url.searchParams.get('chapter') })
    }
    const overview = await getRevisionOverview(root)
    const capability = await getRewriteDispatchCapability(ctx, sessionId)
    return { ...overview, capabilities: { ...capability, dispatch: capability.available === true } }
  }

  const action = String(args.action || '')
  if (action === 'analyze' || action === 'plan' || RUN_ACTIONS.has(action)) {
    if (!sessionId) throw failure(400, '运行分析或改写需要当前会话 sessionId')
    return dispatchRewriteAgent(ctx, {
      sessionId, root, importId: args.importId, rewriteId: args.rewriteId,
      operation: action === 'analyze' ? 'analyze' : action === 'plan' ? 'plan' : 'rewrite',
      resumeAction: RUN_ACTIONS.has(action) ? action : undefined,
    })
  }
  if (!ACTIONS.has(action)) throw failure(400, '未知的导入或改写操作')
  return dispatchRevision(root, args)
}
