#!/usr/bin/env node
/**
 * run-evals.mjs — chạy eval cho bộ skill ka-*.
 *
 * static (mặc định, không cần mạng):
 *   - parse eval-cases.md (fenced JSON array hoặc bảng markdown)
 *   - kiểm tra prompt rỗng, prompt gọi sai skill, prompt trùng, coverage
 *
 * llm: gọi endpoint OpenAI-compatible để test routing thật.
 *   EVAL_BASE_URL=https://.../v1 EVAL_MODEL=... EVAL_API_KEY=... node scripts/run-evals.mjs --mode llm
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS = join(ROOT, 'skills')
const args = process.argv.slice(2)
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'static'
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 0
const verbose = args.includes('--verbose')
const MIN_CASES = 3

function frontmatter(text) {
  const fm = text.split('---')[1] || ''
  const name = (fm.match(/^name:\s*(.+)$/m) || [])[1]?.trim()
  let desc = (fm.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || ''
  desc = desc.replace(/^"|"$/g, '')
  return { name, desc }
}

function parseCases(text) {
  const cases = []
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/g)]
  for (const block of fenced) {
    try {
      const arr = JSON.parse(block[1])
      if (Array.isArray(arr)) for (const c of arr) cases.push(normalize(c))
    } catch { /* not a JSON case block */ }
  }
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 3) continue
    if (/^#?$/.test(cells[0]) || /^-+$/.test(cells[0])) continue
    const toggle = cells.find((c) => c === 'true' || c === 'false')
    if (!toggle) continue
    const promptCell = cells.find((c) => /["'`]/.test(c) && c !== toggle && !/^-+$/.test(c))
    if (!promptCell) continue
    cases.push(normalize({ id: cells[0], prompt: promptCell.replace(/^["'`]|["'`]$/g, ''), should_trigger: toggle === 'true', description: cells[cells.length - 1] }))
  }
  return cases
}

function normalize(c) {
  const should = c.should_trigger ?? c.shouldTrigger ?? true
  return {
    id: String(c.id ?? ''),
    prompt: String(c.prompt ?? '').trim(),
    should_trigger: should === null || should === undefined ? null : Boolean(should),
    description: String(c.description ?? c.expected_behavior ?? '').trim(),
  }
}

function loadSkills() {
  const skills = []
  for (const dir of readdirSync(SKILLS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const file = join(SKILLS, dir.name, 'SKILL.md')
    if (!existsSync(file)) continue
    const { name, desc } = frontmatter(readFileSync(file, 'utf8'))
    const evalFile = join(SKILLS, dir.name, 'references', 'eval-cases.md')
    const cases = existsSync(evalFile) ? parseCases(readFileSync(evalFile, 'utf8')) : []
    skills.push({ dir: dir.name, name: name || dir.name, desc, cases })
  }
  return skills
}

function staticMode(skills) {
  const errors = [], warns = []
  const seen = new Map()
  for (const skill of skills) {
    if (skill.cases.length < MIN_CASES) warns.push(`${skill.name}: chỉ có ${skill.cases.length} eval case (khuyến nghị ≥ ${MIN_CASES})`)
    for (const c of skill.cases) {
      if (c.prompt.length < 6) errors.push(`${skill.name}#${c.id}: prompt rỗng/ngắn`)
      if (c.should_trigger === null) warns.push(`${skill.name}#${c.id}: thiếu should_trigger`)
      const explicit = (c.prompt.match(/^\/([a-z0-9-]+)/) || [])[1]
      if (explicit && explicit !== skill.name) warns.push(`${skill.name}#${c.id}: prompt gọi /${explicit} (routed) — kiểm tra đúng router`)
      const key = c.prompt.toLowerCase()
      if (seen.has(key)) warns.push(`${skill.name}#${c.id}: prompt trùng với ${seen.get(key)} (khác kỳ vọng thì OK)`)
      else seen.set(key, `${skill.name}#${c.id}`)
    }
  }
  const total = skills.reduce((n, s) => n + s.cases.length, 0)
  console.log(`skills: ${skills.length} | eval cases: ${total}`)
  for (const w of warns) console.log(`warn: ${w}`)
  for (const e of errors) console.error(`ERROR: ${e}`)
  console.log(`static: ${errors.length} error, ${warns.length} warn`)
  return errors.length ? 1 : 0
}

async function llmMode(skills) {
  const base = process.env.EVAL_BASE_URL
  const model = process.env.EVAL_MODEL
  const key = process.env.EVAL_API_KEY
  if (!base || !model) {
    console.error('llm mode cần EVAL_BASE_URL, EVAL_MODEL (và EVAL_API_KEY nếu cần)')
    return 2
  }
  const catalog = skills.filter((s) => s.cases.length).map((s) => `- ${s.name}: ${s.desc}`).join('\n')
  let all = skills.filter((s) => s.cases.length).flatMap((s) => s.cases.map((c) => ({ owner: s.name, ...c })))
  if (limit > 0) all = all.slice(0, limit)

  let ok = 0; let total = 0
  for (const c of all) {
    total++
    const expected = c.should_trigger === false ? 'NONE' : c.owner
    const body = {
      model,
      temperature: 0,
      max_tokens: 12,
      messages: [
        { role: 'system', content: `Bạn là router chọn skill cho coding agent. Danh sách skill:\n${catalog}\nTrả lời DUY NHẤT tên skill phù hợp, hoặc NONE nếu không skill nào phù hợp.` },
        { role: 'user', content: c.prompt },
      ],
    }
    let answer = 'ERROR'
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      answer = String(json?.choices?.[0]?.message?.content ?? '').trim().split(/\s+/)[0].replace(/[^a-z0-9-]/gi, '') || 'EMPTY'
    } catch (err) {
      answer = `ERROR:${err.message}`
    }
    const pass = answer.toLowerCase() === expected.toLowerCase()
    if (pass) ok++
    if (verbose || !pass) console.log(`${pass ? 'PASS' : 'FAIL'} ${c.owner}#${c.id} expected=${expected} got=${answer}`)
  }
  const acc = total ? ok / total : 0
  console.log(`llm: ${ok}/${total} (${(acc * 100).toFixed(1)}%)`)
  return acc >= 0.8 ? 0 : 1
}

const skills = loadSkills()
process.exit(mode === 'llm' ? await llmMode(skills) : staticMode(skills))
