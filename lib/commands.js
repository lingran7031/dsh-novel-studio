// dsh-novel-studio — 写作模式内的斜杠命令。
// 作用域：只在「小说工作室」preset 的 Agent 上可见，不注册全局命令。
// 命令不触发模型回合，直接返回文本结果（查看进度 / 导出整本）。
import { detectProject, exportNovel, projectStatus, readJsonFile } from './core.js'
import { withRevisionLock } from './revisions.js'

export const name = 'novel-commands'

export const inject = ['commands']

async function resolveRoot(ctx, agent, signal) {
  const workingDirectory = ctx.get('workingDirectory')
  if (workingDirectory !== undefined && agent !== undefined) {
    try {
      return await workingDirectory.ensure(agent, signal)
    } catch {
      /* 工作目录服务不可用时，回退到当前进程目录。 */
    }
  }
  return process.cwd()
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
}

function isOpen(status) {
  return !/已回收|已完成|已解决|已关闭|已兑现|已废弃|resolved|closed|done|abandoned/iu.test(String(status ?? '').trim())
}

export function apply(ctx) {
  ctx.effect(() =>
    ctx.commands.register({
      name: 'novel-status',
      description: '查看当前小说项目进度（章数 / 字数 / 阶段 / 伏笔 / 裁定）',
      handler: async (invocation) => {
        try {
          const root = await resolveRoot(ctx, invocation.agent, invocation.signal)
          return await withRevisionLock(root, async (actual) => {
            const detected = await detectProject(actual)
            if (detected.isNovel !== true) return { kind: 'error', text: `当前目录不是小说项目：${actual}` }
            const status = await projectStatus(actual)
            const progress = status.progress ?? {}
            const lines = [
              `【小说工作室】${progress.title || '未命名小说'} · 已定稿 ${status.chapters.length} 章 / 约 ${formatNumber(status.totalChars)} 字`,
              `阶段：${progress.phase || status.state?.stage || '未知'}｜最后完成：第 ${status.lastChapter} 章｜下一章：第 ${status.nextChapter} 章`,
              `摘要 ${status.counts.summaries} · 审阅 ${status.counts.reviews} · 草稿 ${status.counts.drafts} · 裁定 ${status.counts.decisions}`,
            ]
            const foreshadow = await readJsonFile(actual, 'foreshadow_ledger.json', [])
            const open = Array.isArray(foreshadow) ? foreshadow.filter((item) => item !== null && typeof item === 'object' && isOpen(item.status)) : []
            if (open.length > 0) {
              const brief = open
                .slice(0, 6)
                .map((item) => `${item.id ?? '?'} ${String(item.description ?? '').slice(0, 24)}`)
                .join('；')
              lines.push(`未回收伏笔（${open.length}）：${brief}`)
            }
            if (status.missing.length > 0) {
              lines.push(`缺失资料：${status.missing.map((item) => item.file).slice(0, 6).join('、')}`)
            }
            lines.push(`下一章上下文：novel_context chapter=${status.nextChapter}；继续写作可直接说「继续写第 ${status.nextChapter} 章」`)
            return { kind: 'success', text: lines.join('\n') }
          })
        } catch (error) {
          return { kind: 'error', text: String(error && error.message ? error.message : error) }
        }
      },
    }),
  )

  ctx.effect(() =>
    ctx.commands.register({
      name: 'novel-export',
      description: '导出整本小说：/novel-export [md|docx]，默认 Markdown',
      input: { hint: '可选格式：md 或 docx' },
      handler: async (invocation) => {
        try {
          const root = await resolveRoot(ctx, invocation.agent, invocation.signal)
          const format = String(invocation.rawInput ?? '').trim().toLowerCase() === 'docx' ? 'docx' : 'md'
          const result = await withRevisionLock(root, (actual) => exportNovel(actual, { format }))
          const size = result.format === 'docx' ? `${formatNumber(result.bytes)} 字节` : `${formatNumber(result.chars)} 字`
          return {
            kind: 'success',
            text: `已导出 ${result.chapters} 章到 ${result.target}（${result.format}，${size}）`,
          }
        } catch (error) {
          return { kind: 'error', text: String(error && error.message ? error.message : error) }
        }
      },
    }),
  )
}
