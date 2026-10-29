// dsh-novel-studio — 包根入口。
// 本 bundle 的能力全部挂在 preset（小说工作室）作用域内；包根不注册任何全局能力，
// 保留一个空 apply 仅用于满足 bundle 的包入口约定。
export const name = 'dsh-novel-studio'

export function apply() {}
