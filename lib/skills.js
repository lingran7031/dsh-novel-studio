// dsh-novel-studio — 技能包加载。
// 直接把包内 skills/<name>/SKILL.md 注册为该 preset 作用域的运行时技能。
// 这样不依赖 skill-filesystem 的 customSkillDirs 路径解析，安装即可用；
// 技能文件仍在磁盘上，改动后禁用/启用 bundle 即可生效。
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'novel-skills'

export const inject = ['skills']

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')

function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (match === null) return { data: {}, body: text }
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line.trim())
    if (field === null) continue
    let value = field[2].trim()
    if (value.length >= 2) {
      const first = value[0]
      const last = value[value.length - 1]
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) value = value.slice(1, -1)
    }
    data[field[1]] = value
  }
  return { data, body: text.slice(match[0].length) }
}

async function loadSkills() {
  let entries = []
  try {
    entries = await readdir(SKILLS_DIR, { withFileTypes: true })
  } catch {
    return []
  }
  const skills = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const resourceDir = join(SKILLS_DIR, entry.name)
    const file = join(resourceDir, 'SKILL.md')
    let text
    try {
      text = await readFile(file, 'utf8')
    } catch {
      continue
    }
    const parsed = parseFrontmatter(text)
    const skillName = parsed.data.name || entry.name
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName)) continue
    if (skillName !== entry.name) continue
    const description = parsed.data.description || ''
    if (description === '') continue
    skills.push({
      name: skillName,
      description,
      content: text,
      path: file,
      resourceBase: { kind: 'directory', path: resourceDir },
      // SkillDefinition 校验要求 source 是字符串；运行时技能的合法来源标签。
      source: 'runtime',
    })
  }
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return skills
}

const LOADED_SKILLS = await loadSkills()

export function apply(ctx) {
  for (const skill of LOADED_SKILLS) {
    ctx.effect(() => ctx.skills.register(skill))
  }
}
