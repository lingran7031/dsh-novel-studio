// 小说写作台：概览、单章阅读和资料库共用当前会话的项目上下文。
window.__ModuleLoader__.load({
  id: 'dsh-novel-studio',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'novel-workbench'
    const TYPE_ID = 'dsh-novel-studio/workbench'
    const CATEGORIES = ['premise', 'characters', 'worldRules', 'outline', 'timeline', 'foreshadows', 'relationships', 'compass', 'style', 'summaries', 'reviews', 'decisions', 'continuation']
    const ZH = {
      tabTitle: '写作台', guideDescription: '阅读章节、浏览故事资料，掌握创作进度',
      chapterDirectory: '章节目录', libraryTitle: '故事资料库', categories: '资料分类',
      overview: '概览', chapters: '章节', library: '资料库', loading: '正在读取…', refresh: '刷新', retry: '重试',
      noSession: '打开一个会话，开始你的创作', noSessionHint: '写作台会跟随当前会话，显示这本小说的章节与资料。',
      notNovel: '这里还没有小说项目', notNovelHint: '初始化当前目录，或切换到已有小说的工作区。',
      initPrompt: '请用 novel_project init 初始化当前目录为小说项目，并拉起四个角色开始创作。', init: '复制初始化指令',
      unnamed: '未命名小说', words: '字', totalWords: '总字数', completed: '已定稿', pending: '待定稿', all: '全部',
      openThreads: '未回收伏笔', nextChapter: '下一章', chapterName: '第 {n} 章',
      continueHint: '复制续写指令', continuePrompt: '继续写第 {n} 章：先用 novel_context 取上下文，再按单章循环推进；完成后定稿并归档资料。',
      copied: '已复制', copyFailed: '复制失败，请检查剪贴板权限', copyText: '复制全文',
      exportMd: '导出 Markdown', exportDocx: '导出 DOCX', exporting: '正在导出…', exportedTo: '已导出到', failed: '读取失败',
      latest: '最近章节', viewAll: '查看全部', readLatest: '阅读最新章', read: '打开阅读',
      noChapters: '还没有章节', noChaptersHint: '正文归档到 chapters/ 后，会自动出现在这里。',
      searchChapters: '搜索章号或标题', noResults: '没有找到匹配内容', clearSearch: '清空筛选',
      ascending: '正序', descending: '倒序', backChapters: '返回目录', previous: '上一章', next: '下一章',
      fontSmaller: '缩小字号', fontLarger: '增大字号', fontSize: '字号', reading: '章节阅读',
      searchLibrary: '搜索资料名称或内容', noMaterials: '还没有归档资料', noMaterialsHint: '人物、设定、大纲与章节摘要归档后，会自动显示在资料库。',
      backLibrary: '返回资料库', entries: '条资料', source: '来源', emptyContent: '此文件暂时没有内容',
      premise: '故事前提', characters: '人物', worldRules: '世界设定', outline: '大纲', timeline: '时间线',
      foreshadows: '伏笔', relationships: '人物关系', compass: '故事指南针', style: '文风卡', summaries: '章节摘要',
      reviews: '审阅报告', decisions: '裁定记录', continuation: '续写方案', projectRoot: '项目目录',
      syncHint: '随当前会话自动同步', errorMaterial: '资料读取异常', readError: '内容暂时无法读取',
      timeout: '请求超时，请稍后重试', networkError: '无法连接写作台服务', noProjectRoot: '无法读取当前会话目录，请打开已有工作区的会话后重试。',
      phase_setup: '准备创作', phase_imported: '资料已导入', phase_writing: '创作中',
      phase_reviewing: '审阅中', phase_completed: '已完成', phase_planning: '规划中',
    }
    const EN = {
      tabTitle: 'Writing Desk', guideDescription: 'Read chapters, explore story materials and track progress',
      chapterDirectory: 'Chapter directory', libraryTitle: 'Story library', categories: 'Categories',
      overview: 'Overview', chapters: 'Chapters', library: 'Library', loading: 'Loading…', refresh: 'Refresh', retry: 'Retry',
      noSession: 'Open a session to start', noSessionHint: 'Your chapters and story materials follow the current session.',
      notNovel: 'No novel project here yet', notNovelHint: 'Initialize this folder, or switch to an existing novel workspace.',
      initPrompt: 'Initialize this directory as a novel project with novel_project init and start the four-role team.', init: 'Copy initialization prompt',
      unnamed: 'Untitled novel', words: 'chars', totalWords: 'Characters', completed: 'Finalized', pending: 'Pending', all: 'All',
      openThreads: 'Open threads', nextChapter: 'Next chapter', chapterName: 'Chapter {n}',
      continueHint: 'Copy writing prompt', continuePrompt: 'Write chapter {n}: call novel_context first, then run the chapter loop; finalize and archive when done.',
      copied: 'Copied', copyFailed: 'Copy failed. Check clipboard permissions.', copyText: 'Copy full text',
      exportMd: 'Export Markdown', exportDocx: 'Export DOCX', exporting: 'Exporting…', exportedTo: 'Exported to', failed: 'Failed to read',
      latest: 'Recent chapters', viewAll: 'View all', readLatest: 'Read latest', read: 'Read chapter',
      noChapters: 'No chapters yet', noChaptersHint: 'Chapters appear here once saved in chapters/.',
      searchChapters: 'Search chapter number or title', noResults: 'No matching results', clearSearch: 'Clear filters',
      ascending: 'Ascending', descending: 'Descending', backChapters: 'Back to chapters', previous: 'Previous', next: 'Next',
      fontSmaller: 'Smaller text', fontLarger: 'Larger text', fontSize: 'Text size', reading: 'Chapter reader',
      searchLibrary: 'Search titles and material contents', noMaterials: 'No materials yet', noMaterialsHint: 'Archived characters, settings, outlines and summaries appear here.',
      backLibrary: 'Back to library', entries: 'entries', source: 'Source', emptyContent: 'This file has no content yet',
      premise: 'Premise', characters: 'Characters', worldRules: 'World', outline: 'Outline', timeline: 'Timeline',
      foreshadows: 'Threads', relationships: 'Relationships', compass: 'Compass', style: 'Style', summaries: 'Summaries',
      reviews: 'Reviews', decisions: 'Rulings', continuation: 'Continuation plan', projectRoot: 'Project folder',
      syncHint: 'Synced with the current session', errorMaterial: 'Material read error', readError: 'Content is temporarily unavailable',
      timeout: 'Request timed out. Please retry.', networkError: 'Cannot connect to the writing desk', noProjectRoot: 'Cannot read the session folder. Open a session in a workspace and retry.',
      phase_setup: 'Getting started', phase_imported: 'Imported', phase_writing: 'Writing',
      phase_reviewing: 'Reviewing', phase_completed: 'Completed', phase_planning: 'Planning',
    }
    const WF_ZH = {
      versionKind_import: '原稿导入', versionKind_rewrite: '剧情改写', versionKind_manual: '回退前修改', versionKind_baseline: '采用前快照',
      workflow: '导入改写', workflowTitle: '导入与剧情改写', workflowHint: '保留原稿，在独立候选版本中调整剧情；采用后才会更新正式书稿。',
      importsTab: '导入原稿', rewritesTab: '改写任务', versionsTab: '版本记录', importFile: '选择 TXT / Markdown', pasteManuscript: '粘贴正文', importHint: '支持 UTF-8、GB18030 / GBK。原始文件会单独保存，导入不会立即替换当前书稿。',
      chooseFile: '选择书稿文件', pasteLabel: '书稿正文', pastePlaceholder: '粘贴正文，建议保留“第 N 章”或 Markdown 章节标题。', importSubmit: '导入并预览', importHistory: '已导入的原稿', noImports: '还没有导入原稿', fileTooLarge: '文件超过 16 MiB，请拆分后导入。', fileTypeError: '请选择 .txt 或 .md 书稿文件。',
      importPreview: '切章预览', importChapter: '选择章节', chapterTitle: '章节标题', chapterContent: '章节正文', saveChapters: '保存章节划分', reloadChapters: '放弃未保存校正并重载', splitChapter: '在光标处拆分', mergeNext: '合并下一章', splitHint: '将光标放在正文分界处，再点击拆分。', lastIncomplete: '最后一章尚未写完', completeChapters: '完整章节', unsavedChapters: '章节划分尚未保存，请先保存后分析或采用。',
      analyzeImport: '分析原稿', analyzingHint: '分析由当前会话的小说工作室执行，完成后这里会自动更新。', analysisReady: '资料已分析', analysisNeeded: '待分析原稿', analysisRequired: '请先分析原稿，建立人物、剧情与文风资料，再采用或改写。', materializeImport: '采用为正式书稿', materializeConfirm: '确认采用这份原稿', materializeWarning: '这会将完整章节和原稿资料设为当前正式书稿，替换已有内容；采用前会保存可恢复的版本。未完成的末章不会记为已定稿。',
      confirmAction: '确认执行', keepCurrent: '暂不执行', requestBusy: '正在处理…', requestUnknown: '操作尚未确认，请刷新状态后再决定是否重试。', operationDone: '操作已完成', taskStarted: '任务已提交到当前小说工作室会话，结果会显示在这里。', dispatchUnavailable: '当前会话暂时不能调度小说工作室。请确认已选择小说工作室模式，且会话可用。', sessionBusy: '当前会话正在处理任务，请等待完成后再提交新的模型任务。',
      rewriteSource: '改写来源', currentManuscript: '当前正式书稿', requirements: '想改写什么', requirementsPlaceholder: '例如：保留前八章；第十二章角色 A 由死亡改为失踪，后文动机跟着调整，保持叙事文风。', preserve: '必须保留', preservePlaceholder: '每行一项，例如：人物性格、结局、关键伏笔。', forbidden: '禁止改动', forbiddenPlaceholder: '每行一项，例如：第一至八章、某条人物关系。', rewriteDegree: '改写程度', degree_local: '局部调整', degree_plot: '剧情重构', degree_rebuild: '保留设定重新写', scopeFrom: '从第几章', scopeTo: '到第几章', createRewrite: '建立改写任务', newRewrite: '建立新任务', sourceNotReady: '所选原稿尚未完成分析。', invalidScope: '请填写有效的章节范围，且结束章不小于起始章。', noRewriteSource: '请先导入并分析原稿，或采用一份正式书稿。',
      rewriteHistory: '改写任务', noRewrites: '还没有改写任务', planGenerate: '生成改写方案', planRegenerate: '重新生成方案', planTitle: '改写方案', planImpact: '影响与联动', planRisks: '风险与边界', planChapters: '逐章安排', planApprove: '确认此方案', planApprovedHint: '确认后可连续改写这一批章节；正式书稿在采用前保持原样。', runRewrite: '开始改写', pauseRewrite: '暂停改写', resumeRewrite: '继续改写', retryRewrite: '重试失败步骤', cancelRewrite: '取消此任务', processingChapters: '章节处理进度', compareTitle: '原稿与候选对照', compareOpen: '打开对照阅读', compareBack: '返回改写任务', originalVersion: '原稿', candidateVersion: '候选新版', syncScroll: '同步滚动', pendingCandidate: '此章尚未通过改写审阅，候选内容暂不能视为新版定稿。', changeSummary: '本章摘要', chapterReview: '审阅记录', noCandidate: '候选正文尚未生成', applyRewrite: '采用这一版', applyConfirm: '确认采用候选新版', applyWarning: '这会将通过检查的候选正文、摘要与资料一起设为正式书稿。当前正式版会先保存，之后可以从版本记录恢复。',
      originalMaterials: '原稿资料', candidateMaterials: '候选资料', candidateMaterialsPending: '候选处理中，仅用于检查，不代表已采用。', candidateMaterialsReady: '候选资料已完成检查，采用前仍不会替换正式资料。',
      versionsHint: '恢复版本会同时还原正文、资料、摘要与创作进度。导入原稿和改写候选仍会保留。', noVersions: '还没有可恢复的版本', activeVersion: '当前版本', restoreVersion: '恢复到此版本', restoreConfirm: '确认恢复这个版本', restoreWarning: '这会恢复所选版本的正文、资料、摘要与进度；当前正式稿和手工修改会先保留为一个可恢复版本。', versionTime: '保存时间', reviewPassed: '审阅通过', reviewFailed: '需要修改', changes_rewrite: '改写', changes_check: '联动核查', changes_keep: '保留',
      wfState_imported: '已导入', wfState_analyzing: '分析中', wfState_analyzed: '已分析', wfState_draft_plan: '待生成方案', wfState_planning: '方案生成中', wfState_awaiting_approval: '待确认方案', wfState_ready: '待开始', wfState_running: '改写中', wfState_paused: '已暂停', wfState_failed: '处理失败', wfState_completed: '待采用', wfState_applied: '已采用', wfState_cancelled: '已取消', wfState_pending: '待处理', wfState_processing: '处理中', wfState_passed: '已通过', wfState_kept: '已保留',
    }
    const WF_EN = {
      versionKind_import: 'Imported manuscript', versionKind_rewrite: 'Plot rewrite', versionKind_manual: 'Edits before recovery', versionKind_baseline: 'Pre-adoption snapshot',
      workflow: 'Import', workflowTitle: 'Import and plot rewrite', workflowHint: 'Keep the source intact and work in a separate candidate. The official manuscript changes only when you adopt a version.',
      importsTab: 'Import', rewritesTab: 'Rewrites', versionsTab: 'Versions', importFile: 'Choose TXT / Markdown', pasteManuscript: 'Paste manuscript', importHint: 'UTF-8 and GB18030 / GBK are supported. Original bytes are preserved; importing does not replace the current manuscript.',
      chooseFile: 'Choose manuscript file', pasteLabel: 'Manuscript text', pastePlaceholder: 'Paste the manuscript with chapter headings intact.', importSubmit: 'Import and preview', importHistory: 'Imported manuscripts', noImports: 'No imported manuscripts yet', fileTooLarge: 'The file exceeds 16 MiB. Split it before importing.', fileTypeError: 'Choose a .txt or .md manuscript.',
      importPreview: 'Chapter preview', importChapter: 'Select chapter', chapterTitle: 'Chapter title', chapterContent: 'Chapter text', saveChapters: 'Save chapter layout', reloadChapters: 'Discard unsaved layout and reload', splitChapter: 'Split at cursor', mergeNext: 'Merge next chapter', splitHint: 'Place the cursor at the chapter boundary before splitting.', lastIncomplete: 'The final chapter is unfinished', completeChapters: 'Complete chapters', unsavedChapters: 'Save the chapter layout before analyzing or adopting it.',
      analyzeImport: 'Analyze manuscript', analyzingHint: 'The current Novel Studio session will process this task. Progress updates automatically.', analysisReady: 'Analysis ready', analysisNeeded: 'Analysis needed', analysisRequired: 'Analyze the manuscript first to build characters, plot facts and style materials.', materializeImport: 'Adopt as manuscript', materializeConfirm: 'Adopt this imported manuscript', materializeWarning: 'This replaces the official complete chapters and materials. A recoverable version is saved first. An unfinished final chapter is not marked finalized.',
      confirmAction: 'Confirm', keepCurrent: 'Not now', requestBusy: 'Processing…', requestUnknown: 'The result is not confirmed. Refresh the status before retrying.', operationDone: 'Operation completed', taskStarted: 'Task submitted to the current Novel Studio session. Results appear here.', dispatchUnavailable: 'This session cannot dispatch Novel Studio work right now. Check its preset and availability.', sessionBusy: 'This session is processing a task. Wait before submitting another model task.',
      rewriteSource: 'Rewrite source', currentManuscript: 'Current manuscript', requirements: 'What should change', requirementsPlaceholder: 'For example: keep chapters 1–8, change a death in chapter 12 to a disappearance, update later motivations and preserve the style.', preserve: 'Must preserve', preservePlaceholder: 'One item per line: character traits, ending, important threads.', forbidden: 'Must not change', forbiddenPlaceholder: 'One item per line: chapters 1–8, a particular relationship.', rewriteDegree: 'Rewrite degree', degree_local: 'Local adjustments', degree_plot: 'Plot restructuring', degree_rebuild: 'Rewrite with the same setting', scopeFrom: 'From chapter', scopeTo: 'To chapter', createRewrite: 'Create rewrite task', newRewrite: 'New task', sourceNotReady: 'The selected source has not been analyzed yet.', invalidScope: 'Enter a valid chapter range with the end after or equal to the start.', noRewriteSource: 'Import and analyze a manuscript, or adopt an official manuscript first.',
      rewriteHistory: 'Rewrite tasks', noRewrites: 'No rewrite tasks yet', planGenerate: 'Generate rewrite plan', planRegenerate: 'Regenerate plan', planTitle: 'Rewrite plan', planImpact: 'Impacts and dependencies', planRisks: 'Risks and boundaries', planChapters: 'Chapter plan', planApprove: 'Approve this plan', planApprovedHint: 'Approved chapters can run continuously. The official manuscript stays intact until adoption.', runRewrite: 'Start rewrite', pauseRewrite: 'Pause', resumeRewrite: 'Continue rewrite', retryRewrite: 'Retry failed step', cancelRewrite: 'Cancel task', processingChapters: 'Chapter progress', compareTitle: 'Source and candidate', compareOpen: 'Compare versions', compareBack: 'Back to task', originalVersion: 'Original', candidateVersion: 'Candidate', syncScroll: 'Sync scrolling', pendingCandidate: 'This chapter has not passed rewrite review. Its candidate is not a finalized revision.', changeSummary: 'Chapter summary', chapterReview: 'Review record', noCandidate: 'Candidate text has not been generated yet', applyRewrite: 'Adopt this version', applyConfirm: 'Adopt the candidate version', applyWarning: 'This adopts the reviewed candidate chapters, summaries and materials together. The current version is saved for recovery.',
      originalMaterials: 'Original materials', candidateMaterials: 'Candidate materials', candidateMaterialsPending: 'This candidate is in progress and is for review only. It has not been adopted.', candidateMaterialsReady: 'Candidate materials passed review. They do not replace official materials until adoption.',
      versionsHint: 'Recovery restores chapters, materials, summaries and writing progress together. Sources and candidates are preserved.', noVersions: 'No recoverable versions yet', activeVersion: 'Current version', restoreVersion: 'Restore this version', restoreConfirm: 'Restore this saved version', restoreWarning: 'This restores the selected chapters, materials, summaries and progress. The current manuscript and manual edits are saved as a recoverable version first.', versionTime: 'Saved at', reviewPassed: 'Review passed', reviewFailed: 'Changes needed', changes_rewrite: 'Rewrite', changes_check: 'Dependency check', changes_keep: 'Keep',
      wfState_imported: 'Imported', wfState_analyzing: 'Analyzing', wfState_analyzed: 'Analyzed', wfState_draft_plan: 'Plan needed', wfState_planning: 'Planning', wfState_awaiting_approval: 'Plan approval needed', wfState_ready: 'Ready', wfState_running: 'Rewriting', wfState_paused: 'Paused', wfState_failed: 'Failed', wfState_completed: 'Ready to adopt', wfState_applied: 'Adopted', wfState_cancelled: 'Cancelled', wfState_pending: 'Pending', wfState_processing: 'Processing', wfState_passed: 'Passed', wfState_kept: 'Kept',
    }
    const FIELD_LABELS = {
      reason: '原因', change: '处理方式', sourceChapter: '出处章节', affectedChapters: '影响章节', severity: '级别', message: '说明', checks: '检查项',
      name: '名称', role: '角色', description: '描述', background: '背景', goal: '目标', personality: '性格', status: '状态',
      category: '分类', id: '编号', chapter: '章节', chapters: '相关章节', time: '时间', event: '事件', characters: '相关人物',
      character_a: '人物一', character_b: '人物二', relation: '关系', title: '标题', volume: '卷', arc: '故事弧',
      volumes: '分卷', arcs: '故事弧', children: '内容', summary: '摘要', content: '内容', note: '备注', notes: '备注',
      final_direction: '结局方向', active_threads: '进行中的线索', scale_estimate: '篇幅预估', updated_at: '更新时间',
      source: '出处', sources: '出处', evidence: '依据', conflict: '冲突', resolution: '解决方案', stakes: '风险',
      start_chapter: '起始章节', end_chapter: '结束章节', chapter_count: '章节数', target_chapters: '目标章节',
    }
    const ICONS = {
      book: 'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3z',
      grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
      library: 'M4 4v16 M9 4v16 M14 4v16 M18 5l3 14',
      search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
      refresh: 'M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 13 3 M18 18A8 8 0 0 1 5 15',
      arrow: 'M5 12h14 M13 6l6 6-6 6', back: 'M19 12H5 M11 6l-6 6 6 6',
      copy: 'M9 9h11v11H9z M5 15H3V3h12v2', download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
      file: 'M5 3h9l5 5v13H5z M14 3v6h5',
      folder: 'M3 6h6l2 2h10v12H3z', sort: 'M4 6h16 M4 12h10 M4 18h5',
    }
    const CSS = `
      .nw {
        --nw-bg: var(--dsw-alias-bg-base, #fff);
        --nw-canvas: var(--dsw-alias-bg-module-platform, #f7f8fa);
        --nw-surface: var(--dsw-alias-bg-layer-1, #fff);
        --nw-text: var(--dsw-alias-label-primary, #20252e);
        --nw-muted: color-mix(in srgb, var(--nw-text) 66%, var(--nw-bg));
        --nw-line: var(--dsw-alias-border-l3, rgba(30, 40, 55, .13));
        --nw-soft-line: color-mix(in srgb, var(--nw-text) 8%, var(--nw-bg));
        --nw-accent: color-mix(in srgb, var(--dsw-alias-state-business-primary, #3565c5) 88%, var(--nw-text));
        --nw-accent-text: var(--dsw-alias-label-primary-foreground, #fff);
        --nw-selected: color-mix(in srgb, var(--nw-accent) 9%, var(--nw-bg));
        --nw-success: color-mix(in srgb, var(--dsw-alias-state-success-primary, #23734d) 60%, var(--nw-text));
        --nw-space: 24px;
        display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0;
        container-type: inline-size; overflow: hidden; background: var(--nw-canvas); color: var(--nw-text);
        font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif);
        font-size: 14px; line-height: 1.6; text-align: start;
      }
      .nw *, .nw *::before, .nw *::after { box-sizing: border-box; }
      .nw ::selection { color: var(--nw-text); background: color-mix(in srgb, var(--nw-accent) 22%, var(--nw-bg)); }
      .nw :where(button, input, textarea, select) { font: inherit; }
      .nw :where(button) { color: inherit; cursor: pointer; transition: background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out; }
      .nw button:disabled { opacity: .45; cursor: default; }
      .nw button:focus-visible, .nw input:focus-visible { outline: 2px solid var(--nw-accent); outline-offset: 3px; }
      .nw svg { display: inline-block; flex-shrink: 0; vertical-align: middle; }
      .nw h1, .nw h2, .nw h3, .nw p { margin: 0; }
      .nw button:hover:not(:disabled) { background-color: var(--nw-selected); }
      .nw button:active:not(:disabled) { background-color: color-mix(in srgb, var(--nw-accent) 14%, var(--nw-bg)); }
      .nw-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px var(--nw-space) 8px; flex-shrink: 0; background: var(--nw-bg); }
      .nw-brand { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 650; letter-spacing: .01em; }
      .nw-brand svg { color: var(--nw-text); }
      .nw-muted { color: var(--nw-muted); font-size: 12px; }
      .nw-icon { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 34px; height: 34px; padding: 5px; border: 1px solid transparent; border-radius: 6px; background: transparent; }
      .nw-tabs { display: flex; align-items: center; gap: 24px; padding: 0 var(--nw-space); border-bottom: 1px solid var(--nw-line); flex-shrink: 0; background: var(--nw-bg); }
      .nw-tab { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 10px 4px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--nw-muted); white-space: nowrap; font-size: 14px; }
      .nw-tab[aria-selected=true] { border-bottom-color: var(--nw-accent); color: var(--nw-accent); font-weight: 600; }
      .nw-count { font-size: 12px; font-weight: 450; font-variant-numeric: tabular-nums; }
      .nw-tab .nw-count { min-width: 20px; padding: 0 5px; border-radius: 4px; background: var(--nw-canvas); }
      .nw-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; }
      .nw-scroll { flex: 1; min-height: 0; min-width: 0; overflow: auto; padding: var(--nw-space); scrollbar-width: thin; scrollbar-color: var(--nw-line) transparent; scrollbar-gutter: stable both-edges; }
      .nw-container { width: 100%; max-width: 1060px; margin-inline: auto; }
      .nw-book { padding-bottom: 24px; }
      .nw-book-heading { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
      .nw-title { font-size: 28px; line-height: 1.4; font-weight: 650; letter-spacing: -.02em; overflow-wrap: anywhere; }
      .nw-path { display: flex; align-items: center; gap: 6px; max-width: 100%; color: var(--nw-muted); font-size: 12px; }
      .nw-path span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .nw-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 7px; border-radius: 4px; background: var(--nw-canvas); color: var(--nw-muted); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
      .nw-phase { background: color-mix(in srgb, var(--nw-success) 9%, var(--nw-bg)); color: var(--nw-success); font-weight: 500; }
      .nw-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; padding: 16px 0; border-block: 1px solid var(--nw-line); margin-bottom: 24px; }
      .nw-stat { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-wrap: wrap; }
      .nw-stat strong { font-size: 19px; line-height: 1.4; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .nw-stat span { color: var(--nw-muted); font-size: 12px; }
      .nw-next { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 20px; margin-bottom: 32px; border: 1px solid var(--nw-line); border-radius: 8px; background: var(--nw-surface); }
      .nw-next-title { font-weight: 600; font-size: 17px; line-height: 1.5; }
      .nw-next-title span { color: var(--nw-muted); font-size: 13px; font-weight: 400; margin-right: 10px; }
      .nw-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .nw-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 7px 12px; border: 1px solid var(--nw-line); border-radius: 6px; background: var(--nw-bg); font-size: 13px; line-height: 1.5; }
      .nw-primary { background: var(--dsw-alias-button-primary-fill, var(--nw-text)); color: var(--nw-accent-text); border-color: transparent; font-weight: 500; }
      .nw .nw-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, color-mix(in srgb, var(--nw-text) 86%, var(--nw-bg))); border-color: transparent; }
      .nw .nw-primary:active:not(:disabled) { background: var(--dsw-alias-button-primary-fill, var(--nw-text)); color: var(--nw-accent-text); }
      .nw-overview-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 32px; align-items: start; }
      .nw-overview-main, .nw-overview-aside { min-width: 0; }
      .nw-section { margin-bottom: 28px; }
      .nw-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 28px; margin-bottom: 12px; }
      .nw-section-head h3 { font-size: 15px; font-weight: 600; letter-spacing: .01em; }
      .nw-link { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 32px; border: 0; border-radius: 4px; padding: 4px 2px; background: transparent; color: var(--nw-muted); font-size: 12px; white-space: nowrap; }
      .nw-link:hover:not(:disabled) { color: var(--nw-accent); }
      .nw-chapter-list { overflow: hidden; border: 1px solid var(--nw-line); border-radius: 8px; background: var(--nw-surface); }
      .nw-chapter { display: flex; align-items: center; gap: 16px; width: 100%; min-height: 76px; padding: 16px; text-align: start; border: 0; border-bottom: 1px solid var(--nw-soft-line); background: transparent; }
      .nw-chapter:last-child { border-bottom: 0; }
      .nw-number { display: inline-flex; align-items: center; justify-content: center; width: 32px; flex-shrink: 0; color: var(--nw-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
      .nw-chapter-main { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 16px; flex: 1; min-width: 0; }
      .nw-chapter-title { font-size: 15px; font-weight: 500; overflow-wrap: anywhere; }
      .nw-chapter-meta { display: inline-flex; align-items: center; justify-content: flex-end; gap: 12px; color: var(--nw-muted); font-size: 12px; white-space: nowrap; }
      .nw-done { color: var(--nw-success); }
      .nw-chevron { color: var(--nw-muted); }
      .nw-material-grid { border-top: 1px solid var(--nw-line); }
      .nw-material-link { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 46px; padding: 10px 2px; border: 0; border-bottom: 1px solid var(--nw-line); background: transparent; text-align: start; font-size: 14px; }
      .nw-material-link span:last-child { color: var(--nw-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
      .nw-thread { padding: 12px 0; border-bottom: 1px solid var(--nw-line); font-size: 13px; line-height: 1.8; }
      .nw-thread small { display: block; color: var(--nw-muted); font-size: 12px; margin-bottom: 5px; }
      .nw-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-top: 20px; border-top: 1px solid var(--nw-line); }
      .nw-sync { display: inline-flex; align-items: center; gap: 6px; color: var(--nw-muted); font-size: 12px; }
      .nw-sync-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--nw-success); }
      .nw-page-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
      .nw-page-heading h2 { font-size: 22px; line-height: 1.5; font-weight: 600; letter-spacing: -.02em; }
      .nw-tools { flex-shrink: 0; padding: 24px var(--nw-space) 16px; }
      .nw-search { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 8px 12px; border: 1px solid var(--nw-line); border-radius: 6px; background: var(--nw-bg); color: var(--nw-muted); }
      .nw-search input { min-width: 0; width: 100%; padding: 0; color: var(--nw-text); background: transparent; border: 0; outline: none; font-size: 13px; line-height: 1.6; caret-color: var(--nw-accent); }
      .nw-search input::placeholder { color: var(--nw-muted); opacity: 1; }
      .nw-search:focus-within { border-color: var(--nw-accent); outline: 2px solid var(--nw-selected); }
      .nw-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
      .nw-chip { display: inline-flex; align-items: center; gap: 8px; min-height: 34px; padding: 5px 10px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--nw-muted); font-size: 13px; text-align: start; }
      .nw-chip[aria-pressed=true] { background: var(--nw-selected); color: var(--nw-accent); font-weight: 500; }
      .nw-sort { margin-left: auto; border-color: var(--nw-line); background: var(--nw-bg); }
      .nw-list-scroll { padding-top: 0; }
      .nw-list-summary { margin: 0 0 12px; color: var(--nw-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
      .nw-library-layout { display: flex; flex: 1; min-width: 0; min-height: 0; }
      .nw-library-nav { display: flex; flex-direction: column; gap: 4px; width: 172px; flex-shrink: 0; overflow: auto; padding: 24px 12px; border-right: 1px solid var(--nw-line); background: var(--nw-bg); scrollbar-width: thin; }
      .nw-library-nav-title { color: var(--nw-muted); font-size: 12px; margin: 0 10px 10px; }
      .nw-library-nav .nw-chip { justify-content: space-between; min-height: 38px; }
      .nw-library-main { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
      .nw-library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 16px; }
      .nw-library-card { display: flex; flex-direction: column; align-items: stretch; gap: 12px; width: 100%; min-height: 172px; padding: 18px; border: 1px solid var(--nw-line); border-radius: 8px; background: var(--nw-surface); text-align: start; }
      .nw-library-card:hover:not(:disabled) { border-color: color-mix(in srgb, var(--nw-accent) 45%, var(--nw-line)); }
      .nw-card-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: var(--nw-muted); }
      .nw-library-card strong { display: block; color: var(--nw-text); font-size: 16px; font-weight: 600; line-height: 1.55; overflow-wrap: anywhere; }
      .nw-preview { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; color: var(--nw-muted); font-size: 13px; line-height: 1.75; overflow-wrap: anywhere; }
      .nw-card-error { border-color: var(--dsw-alias-state-warn-primary, #a36e20); }
      .nw-reader-head { flex-shrink: 0; padding: 16px var(--nw-space); border-bottom: 1px solid var(--nw-line); background: var(--nw-bg); }
      .nw-reader-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 10px; }
      .nw-back { display: inline-flex; align-items: center; gap: 7px; min-height: 32px; padding: 4px 0; border: 0; background: transparent; color: var(--nw-muted); font-size: 13px; }
      .nw-reader { padding: 36px var(--nw-space) 48px; background: var(--nw-bg); overflow-wrap: anywhere; user-select: text; line-height: 2; }
      .nw-reading-column { width: 100%; max-width: 42rem; margin-inline: auto; }
      .nw-reader h1 { margin: 0 0 1.5em; font-size: 1.4em; line-height: 1.6; font-weight: 650; letter-spacing: -.015em; }
      .nw-reader h2 { margin: 1.6em 0 .7em; font-size: 1.2em; line-height: 1.6; }
      .nw-reader h3, .nw-reader h4 { margin: 1.5em 0 .6em; font-size: 1.08em; }
      .nw-reader p { margin: 0 0 1.25em; white-space: pre-wrap; }
      .nw-reader ul, .nw-reader ol { margin: 0 0 1.25em; padding-left: 1.5em; }
      .nw-reader blockquote { margin: 1.4em 0; padding: 12px 16px; border-left: 1px solid var(--nw-line); background: var(--nw-canvas); color: var(--nw-muted); white-space: pre-wrap; font-size: .95em; }
      .nw-reader pre, .nw-raw { padding: 16px; border-radius: 6px; background: var(--nw-canvas); white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.8 monospace; }
      .nw-reader hr { margin: 2em 0; border: 0; border-top: 1px solid var(--nw-line); }
      .nw-reader-nav { flex-shrink: 0; padding: 12px var(--nw-space); border-top: 1px solid var(--nw-line); background: var(--nw-bg); }
      .nw-reader-nav .nw-reading-column { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .nw-reader .nw-detail-title { margin: 0 0 10px; font-size: 26px; }
      .nw-detail-source { margin-bottom: 28px; color: var(--nw-muted); font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
      .nw-fields { margin: 0; font-size: 15px; line-height: 1.9; }
      .nw-field { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 20px; padding: 16px 0; border-bottom: 1px solid var(--nw-line); }
      .nw-field dt { color: var(--nw-muted); font-size: 13px; }
      .nw-field dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
      .nw-fields .nw-fields { padding-left: 12px; border-left: 1px solid var(--nw-line); }
      .nw-fields .nw-fields .nw-field { display: block; }
      .nw-fields .nw-fields dt { margin-bottom: 6px; }
      .nw-field:last-child { border-bottom: 0; }
      .nw-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; max-width: 440px; margin-inline: auto; padding: 56px 24px; color: var(--nw-muted); text-align: center; font-size: 14px; }
      .nw-empty-mark { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 10px; background: var(--nw-bg); border: 1px solid var(--nw-line); color: var(--nw-muted); margin-bottom: 4px; }
      .nw-empty strong { color: var(--nw-text); font-size: 17px; font-weight: 600; }
      .nw-empty p { white-space: pre-wrap; overflow-wrap: anywhere; }
      .nw-notice { flex-shrink: 0; padding: 10px var(--nw-space); border-bottom: 1px solid var(--nw-line); background: var(--nw-selected); color: var(--nw-text); font-size: 13px; overflow-wrap: anywhere; }
      .nw-error { margin-bottom: 16px; padding: 12px; border: 1px solid var(--nw-line); border-radius: 6px; background: var(--nw-bg); color: var(--nw-text); font-size: 13px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
      .nw-skeleton { display: grid; gap: 18px; width: 100%; padding: 24px; }
      .nw-skeleton span { display: block; height: 16px; border-radius: 4px; background: var(--nw-soft-line); }
      .nw-skeleton span:first-child { height: 28px; width: 56%; margin-bottom: 12px; }
      .nw-skeleton span:last-child { width: 72%; }
      @container (min-width: 1100px) { .nw-panel { --nw-space: 32px; } .nw-head, .nw-tabs { padding-inline: max(32px, calc((100cqw - 1060px) / 2)); } }
      @container (max-width: 860px) { .nw-overview-layout { grid-template-columns: minmax(0, 1fr); gap: 0; } .nw-overview-aside { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; } .nw-chapter-main { grid-template-columns: minmax(0, 1fr); gap: 5px; } .nw-chapter-meta { justify-content: flex-start; } .nw-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @container (max-width: 680px) { .nw-library-layout { flex-direction: column; } .nw-library-nav { flex-direction: row; gap: 6px; width: 100%; overflow-x: auto; padding: 12px var(--nw-space); border-right: 0; border-bottom: 1px solid var(--nw-line); } .nw-library-nav .nw-chip { flex-shrink: 0; white-space: nowrap; min-height: 34px; } .nw-library-nav-title { display: none; } .nw-tabs { gap: 12px; } .nw-tab { flex: 1; } }
      @container (max-width: 440px) { .nw-head { padding-inline: 16px; } .nw-tabs { padding-inline: 16px; gap: 8px; } .nw-scroll, .nw-tools, .nw-reader-head, .nw-reader-nav { padding-left: 16px; padding-right: 16px; } .nw-library-nav { padding-inline: 16px; } .nw-overview-aside { display: block; } .nw-title { font-size: 24px; } .nw-next { padding: 16px; margin-bottom: 24px; } .nw-next .nw-row { width: 100%; } .nw-chapter { gap: 8px; padding: 14px 10px; } .nw-chapter-title { font-size: 14px; } .nw-number { width: 26px; } .nw-field { display: block; padding-block: 14px; } .nw-field dt { margin-bottom: 6px; } .nw-reader { padding-top: 28px; } .nw-detail-title { font-size: 23px; } .nw-page-heading { margin-bottom: 16px; } .nw-page-heading h2 { font-size: 20px; } .nw-next-title span { display: block; margin-bottom: 4px; } }
      @container (max-width: 280px) { .nw-tab svg { display: none; } .nw-tabs { gap: 4px; } .nw-btn { padding-inline: 9px; } .nw-chapter-meta { gap: 8px; flex-wrap: wrap; white-space: normal; } .nw-stat { gap: 4px; } .nw-stats { gap: 12px; } .nw-reader-actions .nw-row { gap: 4px; } }
      .nw-tabs { overflow-x: auto; scrollbar-width: thin; }
      .nw-workflow-heading { margin-bottom: 20px; }
      .nw-workflow-heading h2 { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
      .nw-workflow-heading p { color: var(--nw-muted); font-size: 13px; max-width: 68ch; }
      .nw-workflow-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
      .nw-workflow-nav .nw-chip { border-color: var(--nw-line); background: var(--nw-bg); }
      .nw-workflow-nav .nw-chip[aria-pressed=true] { background: var(--nw-selected); border-color: var(--nw-accent); }
      .nw-workflow-card { padding: 20px; margin-bottom: 24px; border: 1px solid var(--nw-line); border-radius: 8px; background: var(--nw-surface); min-width: 0; }
      .nw-workflow-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
      .nw-workflow-card > p { margin-bottom: 16px; color: var(--nw-muted); font-size: 13px; }
      .nw-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-block: 16px; }
      .nw-form-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; font-size: 13px; }
      .nw-form-field > span:first-child { font-weight: 500; }
      .nw-form-wide { grid-column: 1 / -1; }
      .nw .nw-input, .nw .nw-textarea, .nw .nw-select { display: block; width: 100%; min-width: 0; padding: 9px 11px; border: 1px solid var(--nw-line); border-radius: 6px; background: var(--nw-bg); color: var(--nw-text); font: inherit; font-size: 13px; line-height: 1.7; caret-color: var(--nw-accent); }
      .nw .nw-input:focus, .nw .nw-textarea:focus, .nw .nw-select:focus { border-color: var(--nw-accent); outline: 2px solid var(--nw-selected); }
      .nw .nw-textarea { resize: vertical; min-height: 104px; }
      .nw .nw-source-text { min-height: 220px; }
      .nw-file-input { font-size: 13px; max-width: 100%; }
      .nw-checkbox { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--nw-muted); }
      .nw-checkbox input, .nw-workflow-card progress { accent-color: var(--nw-accent); }
      .nw-workflow-note { margin-block: 12px; color: var(--nw-muted); font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; }
      .nw-inline-confirm { padding: 16px; margin-top: 16px; border: 1px solid var(--nw-accent); border-radius: 7px; background: var(--nw-selected); }
      .nw-inline-confirm strong { font-size: 14px; }
      .nw-inline-confirm p { margin-block: 8px 12px; font-size: 13px; line-height: 1.8; }
      .nw-task-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 10px; margin-bottom: 20px; }
      .nw-task-choice { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; min-width: 0; text-align: start; padding: 12px; border: 1px solid var(--nw-line); border-radius: 6px; background: var(--nw-bg); }
      .nw-task-choice[aria-pressed=true] { background: var(--nw-selected); border-color: var(--nw-accent); }
      .nw-task-choice strong { font-size: 14px; overflow-wrap: anywhere; }
      .nw-task-choice small { color: var(--nw-muted); font-size: 12px; }
      .nw-progress-line { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-block: 16px 8px; }
      .nw-workflow-card progress { width: 100%; height: 10px; margin-bottom: 16px; }
      .nw-task-chapters { display: grid; gap: 0; margin-block: 12px 16px; }
      .nw-task-chapter { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-block: 10px; border-bottom: 1px solid var(--nw-line); font-size: 13px; }
      .nw-task-chapter > span:first-child { min-width: 0; overflow-wrap: anywhere; }
      .nw-task-chapter .nw-badge { flex-shrink: 0; }
      .nw-workflow-details { margin-block: 14px; }
      .nw-workflow-details summary { cursor: pointer; font-size: 14px; font-weight: 500; padding-block: 8px; }
      .nw-plan-row { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 12px; padding-block: 12px; border-bottom: 1px solid var(--nw-line); font-size: 13px; }
      .nw-plan-row p { margin-top: 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
      .nw-version-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-block: 16px; border-bottom: 1px solid var(--nw-line); }
      .nw-version-row > div:first-child { min-width: 0; }
      .nw-version-row strong { display: block; overflow-wrap: anywhere; }
      .nw-version-row small { color: var(--nw-muted); font-size: 12px; }
      .nw-compare-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
      .nw-compare-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-block: 16px; }
      .nw-compare-pane { min-width: 0; border: 1px solid var(--nw-line); border-radius: 8px; background: var(--nw-bg); overflow: hidden; }
      .nw-compare-pane h3 { margin: 0; padding: 12px 16px; border-bottom: 1px solid var(--nw-line); font-size: 14px; font-weight: 600; }
      .nw-compare-body { padding: 20px; max-height: 64vh; overflow: auto; scrollbar-width: thin; scrollbar-gutter: stable; font-size: 15px; line-height: 1.95; overflow-wrap: anywhere; }
      .nw-compare-body h1 { font-size: 20px; margin: 0 0 22px; line-height: 1.6; }
      .nw-compare-body h2, .nw-compare-body h3 { font-size: 17px; margin-block: 20px 10px; padding: 0; border: 0; }
      .nw-compare-body p { white-space: pre-wrap; margin-bottom: 20px; }
      .nw-compare-switch { display: none; }
      @container (max-width: 760px) { .nw-form-grid { grid-template-columns: minmax(0, 1fr); } .nw-compare-grid { grid-template-columns: minmax(0, 1fr); } .nw-compare-switch { display: flex; gap: 8px; } .nw-compare-grid[data-mode=original] .nw-compare-pane[data-version=candidate], .nw-compare-grid[data-mode=candidate] .nw-compare-pane[data-version=original] { display: none; } }
      @container (max-width: 440px) { .nw-tab { font-size: 12px; gap: 5px; } .nw-tab svg { display: none; } .nw-workflow-card { padding: 16px; } .nw-plan-row { grid-template-columns: minmax(0, 1fr); gap: 4px; } .nw-compare-body { padding: 16px; } .nw-task-chapter { gap: 8px; } }
      @container (max-width: 280px) { .nw-tab .nw-count { display: none; } .nw-tab { font-size: 11px; } }
      @media (prefers-reduced-motion: reduce) { .nw button { transition: none; } }
    `

    function icon(name, size = 16) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: ICONS[name] || ICONS.file }))
    }
    function number(value) { return new Intl.NumberFormat().format(Number(value) || 0) }
    function chapterName(t, n) { return t('chapterName').replace('{n}', String(n)) }
    function errorText(error, t) {
      const value = String(error && error.message ? error.message : error)
      return value === 'no-project-root' ? t('noProjectRoot') : value === 'request-timeout' ? t('timeout') : value === 'Failed to fetch' ? t('networkError') : value
    }
    function useTranslate(ctx) {
      React.useSyncExternalStore((change) => ctx.locale.subscribe(change), () => ctx.locale.getSnapshot())
      return ctx.locale.bind(NS)
    }

    // 以请求地址隔离数据；取消旧请求，避免切换会话或章节时显示前一本书的结果。
    function useResource(url, interval = 0, revision = 0, enabled = true) {
      const [state, setState] = React.useState({ url, data: null, error: '', loading: !!url })
      React.useEffect(() => {
        if (!enabled) return
        if (!url) { setState({ url, data: null, error: '', loading: false }); return }
        let alive = true
        let pending = false
        let controller
        let timeout
        setState((old) => ({ url, data: old.url === url ? old.data : null, error: '', loading: true }))
        const load = async () => {
          if (pending) return
          pending = true
          controller = new AbortController()
          let timedOut = false
          timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 15000)
          try {
            const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal })
            const data = await response.json()
            if (!response.ok || !data || data.ok !== true) {
              const error = new Error(data && data.error || 'HTTP ' + response.status)
              error.status = response.status
              throw error
            }
            if (alive) setState({ url, data, error: '', loading: false })
          } catch (error) {
            // 上下文明确失效时清空旧项目；短暂网络失败则保留已加载的内容。
            const invalid = error.message === 'no-project-root' || (error.status >= 400 && error.status < 500 && error.status !== 429)
            if (alive) setState((old) => ({ url, data: !invalid && old.url === url ? old.data : null, error: timedOut ? 'request-timeout' : String(error.message || error), loading: false }))
          } finally {
            window.clearTimeout(timeout)
            pending = false
          }
        }
        load()
        const timer = interval ? window.setInterval(() => { if (document.visibilityState === 'visible') load() }, interval) : 0
        return () => { alive = false; window.clearInterval(timer); window.clearTimeout(timeout); if (controller) controller.abort() }
      }, [url, interval, revision, enabled])
      return state.url === url ? state : { url, data: null, error: '', loading: !!url }
    }
    function button(label, onClick, options = {}) {
      return h('button', { type: 'button', className: 'nw-btn', onClick, ...options }, label)
    }
    function empty(t, title, hint, action, mark = 'book') {
      if (title === t('loading')) return h('div', { className: 'nw-skeleton', role: 'status', 'aria-label': title }, ...Array.from({ length: 6 }, (_, key) => h('span', { key, 'aria-hidden': true })))
      return h('div', { className: 'nw-empty' }, h('div', { className: 'nw-empty-mark' }, icon(mark, 23)), h('strong', null, title), hint ? h('p', null, hint) : null, action)
    }
    function searchBox(value, onChange, placeholder) {
      return h('label', { className: 'nw-search' }, icon('search', 14), h('input', { type: 'search', value, onChange: (event) => onChange(event.target.value), placeholder, 'aria-label': placeholder }))
    }
    function sectionHead(title, label, onClick) {
      return h('div', { className: 'nw-section-head' }, h('h3', null, title), label ? h('button', { type: 'button', className: 'nw-link', onClick }, label, icon('arrow', 12)) : null)
    }
    function ChapterRow({ chapter, t, onOpen }) {
      return h('button', { type: 'button', className: 'nw-chapter', onClick: () => onOpen(chapter.n), 'aria-label': t('read') + ' · ' + (chapter.title || chapterName(t, chapter.n)) },
        h('span', { className: 'nw-number' }, String(chapter.n).padStart(2, '0')),
        h('span', { className: 'nw-chapter-main' }, h('span', { className: 'nw-chapter-title', title: chapter.title }, chapter.title || chapterName(t, chapter.n)),
          h('span', { className: 'nw-chapter-meta' }, h('span', { className: chapter.completed ? 'nw-done' : '' }, chapter.completed ? t('completed') : t('pending')), h('span', null, number(chapter.chars) + ' ' + t('words')))),
        h('span', { className: 'nw-chevron' }, icon('arrow', 13)))
    }

    // 仅渲染文本和常用 Markdown 块，不执行资料中的 HTML 或脚本。
    function Markdown({ content }) {
      const lines = String(content || '').replace(/\r\n/g, '\n').split('\n')
      const blocks = []
      const fence = String.fromCharCode(96).repeat(3)
      for (let i = 0; i < lines.length;) {
        const line = lines[i]
        if (!line.trim()) { i++; continue }
        if (line.startsWith(fence)) {
          const text = []
          i++
          while (i < lines.length && !lines[i].startsWith(fence)) text.push(lines[i++])
          i++
          blocks.push(h('pre', { key: blocks.length }, text.join('\n')))
          continue
        }
        const heading = /^(#{1,6})\s+(.+)$/.exec(line)
        if (heading) { blocks.push(h('h' + Math.min(heading[1].length, 4), { key: blocks.length }, heading[2])); i++; continue }
        if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { blocks.push(h('hr', { key: blocks.length })); i++; continue }
        if (/^\s*>/.test(line)) {
          const text = []
          while (i < lines.length && /^\s*>/.test(lines[i])) text.push(lines[i++].replace(/^\s*>\s?/, ''))
          blocks.push(h('blockquote', { key: blocks.length }, text.join('\n')))
          continue
        }
        if (/^\s*(?:[-*+] |\d+[.)] )/.test(line)) {
          const ordered = /^\s*\d/.test(line)
          const items = []
          while (i < lines.length && /^\s*(?:[-*+] |\d+[.)] )/.test(lines[i])) items.push(h('li', { key: items.length }, lines[i++].replace(/^\s*(?:[-*+] |\d+[.)] )/, '')))
          blocks.push(h(ordered ? 'ol' : 'ul', { key: blocks.length }, ...items))
          continue
        }
        const text = [lines[i++]]
        while (i < lines.length && lines[i].trim() && !lines[i].startsWith(fence) && !/^(?:#{1,6}\s|\s*>|\s*[-*+] |\s*\d+[.)] )/.test(lines[i])) text.push(lines[i++])
        blocks.push(h('p', { key: blocks.length }, text.join('\n')))
      }
      return h(React.Fragment, null, ...blocks)
    }
    function fieldsView(value, chinese, depth = 0) {
      if (value === null || value === undefined) return '—'
      if (typeof value !== 'object') return String(value)
      if (depth >= 8) return h('pre', { className: 'nw-raw' }, JSON.stringify(value, null, 2))
      if (Array.isArray(value) && value.every((item) => item === null || typeof item !== 'object')) return value.map((item) => String(item ?? '—')).join('、') || '—'
      return h('dl', { className: 'nw-fields' }, ...Object.entries(value).map(([key, item]) => h('div', { key, className: 'nw-field' },
        h('dt', null, Array.isArray(value) ? '#' + (Number(key) + 1) : chinese ? FIELD_LABELS[key] || key : key.replace(/_/g, ' ')), h('dd', null, fieldsView(item, chinese, depth + 1)))))
    }
    function materialText(item) { return item.content || (item.fields ? JSON.stringify(item.fields, null, 2) : '') }

    function Overview({ t, data, openChapter, openLibrary, setTab, copy, exportBook, busy }) {
      const chapters = data.chapters || []
      const counts = data.materials || {}
      const stats = [
        [t('chapters'), chapters.length],
        [t('completed'), chapters.filter((item) => item.completed).length],
        [t('totalWords'), data.totalChars],
        [t('openThreads'), data.openForeshadowCount ?? (data.openForeshadow || []).length],
      ]
      const phaseKey = 'phase_' + data.phase
      const phaseLabel = t(phaseKey)
      return h('div', { className: 'nw-scroll nw-overview' }, h('div', { className: 'nw-container' },
        h('div', { className: 'nw-book' },
          h('div', { className: 'nw-book-heading' }, h('h2', { className: 'nw-title' }, data.title || t('unnamed')),
            data.phase ? h('span', { className: 'nw-badge nw-phase' }, phaseLabel && phaseLabel !== phaseKey ? phaseLabel : data.phase) : null),
          h('div', { className: 'nw-path', title: t('projectRoot') + ': ' + data.root }, icon('folder', 14), h('span', null, data.root))),
        h('div', { className: 'nw-stats', 'aria-label': t('overview') }, ...stats.map(([label, value]) =>
          h('div', { key: label, className: 'nw-stat' }, h('strong', null, number(value)), h('span', null, label)))),
        h('div', { className: 'nw-next' },
          h('div', { className: 'nw-next-title' }, h('span', null, t('nextChapter')), chapterName(t, data.nextChapter || 1)),
          h('div', { className: 'nw-row' },
            button(h(React.Fragment, null, icon('copy', 14), t('continueHint')), () => copy(t('continuePrompt').replace('{n}', String(data.nextChapter || 1))), { className: 'nw-btn nw-primary' }),
            chapters.length ? button(h(React.Fragment, null, icon('book', 14), t('readLatest')), () => openChapter(chapters[chapters.length - 1].n)) : null)),
        h('div', { className: 'nw-overview-layout' },
          h('div', { className: 'nw-overview-main' },
            h('section', { className: 'nw-section' }, sectionHead(t('latest'), t('viewAll'), () => setTab('chapters')),
              chapters.length ? h('div', { className: 'nw-chapter-list' }, ...chapters.slice(-5).reverse().map((chapter) => h(ChapterRow, { key: chapter.n, chapter, t, onOpen: openChapter }))) :
                empty(t, t('noChapters'), t('noChaptersHint')))),
          h('aside', { className: 'nw-overview-aside', 'aria-label': t('library') },
            h('section', { className: 'nw-section' }, sectionHead(t('library'), t('viewAll'), () => openLibrary('all')),
              h('div', { className: 'nw-material-grid' }, ...['characters', 'worldRules', 'foreshadows', 'summaries', 'decisions'].map((category) =>
                h('button', { key: category, type: 'button', className: 'nw-material-link', onClick: () => openLibrary(category) },
                  h('span', null, t(category)), h('span', null, number(counts[category])))))),
            (data.openForeshadow || []).length ? h('section', { className: 'nw-section' }, sectionHead(t('openThreads'), t('viewAll'), () => openLibrary('foreshadows')),
              ...data.openForeshadow.slice(0, 3).map((item, i) => h('div', { key: i, className: 'nw-thread' }, h('small', null, item.id), item.description))) : null)),
        h('div', { className: 'nw-footer' },
          h('div', { className: 'nw-row' }, ...['md', 'docx'].map((format) => button(h(React.Fragment, null, icon('download', 14), busy === format ? t('exporting') : t(format === 'md' ? 'exportMd' : 'exportDocx')), () => exportBook(format), { key: format, disabled: !!busy }))),
          h('div', { className: 'nw-sync' }, h('span', { className: 'nw-sync-dot' }), t('syncHint')))))
    }

    function Chapters({ t, chapters, onOpen }) {
      const [query, setQuery] = React.useState('')
      const [filter, setFilter] = React.useState('all')
      const [descending, setDescending] = React.useState(false)
      const matched = chapters.filter((item) => (!query.trim() || (item.n + ' ' + item.title + ' ' + chapterName(t, item.n)).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && (filter === 'all' || item.completed === (filter === 'completed')))
      const rows = descending ? matched.slice().reverse() : matched
      return h(React.Fragment, null,
        h('div', { className: 'nw-tools' }, h('div', { className: 'nw-container' },
          h('div', { className: 'nw-page-heading' }, h('h2', null, t('chapterDirectory')), h('span', { className: 'nw-muted' }, number(chapters.length) + ' ' + t('chapters'))),
          searchBox(query, setQuery, t('searchChapters')),
          h('div', { className: 'nw-filters' }, ...['all', 'completed', 'pending'].map((value) =>
            h('button', { key: value, type: 'button', className: 'nw-chip', 'aria-pressed': filter === value, onClick: () => setFilter(value) }, t(value))),
            h('button', { type: 'button', className: 'nw-chip nw-sort', onClick: () => setDescending(!descending) }, icon('sort', 14), t(descending ? 'descending' : 'ascending'))))),
        h('div', { className: 'nw-scroll nw-list-scroll' }, h('div', { className: 'nw-container' },
          h('div', { className: 'nw-list-summary', role: 'status' }, number(rows.length) + ' / ' + number(chapters.length) + ' ' + t('chapters')),
          rows.length ? h('div', { className: 'nw-chapter-list' }, ...rows.map((chapter) => h(ChapterRow, { key: chapter.n, chapter, t, onOpen }))) :
            empty(t, chapters.length ? t('noResults') : t('noChapters'), chapters.length ? '' : t('noChaptersHint'), chapters.length ? button(t('clearSearch'), () => { setQuery(''); setFilter('all') }) : null))))
    }

    function Reader({ t, url, revision, chapters, chapter, onOpen, onBack, copy, refresh }) {
      const state = useResource(url + '&chapter=' + chapter, 0, revision)
      const [fontSize, setFontSize] = React.useState(18)
      const articleRef = React.useRef(null)
      React.useEffect(() => { if (articleRef.current) articleRef.current.scrollTop = 0 }, [chapter])
      const index = chapters.findIndex((item) => item.n === chapter)
      const current = state.data && state.data.chapter
      return h(React.Fragment, null,
        h('div', { className: 'nw-reader-head' }, h('div', { className: 'nw-reading-column' },
          h('button', { type: 'button', className: 'nw-back', autoFocus: true, onClick: onBack }, icon('back', 14), t('backChapters')),
          h('div', { className: 'nw-reader-actions' },
            h('span', { className: 'nw-muted' }, chapterName(t, chapter), current ? ' · ' + number(current.chars) + ' ' + t('words') : ''),
            h('div', { className: 'nw-row' },
              h('button', { type: 'button', className: 'nw-icon', title: t('fontSmaller'), 'aria-label': t('fontSmaller'), disabled: fontSize <= 12, onClick: () => setFontSize(fontSize - 1) }, 'A−'),
              h('span', { className: 'nw-count', 'aria-label': t('fontSize') }, fontSize),
              h('button', { type: 'button', className: 'nw-icon', title: t('fontLarger'), 'aria-label': t('fontLarger'), disabled: fontSize >= 24, onClick: () => setFontSize(fontSize + 1) }, 'A+'),
              h('button', { type: 'button', className: 'nw-icon', title: t('copyText'), 'aria-label': t('copyText'), disabled: !current || !!state.error, onClick: () => copy(current.content) }, icon('copy', 15)))))),
        h('article', { ref: articleRef, className: 'nw-scroll nw-reader', style: { fontSize: fontSize + 'px' }, 'aria-label': t('reading'), 'aria-busy': state.loading },
          h('div', { className: 'nw-reading-column' },
            state.error ? empty(t, t('readError'), errorText(state.error, t), button(t('retry'), refresh)) : !current ? empty(t, t('loading')) : h(React.Fragment, null,
              !/^\s*#\s+/m.test(current.content) ? h('h1', null, current.title || chapterName(t, chapter)) : null,
              current.content ? h(Markdown, { content: current.content }) : h('p', { className: 'nw-muted' }, t('emptyContent'))))),
        h('div', { className: 'nw-reader-nav' }, h('div', { className: 'nw-reading-column' },
          button(h(React.Fragment, null, icon('back', 14), t('previous')), () => onOpen(chapters[index - 1].n), { disabled: index <= 0 }),
          button(h(React.Fragment, null, t('next'), icon('arrow', 14)), () => onOpen(chapters[index + 1].n), { disabled: index < 0 || index >= chapters.length - 1 }))))
    }

    function materialPreview(item) {
      if (item.subtitle) return item.subtitle
      if (item.fields) {
        const fields = item.fields
        const text = fields.description || fields.event || fields.goal || fields.final_direction || fields.summary
        if (text) return String(text)
      }
      return materialText(item).replace(/^#+\s/gm, '').replace(/^\s*> ?/gm, '').slice(0, 220)
    }

    function Library({ t, url, revision, category, setCategory, copy, active, refresh }) {
      const state = useResource(url, 10000, revision, active)
      const [query, setQuery] = React.useState('')
      const [selected, setSelected] = React.useState(null)
      const data = state.data
      const items = data && Array.isArray(data.items) ? data.items : []
      const detail = items.find((item) => item.id === selected)
      React.useEffect(() => { if (data && selected && !detail) setSelected(null) }, [data, selected, detail])
      const chinese = t('library') === ZH.library
      const matches = items.filter((item) => (category === 'all' || category === item.category) &&
        (!query.trim() || (item.title + ' ' + (item.subtitle || '') + ' ' + materialText(item)).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
      if (detail) return h(React.Fragment, null,
        h('div', { className: 'nw-reader-head' }, h('div', { className: 'nw-reading-column' },
          h('button', { type: 'button', className: 'nw-back', autoFocus: true, onClick: () => setSelected(null) }, icon('back', 14), t('backLibrary')),
          h('div', { className: 'nw-reader-actions' }, h('span', { className: 'nw-badge' }, t(detail.category)),
            button(h(React.Fragment, null, icon('copy', 14), t('copyText')), () => copy(materialText(detail)), { disabled: !!detail.error })))),
        h('article', { key: detail.id, className: 'nw-scroll nw-reader', style: { fontSize: '15px' } }, h('div', { className: 'nw-reading-column' },
          state.error ? h('div', { className: 'nw-error', role: 'alert' }, errorText(state.error, t), ' ', button(t('retry'), refresh)) : null,
          h('h1', { className: 'nw-detail-title' }, detail.title),
          h('div', { className: 'nw-detail-source' }, t('source') + ' · ' + (detail.file || '')),
          detail.error ? h('div', { className: 'nw-error', role: 'alert' }, t('errorMaterial') + ': ' + detail.error) :
            detail.format === 'fields' && detail.fields ? fieldsView(detail.fields, chinese) :
              detail.content ? h(Markdown, { content: detail.content }) : h('p', { className: 'nw-muted' }, t('emptyContent')))))
      return h('div', { className: 'nw-library-layout' },
        h('nav', { className: 'nw-library-nav', 'aria-label': t('categories') },
          h('div', { className: 'nw-library-nav-title' }, t('categories')),
          ...['all', ...CATEGORIES].map((id) => h('button', { key: id, type: 'button', className: 'nw-chip', 'aria-pressed': category === id, onClick: () => setCategory(id) },
            h('span', null, t(id)), h('span', { className: 'nw-count' }, id === 'all' ? items.length : items.filter((item) => item.category === id).length)))),
        h('div', { className: 'nw-library-main' },
          h('div', { className: 'nw-tools' }, h('div', { className: 'nw-container' },
            h('div', { className: 'nw-page-heading' }, h('h2', null, t('libraryTitle')), h('span', { className: 'nw-muted' }, number(items.length) + ' ' + t('entries'))),
            searchBox(query, setQuery, t('searchLibrary')))),
          h('div', { className: 'nw-scroll nw-list-scroll', 'aria-busy': state.loading }, h('div', { className: 'nw-container' },
            state.error ? h('div', { className: 'nw-error', role: 'alert' }, errorText(state.error, t), ' ', button(t('retry'), refresh)) : null,
            !data && state.loading ? empty(t, t('loading')) : !items.length && !state.error ? empty(t, t('noMaterials'), t('noMaterialsHint'), null, 'library') : h(React.Fragment, null,
              h('div', { className: 'nw-list-summary', role: 'status' }, t(category) + ' · ' + number(matches.length) + ' ' + t('entries')),
              matches.length ? h('div', { className: 'nw-library-grid' }, ...matches.map((item) => h('button', {
                key: item.id, type: 'button', className: 'nw-library-card' + (item.error ? ' nw-card-error' : ''), onClick: () => setSelected(item.id),
              }, h('span', { className: 'nw-card-top' }, h('span', { className: 'nw-badge' }, t(item.category)), icon('arrow', 14)),
                h('strong', null, item.title), h('span', { className: 'nw-preview' }, item.error ? t('errorMaterial') + ': ' + item.error : materialPreview(item))))) :
                !state.error ? empty(t, t('noResults'), '', button(t('clearSearch'), () => { setQuery(''); setCategory('all') }), 'search') : null)))))
    }

    function workflowStatus(t, value) {
      const key = 'wfState_' + String(value || 'pending')
      const label = t(key)
      return label === key ? String(value || '') : label
    }
    function workflowText(value) {
      if (value === null || value === undefined) return ''
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    }
    function workflowDate(value) {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? String(value || '') : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
    }
    function formField(label, control, wide = false) {
      return h('label', { className: 'nw-form-field' + (wide ? ' nw-form-wide' : '') }, h('span', null, label), control)
    }
    function workflowNotice(t, value) {
      return value ? h('div', { className: 'nw-error', role: 'alert' }, errorText(value, t)) : null
    }
    function WorkflowValue({ t, value }) {
      if (Array.isArray(value)) return h('ul', { style: { paddingInlineStart: '20px', margin: '8px 0', fontSize: '13px', lineHeight: 1.9 } }, ...value.map((item, index) => h('li', { key: index }, typeof item === 'object' && item !== null ? fieldsView(item, t('library') === ZH.library) : String(item ?? ''))))
      if (typeof value === 'object' && value !== null) return fieldsView(value, t('library') === ZH.library)
      return h('div', { className: 'nw-workflow-note', style: { whiteSpace: 'pre-wrap' } }, String(value ?? ''))
    }
    function InlineConfirmation({ t, title, detail, onConfirm, onCancel, busy }) {
      return h('div', { className: 'nw-inline-confirm', role: 'group', 'aria-label': title }, h('strong', null, title),
        h('p', null, detail), h('div', { className: 'nw-row' }, button(t('confirmAction'), onConfirm, { className: 'nw-btn nw-primary', disabled: busy }), button(t('keepCurrent'), onCancel, { disabled: busy })))
    }

    // 文件保持字节形式发送，由宿主识别编码，避免浏览器把 GB18030 原稿解错。
    async function manuscriptBase64(file, t) {
      if (!/\.(txt|md)$/i.test(file.name)) throw new Error(t('fileTypeError'))
      if (file.size > 16 * 1024 * 1024) throw new Error(t('fileTooLarge'))
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768))
      return btoa(binary)
    }

    function ImportEditor({ t, item, query, revision, busy, canDispatch, mutate, onSelectSource, draftCache }) {
      const cached = draftCache.current.get(item.id)
      const [reload, setReload] = React.useState(0)
      const state = useResource('/novel-studio/api/import?' + query + '&importId=' + encodeURIComponent(item.id), 0, String(revision) + ':' + reload)
      const [chapters, setChapters] = React.useState(cached && cached.chapters || [])
      const [index, setIndex] = React.useState(cached && cached.index || 0)
      const [dirty, setDirty] = React.useState(!!(cached && cached.dirty))
      const [error, setError] = React.useState('')
      const [confirm, setConfirm] = React.useState(false)
      const textRef = React.useRef(null)
      const baseHash = React.useRef(cached && cached.hash || '')
      const draftSnapshot = React.useRef(null)
      draftSnapshot.current = { chapters, index, dirty, hash: baseHash.current }
      // 子页切换保留未提交校正；会话或根目录切换时，整个缓存随工作流卸载。
      React.useEffect(() => () => { draftCache.current.set(item.id, draftSnapshot.current) }, [item.id])
      React.useEffect(() => {
        // 轮询和其他操作刷新时，不覆盖尚未保存的章节校正。
        if (state.data && !dirty) {
          baseHash.current = state.data.import && state.data.import.contentHash || ''
          setChapters((state.data.chapters || []).map((chapter) => ({ id: chapter.id, n: chapter.n, title: chapter.title || '', text: chapter.text ?? chapter.content ?? '', complete: chapter.complete !== false })))
          setIndex((old) => Math.max(0, Math.min(old, (state.data.chapters || []).length - 1)))
        }
      }, [state.data])
      const current = chapters[index]
      const manifest = { ...(state.data && state.data.import || {}), ...item }
      const ready = manifest.analysisReady === true
      const update = (patch) => { setChapters((old) => old.map((chapter, i) => i === index ? { ...chapter, ...patch } : chapter)); setDirty(true); setError(''); setConfirm(false) }
      const split = () => {
        const at = textRef.current && textRef.current.selectionStart
        if (!current || !at || !current.text.slice(0, at).trim() || !current.text.slice(at).trim()) { setError(t('splitHint')); return }
        const next = chapters.slice()
        next.splice(index, 1, { ...current, text: current.text.slice(0, at).trim(), complete: true }, { title: current.title, text: current.text.slice(at).trim(), complete: current.complete })
        setChapters(next); setDirty(true); setError(''); setConfirm(false)
      }
      const merge = () => {
        if (!current || !chapters[index + 1]) return
        const next = chapters.slice()
        next.splice(index, 2, { ...current, text: current.text.trimEnd() + '\n\n' + chapters[index + 1].text.trimStart(), complete: chapters[index + 1].complete })
        setChapters(next); setDirty(true); setError(''); setConfirm(false)
      }
      const save = async () => {
        const result = await mutate('save_chapters', { importId: item.id, expectedHash: baseHash.current, chapters: chapters.map(({ id, title, text, complete }) => ({ id, title, text, complete })) })
        if (result) setDirty(false)
      }
      return h('section', { className: 'nw-workflow-card', 'aria-label': t('importPreview') },
        h('div', { className: 'nw-section-head' }, h('h3', null, t('importPreview')), h('span', { className: 'nw-badge' }, ready ? t('analysisReady') : t('analysisNeeded'))),
        h('p', null, (manifest.filename || manifest.title || item.id) + ' · ' + number(chapters.length || manifest.chapterCount) + ' ' + t('chapters') + ' · ' + number(manifest.totalChars) + ' ' + t('words')),
        workflowNotice(t, state.error || error),
        !state.data && state.loading ? empty(t, t('loading')) : current ? h(React.Fragment, null,
          formField(t('importChapter'), h('select', { className: 'nw-select', value: index, onChange: (event) => { setIndex(Number(event.target.value)); setError('') } }, ...chapters.map((chapter, i) => h('option', { key: chapter.id || i, value: i }, chapterName(t, i + 1) + ' · ' + chapter.title)))),
          h('div', { className: 'nw-form-grid' },
            formField(t('chapterTitle'), h('input', { className: 'nw-input', value: current.title, onChange: (event) => update({ title: event.target.value }), disabled: busy }), true),
            formField(t('chapterContent'), h('textarea', { ref: textRef, className: 'nw-textarea nw-source-text', value: current.text, onChange: (event) => update({ text: event.target.value }), disabled: busy }), true)),
          h('div', { className: 'nw-row' }, button(t('splitChapter'), split, { disabled: busy }), button(t('mergeNext'), merge, { disabled: busy || index >= chapters.length - 1 }), button(t('saveChapters'), save, { disabled: busy || !dirty }), dirty ? button(t('reloadChapters'), () => { setDirty(false); setError(''); setReload((value) => value + 1) }, { disabled: busy }) : null),
          index === chapters.length - 1 ? h('div', { className: 'nw-workflow-note' }, h('label', { className: 'nw-checkbox' }, h('input', { type: 'checkbox', checked: current.complete === false, disabled: busy, onChange: (event) => update({ complete: !event.target.checked }) }), t('lastIncomplete'))) : null,
          dirty ? h('p', { className: 'nw-workflow-note', role: 'status' }, t('unsavedChapters')) : null,
          !ready ? h('p', { className: 'nw-workflow-note' }, t('analysisRequired')) : null,
          h('div', { className: 'nw-row', style: { marginTop: '16px' } },
            button(t('analyzeImport'), () => mutate('analyze', { importId: item.id }), { className: 'nw-btn nw-primary', disabled: busy || dirty || !canDispatch || manifest.status === 'analyzing' }),
            button(t('createRewrite'), () => onSelectSource(item.id), { disabled: busy || dirty || !ready }),
            button(t('materializeImport'), () => setConfirm(true), { disabled: busy || dirty || !ready || !chapters.some((chapter) => chapter.complete !== false) })),
          confirm ? h(InlineConfirmation, { t, title: t('materializeConfirm'), detail: t('materializeWarning'), busy, onCancel: () => setConfirm(false), onConfirm: async () => { const result = await mutate('materialize_import', { importId: item.id, replace: true }, true); if (result) setConfirm(false) } }) : null) : null)
    }

    function RewriteForm({ t, imports, currentChapters, sourceId, setSourceId, busy, mutate, onCreated, draft, setDraft }) {
      const { requirements, preserve, forbidden, degree, from, to } = draft
      const setField = (key) => (value) => setDraft((old) => ({ ...old, [key]: value }))
      const setRequirements = setField('requirements'), setPreserve = setField('preserve'), setForbidden = setField('forbidden'), setDegree = setField('degree'), setFrom = setField('from'), setTo = setField('to')
      const [error, setError] = React.useState('')
      const selectedImport = imports.find((item) => item.id === sourceId)
      const count = sourceId ? Number(selectedImport && selectedImport.chapterCount) || 0 : currentChapters.length
      React.useEffect(() => {
        const sourceKey = sourceId + ':' + count
        if (draft.sourceKey !== sourceKey) setDraft((old) => ({ ...old, sourceKey, from: '1', to: String(Math.max(1, count)) }))
        setError('')
      }, [sourceId, count])
      const submit = async (event) => {
        event.preventDefault()
        const start = Number(from), end = Number(to)
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > count) { setError(t('invalidScope')); return }
        if (selectedImport && selectedImport.analysisReady !== true) { setError(t('sourceNotReady')); return }
        if (!requirements.trim()) return
        setError('')
        const lines = (value) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        const result = await mutate('create_rewrite', { ...(sourceId ? { importId: sourceId } : {}), requirements: requirements.trim(), preserve: lines(preserve), forbidden: lines(forbidden), degree, scope: { from: start, to: end } })
        if (result) onCreated(result.task && result.task.id || result.rewriteId || result.id)
      }
      return h('form', { className: 'nw-workflow-card', onSubmit: submit }, h('h3', null, t('newRewrite')),
        !imports.length && !currentChapters.length ? h('p', null, t('noRewriteSource')) : null,
        workflowNotice(t, error), h('div', { className: 'nw-form-grid' },
          formField(t('rewriteSource'), h('select', { className: 'nw-select', value: sourceId, disabled: busy, onChange: (event) => setSourceId(event.target.value) },
            h('option', { value: '', disabled: !currentChapters.length }, t('currentManuscript')),
            ...imports.map((item) => h('option', { key: item.id, value: item.id }, item.title || item.filename || item.id))), true),
          formField(t('requirements'), h('textarea', { className: 'nw-textarea', value: requirements, required: true, disabled: busy, placeholder: t('requirementsPlaceholder'), onChange: (event) => setRequirements(event.target.value) }), true),
          formField(t('preserve'), h('textarea', { className: 'nw-textarea', value: preserve, disabled: busy, placeholder: t('preservePlaceholder'), onChange: (event) => setPreserve(event.target.value) })),
          formField(t('forbidden'), h('textarea', { className: 'nw-textarea', value: forbidden, disabled: busy, placeholder: t('forbiddenPlaceholder'), onChange: (event) => setForbidden(event.target.value) })),
          formField(t('rewriteDegree'), h('select', { className: 'nw-select', value: degree, disabled: busy, onChange: (event) => setDegree(event.target.value) }, ...['local', 'plot', 'rebuild'].map((value) => h('option', { key: value, value }, t('degree_' + value))))),
          h('div', { className: 'nw-form-grid', style: { margin: 0 } }, formField(t('scopeFrom'), h('input', { className: 'nw-input', type: 'number', min: 1, max: count || 1, value: from, required: true, disabled: busy, onChange: (event) => setFrom(event.target.value) })),
            formField(t('scopeTo'), h('input', { className: 'nw-input', type: 'number', min: 1, max: count || 1, value: to, required: true, disabled: busy, onChange: (event) => setTo(event.target.value) })))),
        selectedImport && selectedImport.analysisReady !== true ? h('p', { className: 'nw-workflow-note' }, t('sourceNotReady')) : null,
        h('button', { className: 'nw-btn nw-primary', type: 'submit', disabled: busy || !count || !requirements.trim() || !!selectedImport && selectedImport.analysisReady !== true }, t('createRewrite')))
    }

    function RewriteTask({ t, task, busy, canDispatch, mutate, onCompare, onMaterials }) {
      const [confirm, setConfirm] = React.useState(false)
      const chapters = Array.isArray(task.chapters) ? task.chapters : []
      const finished = chapters.filter((chapter) => ['passed', 'kept'].includes(chapter.status)).length
      const plan = task.plan
      const terminal = ['applied', 'cancelled'].includes(task.status)
      return h('section', { className: 'nw-workflow-card', 'aria-label': task.title || task.id },
        h('div', { className: 'nw-section-head' }, h('h3', null, task.title || task.id), h('span', { className: 'nw-badge' }, workflowStatus(t, task.status))),
        h('p', { style: { whiteSpace: 'pre-wrap' } }, task.requirements),
        task.scope ? h('p', { className: 'nw-workflow-note' }, chapterName(t, task.scope.from) + ' — ' + chapterName(t, task.scope.to)) : null,
        workflowNotice(t, task.error && workflowText(task.error)),
        h('div', { className: 'nw-row' },
          ['draft_plan', 'awaiting_approval'].includes(task.status) ? button(t(plan ? 'planRegenerate' : 'planGenerate'), () => mutate('plan', { rewriteId: task.id }), { disabled: busy || !canDispatch }) : null,
          task.status === 'awaiting_approval' && plan ? button(t('planApprove'), () => mutate('approve_plan', { rewriteId: task.id }), { className: 'nw-btn nw-primary', disabled: busy }) : null,
          task.status === 'ready' ? button(t('runRewrite'), () => mutate('run', { rewriteId: task.id }), { className: 'nw-btn nw-primary', disabled: busy || !canDispatch }) : null,
          task.status === 'running' ? button(t('pauseRewrite'), () => mutate('pause', { rewriteId: task.id }), { disabled: busy }) : null,
          task.status === 'paused' ? button(t('resumeRewrite'), () => mutate('resume', { rewriteId: task.id }), { className: 'nw-btn nw-primary', disabled: busy || !canDispatch }) : null,
          task.status === 'failed' ? button(t('retryRewrite'), () => mutate('retry', { rewriteId: task.id }), { disabled: busy || !canDispatch }) : null,
          chapters.length ? button(t('compareOpen'), () => onCompare(task.id, chapters.some((chapter) => chapter.n === Number(task.cursor)) ? Number(task.cursor) : chapters[0].n), { disabled: busy }) : null,
          button(t('originalMaterials'), () => onMaterials(task.id, 'original'), { disabled: busy }),
          button(t('candidateMaterials'), () => onMaterials(task.id, 'candidate'), { disabled: busy }),
          !terminal ? button(t('cancelRewrite'), () => mutate('cancel', { rewriteId: task.id }), { disabled: busy }) : null),
        ['awaiting_approval', 'ready'].includes(task.status) ? h('p', { className: 'nw-workflow-note' }, t('planApprovedHint')) : null,
        plan ? h('div', { style: { marginTop: '20px' } }, h('h3', null, t('planTitle')), h('div', { className: 'nw-workflow-note', style: { whiteSpace: 'pre-wrap' } }, workflowText(plan.summary)),
          plan.impact ? h('details', { className: 'nw-workflow-details', open: true }, h('summary', null, t('planImpact')), h(WorkflowValue, { t, value: plan.impact })) : null,
          plan.risks ? h('details', { className: 'nw-workflow-details' }, h('summary', null, t('planRisks')), h(WorkflowValue, { t, value: plan.risks })) : null,
          Array.isArray(plan.outline) ? h('details', { className: 'nw-workflow-details' }, h('summary', null, t('planChapters')),
            ...plan.outline.map((item, index) => h('div', { key: item.chapter || index, className: 'nw-plan-row' }, h('span', { className: 'nw-muted' }, chapterName(t, item.chapter)),
              h('div', null, h('strong', null, item.title), ' ', h('span', { className: 'nw-badge' }, t('changes_' + item.change)), h('p', null, item.goal), item.reason ? h('p', { className: 'nw-muted' }, item.reason) : null)))) : null) : null,
        h('div', { className: 'nw-progress-line' }, h('span', null, t('processingChapters')), h('span', null, number(finished) + ' / ' + number(chapters.length))),
        h('progress', { max: Math.max(1, chapters.length), value: finished, 'aria-label': t('processingChapters') }),
        chapters.length ? h('details', { className: 'nw-workflow-details', open: task.status === 'running' || task.status === 'failed' }, h('summary', null, t('chapters')),
          h('div', { className: 'nw-task-chapters' }, ...chapters.map((chapter) => h('div', { key: chapter.n, className: 'nw-task-chapter' },
            h('span', null, chapterName(t, chapter.n), chapter.title ? ' · ' + chapter.title : '', chapter.reason ? h('small', { className: 'nw-muted', style: { display: 'block' } }, chapter.reason) : null),
            h('span', { className: 'nw-badge' }, workflowStatus(t, chapter.status)))))) : null,
        task.status === 'completed' ? h(React.Fragment, null, button(t('applyRewrite'), () => setConfirm(true), { className: 'nw-btn nw-primary', disabled: busy }),
          confirm ? h(InlineConfirmation, { t, title: t('applyConfirm'), detail: t('applyWarning'), busy, onCancel: () => setConfirm(false), onConfirm: async () => { const result = await mutate('apply', { rewriteId: task.id }, true); if (result) setConfirm(false) } }) : null) : null)
    }

    function RewriteComparison({ t, task, chapter, setChapter, query, revision, onBack }) {
      const state = useResource('/novel-studio/api/compare?' + query + '&rewriteId=' + encodeURIComponent(task.id) + '&chapter=' + chapter, task.status === 'running' ? 5000 : 0, String(revision) + ':' + String(task.updatedAt || task.updated_at || task.status))
      const [mode, setMode] = React.useState('candidate')
      const [sync, setSync] = React.useState(true)
      const panes = React.useRef({})
      const syncing = React.useRef(false)
      const data = state.data
      const onScroll = (side) => {
        if (!sync || syncing.current) return
        const source = panes.current[side], target = panes.current[side === 'original' ? 'candidate' : 'original']
        if (!source || !target) return
        syncing.current = true
        const fraction = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight)
        target.scrollTop = fraction * Math.max(0, target.scrollHeight - target.clientHeight)
        window.requestAnimationFrame(() => { syncing.current = false })
      }
      return h('section', { 'aria-label': t('compareTitle') },
        h('button', { type: 'button', className: 'nw-back', autoFocus: true, onClick: onBack }, icon('back', 14), t('compareBack')),
        h('div', { className: 'nw-compare-toolbar' }, h('h2', { style: { fontSize: '20px' } }, t('compareTitle')),
          h('label', { className: 'nw-checkbox' }, h('input', { type: 'checkbox', checked: sync, onChange: (event) => setSync(event.target.checked) }), t('syncScroll'))),
        formField(t('chapters'), h('select', { className: 'nw-select', value: chapter, onChange: (event) => setChapter(Number(event.target.value)) }, ...(task.chapters || []).map((item) => h('option', { key: item.n, value: item.n }, chapterName(t, item.n) + ' · ' + (item.title || '') + ' · ' + workflowStatus(t, item.status))))),
        workflowNotice(t, state.error),
        !data && state.loading ? empty(t, t('loading')) : data ? h(React.Fragment, null,
          h('div', { className: 'nw-compare-switch', style: { marginTop: '16px' } }, ...['original', 'candidate'].map((value) => h('button', { key: value, type: 'button', className: 'nw-chip', 'aria-pressed': mode === value, onClick: () => setMode(value) }, t(value === 'original' ? 'originalVersion' : 'candidateVersion')))),
          data.candidate && !['passed', 'kept', 'applied'].includes(data.candidate.status) ? h('p', { className: 'nw-workflow-note' }, t('pendingCandidate')) : null,
          h('div', { className: 'nw-compare-grid', 'data-mode': mode }, ...['original', 'candidate'].map((side) => {
            const value = data[side] || {}
            return h('section', { key: side, className: 'nw-compare-pane', 'data-version': side }, h('h3', null, t(side === 'original' ? 'originalVersion' : 'candidateVersion'), ' · ', number(value.chars), ' ', t('words')),
              h('div', { ref: (element) => { panes.current[side] = element }, className: 'nw-compare-body', onScroll: () => onScroll(side) }, value.content ? h(Markdown, { content: value.content }) : h('p', { className: 'nw-muted' }, t(side === 'candidate' ? 'noCandidate' : 'emptyContent'))))
          })),
          data.summary ? h('section', { className: 'nw-workflow-card' }, h('h3', null, t('changeSummary')), h('div', { style: { whiteSpace: 'pre-wrap' } }, workflowText(data.summary))) : null,
          data.review ? h('section', { className: 'nw-workflow-card' }, h('h3', null, t('chapterReview')), h('span', { className: 'nw-badge' }, t(data.review.passed ? 'reviewPassed' : 'reviewFailed')),
            h(WorkflowValue, { t, value: data.review.notes || data.review })) : null) : null)
    }

    function RevisionLibrary({ t, task, kind, setKind, query, revision, active, copy, onBack, refresh, notice, error }) {
      const [category, setCategory] = React.useState('all')
      const url = '/novel-studio/api/revision-library?' + query + '&rewriteId=' + encodeURIComponent(task.id) + '&kind=' + encodeURIComponent(kind)
      // 不同版本的搜索、分类和详情各自重新开始，避免把原稿条目误认作候选事实。
      React.useEffect(() => setCategory('all'), [kind])
      return h('div', { className: 'nw-panel' },
        h('div', { className: 'nw-reader-head' }, h('div', { className: 'nw-container' },
          h('button', { type: 'button', className: 'nw-back', autoFocus: true, onClick: onBack }, icon('back', 14), t('compareBack')),
          h('div', { className: 'nw-reader-actions' },
            h('span', { className: 'nw-badge' }, task.title || task.id, ' · ', t(kind === 'original' ? 'originalMaterials' : 'candidateMaterials')),
            h('div', { className: 'nw-row', 'aria-label': t('library') }, ...['original', 'candidate'].map((value) => h('button', { key: value, type: 'button', className: 'nw-chip', 'aria-pressed': kind === value, onClick: () => setKind(value) }, t(value === 'original' ? 'originalMaterials' : 'candidateMaterials'))))),
          kind === 'candidate' && task.status !== 'applied' ? h('p', { className: 'nw-workflow-note', role: 'status' }, t(task.status === 'completed' ? 'candidateMaterialsReady' : 'candidateMaterialsPending')) : null)),
        notice ? h('div', { className: 'nw-notice', role: 'status' }, notice) : null,
        error ? h('div', { className: 'nw-notice', role: 'alert' }, errorText(error, t)) : null,
        h(Library, { key: task.id + ':' + kind, t, url, revision, category, setCategory, copy, active, refresh }))
    }

    function Workflow({ t, root, sessionId, currentChapters, active, revision, refreshProject }) {
      const query = 'sessionId=' + encodeURIComponent(sessionId) + (root ? '&path=' + encodeURIComponent(root) : '')
      const [nonce, setNonce] = React.useState(0)
      const state = useResource('/novel-studio/api/workflow?' + query, 3000, String(revision) + ':' + nonce, active)
      const [page, setPage] = React.useState('imports')
      const [importMode, setImportMode] = React.useState('file')
      const [file, setFile] = React.useState(null)
      const [text, setText] = React.useState('')
      const [importId, setImportId] = React.useState('')
      const [sourceId, setSourceId] = React.useState('')
      const [rewriteDraft, setRewriteDraft] = React.useState({ requirements: '', preserve: '', forbidden: '', degree: 'plot', from: '1', to: '1', sourceKey: '' })
      const [taskId, setTaskId] = React.useState('')
      const [compare, setCompare] = React.useState(null)
      const [materialView, setMaterialView] = React.useState(null)
      const [confirmVersion, setConfirmVersion] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const alive = React.useRef(true)
      const mutation = React.useRef(null)
      const preparingFile = React.useRef(false)
      const fileInput = React.useRef(null)
      const importDrafts = React.useRef(new Map())
      React.useEffect(() => { alive.current = true; return () => { alive.current = false; if (mutation.current) mutation.current.abort() } }, [])
      const data = state.data
      const imports = data && Array.isArray(data.imports) ? data.imports : []
      const tasks = data && Array.isArray(data.rewrites) ? data.rewrites : []
      const versions = data && Array.isArray(data.versions) ? data.versions : []
      const selectedImport = imports.find((item) => item.id === importId) || imports[0]
      const task = tasks.find((item) => item.id === taskId) || tasks[0]
      const comparisonTask = compare && tasks.find((item) => item.id === compare.rewriteId)
      const materialsTask = materialView && tasks.find((item) => item.id === materialView.rewriteId)
      const canDispatch = !!(data && data.capabilities && data.capabilities.dispatch)
      const mutate = async (action, args = {}, projectChanged = false) => {
        if (mutation.current || !alive.current) return null
        const controller = new AbortController()
        mutation.current = controller
        setBusy(action); setError(''); setNotice('')
        const timeout = window.setTimeout(() => controller.abort(), 90000)
        try {
          const response = await fetch('/novel-studio/api/workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, path: root, action, ...args }), signal: controller.signal })
          const payload = await response.json()
          if (!response.ok || !payload || payload.ok !== true) throw new Error(payload && payload.error ? workflowText(payload.error) : 'HTTP ' + response.status)
          if (!alive.current) return null
          const nextImport = payload.import && payload.import.id || payload.importId
          const nextTask = payload.task && payload.task.id || payload.rewriteId
          if (nextImport) { setImportId(nextImport); if (action === 'import') setSourceId(nextImport) }
          if (nextTask) setTaskId(nextTask)
          setNonce((value) => value + 1)
          if (projectChanged) refreshProject()
          setNotice(t(['analyze', 'plan', 'run', 'resume', 'retry'].includes(action) ? 'taskStarted' : 'operationDone'))
          return payload
        } catch (failure) {
          if (alive.current) { setError(failure.name === 'AbortError' ? t('requestUnknown') : errorText(failure, t)); setNonce((value) => value + 1) }
          return null
        } finally {
          window.clearTimeout(timeout)
          if (mutation.current === controller) mutation.current = null
          if (alive.current) setBusy('')
        }
      }
      const importManuscript = async (event) => {
        event.preventDefault()
        if (busy || preparingFile.current || mutation.current) return
        preparingFile.current = true
        setBusy('read_file')
        try {
          const args = importMode === 'file' ? { filename: file && file.name, contentBase64: file ? await manuscriptBase64(file, t) : '' } : { filename: 'manuscript.md', text }
          if (!alive.current) return
          const result = await mutate('import', args)
          if (result) { setText(''); setFile(null); if (fileInput.current) fileInput.current.value = '' }
        } catch (failure) { if (alive.current) setError(errorText(failure, t)) }
        finally { preparingFile.current = false; if (alive.current && !mutation.current) setBusy('') }
      }
      const showRewrite = (id) => { setSourceId(id); setPage('rewrites'); setCompare(null); setMaterialView(null); setNotice('') }
      const copyMaterial = async (value) => {
        try { await navigator.clipboard.writeText(value); if (alive.current) setNotice(t('copied')) }
        catch { if (alive.current) setError(t('copyFailed')) }
      }
      if (page === 'rewrites' && materialsTask) return h(RevisionLibrary, {
        t, task: materialsTask, kind: materialView.kind, setKind: (kind) => { setMaterialView({ ...materialView, kind }); setNotice(''); setError('') }, query,
        revision: String(revision) + ':' + nonce, active, copy: copyMaterial, onBack: () => setMaterialView(null), refresh: () => setNonce((value) => value + 1),
        notice, error: error || state.error,
      })
      return h('div', { className: 'nw-scroll', 'aria-busy': !!busy }, h('div', { className: 'nw-container' },
        h('div', { className: 'nw-workflow-heading' }, h('h2', null, t('workflowTitle')), h('p', null, t('workflowHint'))),
        h('nav', { className: 'nw-workflow-nav', 'aria-label': t('workflow') }, ...[['imports', 'importsTab', imports.length], ['rewrites', 'rewritesTab', tasks.length], ['versions', 'versionsTab', versions.length]].map(([id, label, count]) => h('button', { key: id, type: 'button', className: 'nw-chip', 'aria-pressed': page === id, onClick: () => { setPage(id); setCompare(null); setError('') } }, t(label), h('span', { className: 'nw-count' }, number(count))))),
        workflowNotice(t, error || state.error), notice ? h('div', { className: 'nw-workflow-note', role: 'status' }, notice) : null,
        !canDispatch && data ? h('p', { className: 'nw-workflow-note' }, data.capabilities && data.capabilities.reason || t('dispatchUnavailable')) : data && data.capabilities && data.capabilities.busy ? h('p', { className: 'nw-workflow-note' }, t('sessionBusy')) : null,
        !data && state.loading ? empty(t, t('loading')) : page === 'imports' ? h(React.Fragment, null,
          h('form', { className: 'nw-workflow-card', onSubmit: importManuscript }, h('h3', null, t('importsTab')), h('p', null, t('importHint')),
            h('div', { className: 'nw-row', style: { marginBottom: '16px' } }, ...[['file', 'importFile'], ['text', 'pasteManuscript']].map(([id, key]) => h('button', { key: id, type: 'button', className: 'nw-chip', 'aria-pressed': importMode === id, disabled: !!busy, onClick: () => setImportMode(id) }, t(key)))),
            importMode === 'file' ? formField(t('chooseFile'), h('input', { ref: fileInput, className: 'nw-file-input', type: 'file', accept: '.txt,.md,text/plain,text/markdown', disabled: !!busy, onChange: (event) => { setFile(event.target.files && event.target.files[0] || null); setError('') } })) : formField(t('pasteLabel'), h('textarea', { className: 'nw-textarea nw-source-text', value: text, placeholder: t('pastePlaceholder'), disabled: !!busy, onChange: (event) => setText(event.target.value) })),
            file && importMode === 'file' ? h('p', { className: 'nw-workflow-note' }, file.name + ' · ' + number(Math.ceil(file.size / 1024)) + ' KiB') : null,
            h('button', { className: 'nw-btn nw-primary', type: 'submit', style: { marginTop: '16px' }, disabled: !!busy || (importMode === 'file' ? !file : !text.trim()) }, busy === 'import' ? t('requestBusy') : t('importSubmit'))),
          imports.length ? h(React.Fragment, null,
            formField(t('importHistory'), h('select', { className: 'nw-select', value: selectedImport && selectedImport.id || '', onChange: (event) => setImportId(event.target.value), disabled: !!busy }, ...imports.map((item) => h('option', { key: item.id, value: item.id }, (item.title || item.filename || item.id) + ' · ' + number(item.chapterCount) + ' ' + t('chapters'))))),
            h('div', { style: { marginTop: '16px' } }, h(ImportEditor, { key: selectedImport.id, t, item: selectedImport, query, revision: String(revision) + ':' + nonce, busy: !!busy, canDispatch, mutate, onSelectSource: showRewrite, draftCache: importDrafts }))) : h('p', { className: 'nw-workflow-note' }, t('noImports'))) : page === 'rewrites' ? comparisonTask ? h(RewriteComparison, { t, task: comparisonTask, chapter: compare.chapter, setChapter: (chapter) => setCompare({ ...compare, chapter }), query, revision: String(revision) + ':' + nonce, onBack: () => setCompare(null) }) : h(React.Fragment, null,
          tasks.length ? h('div', { className: 'nw-task-picker' }, ...tasks.map((item) => h('button', { key: item.id, type: 'button', className: 'nw-task-choice', 'aria-pressed': task && task.id === item.id, onClick: () => { setTaskId(item.id); setNotice('') } }, h('strong', null, item.title || item.id), h('small', null, workflowStatus(t, item.status)), h('small', null, workflowDate(item.createdAt))))) : h('p', { className: 'nw-workflow-note' }, t('noRewrites')),
          task ? h(RewriteTask, { key: task.id, t, task, busy: !!busy, canDispatch, mutate, onCompare: (rewriteId, chapter) => { setMaterialView(null); setCompare({ rewriteId, chapter }) }, onMaterials: (rewriteId, kind) => { setCompare(null); setMaterialView({ rewriteId, kind }); setNotice(''); setError('') } }) : null,
          h(RewriteForm, { t, imports, currentChapters, sourceId, setSourceId, busy: !!busy, mutate, draft: rewriteDraft, setDraft: setRewriteDraft, onCreated: (id) => { if (id) setTaskId(id); setNonce((value) => value + 1) } })) : h('section', { className: 'nw-workflow-card' },
          h('h3', null, t('versionsTab')), h('p', null, t('versionsHint')),
          versions.length ? versions.map((version) => h('div', { key: version.id }, h('div', { className: 'nw-version-row' },
            h('div', null, h('strong', null, version.label || version.title || version.id), h('small', null, t('versionKind_' + (version.kind || 'baseline')) + ' · ' + t('versionTime') + ' · ' + workflowDate(version.createdAt))),
            data.activeVersionId === version.id ? h('span', { className: 'nw-badge' }, t('activeVersion')) : button(t('restoreVersion'), () => setConfirmVersion(version.id), { disabled: !!busy })),
            confirmVersion === version.id ? h(InlineConfirmation, { t, title: t('restoreConfirm'), detail: t('restoreWarning'), busy: !!busy, onCancel: () => setConfirmVersion(''), onConfirm: async () => { const result = await mutate('rollback', { versionId: version.id }, true); if (result) setConfirmVersion('') } }) : null)) : h('p', { className: 'nw-workflow-note' }, t('noVersions')))))
    }

    function Workspace({ t, data, sessionId, copy, exportBook, busy, revision, refresh }) {
      const [tab, setTab] = React.useState(data.isNovel ? 'overview' : 'workflow')
      const [chapter, setChapter] = React.useState(null)
      const [category, setCategory] = React.useState('all')
      const [libraryVisited, setLibraryVisited] = React.useState(false)
      const [workflowVisited, setWorkflowVisited] = React.useState(!data.isNovel)
      const prefix = React.useId().replace(/:/g, '')
      // 正文和资料固定到当前展示的项目，概览确认目录变化后再整体切换。
      const query = 'sessionId=' + encodeURIComponent(sessionId) + '&path=' + encodeURIComponent(data.root)
      const switchTab = (value) => { setTab(value); if (value === 'library') setLibraryVisited(true); if (value === 'workflow') setWorkflowVisited(true) }
      const openChapter = (n) => { setChapter(n); setTab('chapters') }
      const openLibrary = (id) => { setCategory(id); switchTab('library') }
      const chapters = data.chapters || []
      return h(React.Fragment, null,
        h('div', { className: 'nw-tabs', role: 'tablist', 'aria-label': t('tabTitle') }, ...['overview', 'chapters', 'library', 'workflow'].map((value) => h('button', {
          key: value, id: prefix + '-tab-' + value, type: 'button', className: 'nw-tab', role: 'tab', 'aria-selected': tab === value, 'aria-controls': prefix + '-page', tabIndex: tab === value ? 0 : -1, disabled: !data.isNovel && value !== 'workflow',
          onKeyDown: (event) => {
            const tabs = data.isNovel ? ['overview', 'chapters', 'library', 'workflow'] : ['workflow']
            const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
            if (!offset && event.key !== 'Home' && event.key !== 'End') return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(value) + offset + tabs.length) % tabs.length
            switchTab(tabs[next])
            const allTabs = ['overview', 'chapters', 'library', 'workflow']
            event.currentTarget.parentElement.children[allTabs.indexOf(tabs[next])].focus()
          }, onClick: () => switchTab(value),
        }, icon(value === 'overview' ? 'grid' : value === 'chapters' ? 'book' : value === 'workflow' ? 'file' : 'library', 14), t(value), value === 'chapters' ? h('span', { className: 'nw-count' }, chapters.length) : null))),
        h('div', { id: prefix + '-page', role: 'tabpanel', 'aria-labelledby': prefix + '-tab-' + tab, className: 'nw-panel' },
          tab === 'overview' ? h(Overview, { t, data, setTab, openChapter, openLibrary, copy, exportBook, busy }) : null,
          // 目录保持挂载，阅读后返回时保留搜索、排序和完成状态筛选。
          h('div', { style: { display: tab === 'chapters' && chapter === null ? 'contents' : 'none' } }, h(Chapters, { t, chapters, onOpen: openChapter })),
          tab === 'chapters' && chapter !== null ? h(Reader, { t, url: '/novel-studio/api/chapter?' + query, revision, chapter, chapters, onOpen: openChapter, onBack: () => setChapter(null), copy, refresh }) : null,
          // 保留资料搜索和选中项，面板隐藏时停止其请求与轮询。
          libraryVisited ? h('div', { style: { display: tab === 'library' ? 'contents' : 'none' } }, h(Library, { t, url: '/novel-studio/api/library?' + query, revision, category, setCategory, copy, active: tab === 'library', refresh })) : null,
          workflowVisited ? h('div', { style: { display: tab === 'workflow' ? 'contents' : 'none' } }, h(Workflow, { t, root: data.root, sessionId, currentChapters: chapters, active: tab === 'workflow', revision, refreshProject: refresh })) : null))
    }

    function Desk({ ctx, sessionId }) {
      const t = useTranslate(ctx)
      const [revision, setRevision] = React.useState(0)
      const refresh = () => setRevision((value) => value + 1)
      const state = useResource(sessionId ? '/novel-studio/api/project?sessionId=' + encodeURIComponent(sessionId) : '', 5000, revision)
      const [notice, setNotice] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const noticeTimer = React.useRef(0)
      const alive = React.useRef(true)
      React.useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearTimeout(noticeTimer.current) } }, [])
      const showNotice = (text) => {
        if (!alive.current) return
        setNotice(text)
        window.clearTimeout(noticeTimer.current)
        noticeTimer.current = window.setTimeout(() => setNotice(''), 5000)
      }
      const copy = async (text) => {
        try { await navigator.clipboard.writeText(text); showNotice(t('copied')) }
        catch { showNotice(t('copyFailed')) }
      }
      const exportBook = async (format) => {
        if (busy) return
        setBusy(format)
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 60000)
        try {
          const response = await fetch('/novel-studio/api/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, path: state.data && state.data.root, format }), signal: controller.signal })
          const payload = await response.json()
          if (!response.ok || payload.ok !== true) throw new Error(payload.error || 'HTTP ' + response.status)
          showNotice(t('exportedTo') + ' ' + payload.target)
        } catch (error) { showNotice(t('failed') + ': ' + (error.name === 'AbortError' ? t('timeout') : errorText(error, t))) }
        finally { window.clearTimeout(timeout); if (alive.current) setBusy('') }
      }
      const data = state.data
      let content
      if (!sessionId) content = empty(t, t('noSession'), t('noSessionHint'))
      else if (!data && state.error) content = empty(t, t('failed'), errorText(state.error, t), button(t('retry'), refresh))
      else if (!data) content = empty(t, t('loading'))
      else content = h(Workspace, { key: data.root, t, data, sessionId, revision, copy, exportBook, busy, refresh })
      return h('div', { className: 'nw', 'aria-label': t('tabTitle') }, h('style', null, CSS),
        h('header', { className: 'nw-head' }, h('div', { className: 'nw-brand' }, icon('book', 18), t('tabTitle')), h('button', { type: 'button', className: 'nw-icon', title: t('refresh'), 'aria-label': t('refresh'), onClick: refresh }, icon('refresh', 15))),
        notice ? h('div', { className: 'nw-notice', role: 'status' }, notice) : null,
        state.error && data ? h('div', { className: 'nw-notice', role: 'alert' }, errorText(state.error, t)) : null, content)
    }
    function makeBody(ctx) {
      return function WorkbenchBody(props) {
        const sessionId = props && props.sessionId ? String(props.sessionId) : ''
        return h(Desk, { key: sessionId, ctx, sessionId })
      }
    }
    function makeTitle(ctx) {
      return function WorkbenchTitle() {
        const t = useTranslate(ctx)
        return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 } }, icon('book', 14), t('tabTitle'))
      }
    }
    return {
      inject: ['slots', 'sidebarRightTabs', 'sidebarRight', 'locale'],
      apply(ctx) {
        const effect = (register) => typeof ctx.effect === 'function' ? ctx.effect(register) : register()
        // 宿主使用 zh/en 标识；注册地区标签会导致界面直接显示文案键名。
        effect(() => ctx.locale.register(NS, { zh: { ...ZH, ...WF_ZH }, en: { ...EN, ...WF_EN } }))
        const t = ctx.locale.bind(NS)
        effect(() => ctx.sidebarRightTabs.register({
          id: TYPE_ID, kind: 'novel-workbench', title: () => t('tabTitle'), keepMounted: true,
          // 指南卡标题和描述使用函数读取，兼容宿主的标签注册接口。
          guide: [{ id: 'novel-workbench', title: () => t('tabTitle'), description: () => t('guideDescription'), order: 40 }],
        }))
        const Body = makeBody(ctx)
        const Title = makeTitle(ctx)
        if (typeof ctx.slots.inject === 'function') {
          ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TYPE_ID }, Body))
          ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: TYPE_ID }, Title))
        } else {
          ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TYPE_ID }, Body)
          ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: TYPE_ID }, Title)
        }
      },
    }
  },
})

