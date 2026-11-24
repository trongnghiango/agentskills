#!/usr/bin/env node
/**
 * run-evals.mjs — kiểm tra cấu trúc và độ phân tách định tuyến (routing) cho bộ skill ka-*.
 *
 * Modes:
 *   static (mặc định, offline): kiểm tra cú pháp eval-cases.md, độ phủ, trùng lặp, slash-command lệch.
 *   heuristic (offline): chấm điểm khớp từ khoá + anti-trigger giữa prompt và description để đo độ chồng chéo catalog.
 *   llm: gọi endpoint OpenAI-compatible để đo routing thật trên model.
 *        EVAL_BASE_URL=https://.../v1 EVAL_MODEL=... EVAL_API_KEY=... node scripts/run-evals.mjs --mode llm
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
    } catch { /* ignore non-case JSON */ }
  }
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 3 || /^#?$/.test(cells[0]) || /^-+$/.test(cells[0])) continue
    const toggle = cells.find((c) => c === 'true' || c === 'false')
    if (!toggle) continue
    const promptCell = cells.find((c) => /["'`]/.test(c) && c !== toggle && !/^-+$/.test(c))
    if (!promptCell) continue
    cases.push(normalize({
      id: cells[0],
      prompt: promptCell.replace(/^["'`]|["'`]$/g, ''),
      should_trigger: toggle === 'true',
      description: cells[cells.length - 1],
    }))
  }
  return cases
}

function normalize(c) {
  const hasKey = 'should_trigger' in c || 'shouldTrigger' in c
  const raw = c.should_trigger ?? c.shouldTrigger
  const isScenario = String(c.prompt ?? '').trim().startsWith('(')
  const should = isScenario ? null : (hasKey ? (raw === null ? null : Boolean(raw)) : true)
  return {
    id: String(c.id ?? ''),
    prompt: String(c.prompt ?? '').trim(),
    scenario: isScenario,
    should_trigger: should,
    description: String(c.description ?? c.expected_behavior ?? c.reason ?? '').trim(),
  }
}

function loadSkills() {
  const skills = []
  for (const dir of readdirSync(SKILLS, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
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
  const seenPositive = new Map()
  for (const skill of skills) {
    if (skill.cases.length < MIN_CASES) warns.push(`${skill.name}: chỉ có ${skill.cases.length} eval case (khuyến nghị ≥ ${MIN_CASES})`)
    const triggerCases = skill.cases.filter((c) => !c.scenario)
    if (triggerCases.length === 0) warns.push(`${skill.name}: chưa có trigger eval case thực tế`)
    for (const c of skill.cases) {
      if (c.prompt.length < 6) errors.push(`${skill.name}#${c.id}: prompt rỗng/ngắn`)
      if (!c.scenario && c.should_trigger === null) warns.push(`${skill.name}#${c.id}: thiếu should_trigger`)
      const explicit = (c.prompt.match(/^\/([a-z0-9-]+)/) || [])[1]
      if (explicit && explicit !== skill.name && c.should_trigger === true) {
        warns.push(`${skill.name}#${c.id}: prompt gọi /${explicit} nhưng kỳ vọng ${skill.name}`)
      }
      if (!c.scenario && c.should_trigger === true) {
        const key = c.prompt.toLowerCase()
        if (seenPositive.has(key)) errors.push(`${skill.name}#${c.id}: trùng positive prompt với ${seenPositive.get(key)}`)
        else seenPositive.set(key, `${skill.name}#${c.id}`)
      }
    }
  }
  const total = skills.reduce((n, s) => n + s.cases.length, 0)
  const catalogChars = skills.reduce((n, s) => n + s.name.length + s.desc.length + 4, 0)
  console.log(`skills: ${skills.length} | eval cases: ${total} | catalog: ~${Math.round(catalogChars / 4)} tokens (${catalogChars} chars)`)
  for (const w of warns) console.log(`warn: ${w}`)
  for (const e of errors) console.error(`ERROR: ${e}`)
  console.log(`static: ${errors.length} error, ${warns.length} warn`)
  return errors.length ? 1 : 0
}

function tokenize(str) {
  return str
    .toLowerCase()
    .replace(/do not use[^.]*\.?/gi, ' ')
    .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ-]+/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
}

function heuristicMode(skills) {
  const stop = new Set(['khi', 'cần', 'cho', 'các', 'một', 'với', 'hoặc', 'hay', 'trong', 'của', 'trước', 'sau', 'the', 'and', 'for', 'with', 'when', 'use', 'from'])
  const profiles = skills.map((s) => {
    const posPart = s.desc.split(/do not use/i)[0] || s.desc
    const negPart = s.desc.split(/do not use/i)[1] || ''
    const aliasOnly = /^alias \(deprecated/i.test(s.desc)
    return {
      name: s.name,
      aliasOnly,
      pos: new Set(tokenize(posPart).filter((t) => !stop.has(t))),
      neg: new Set(tokenize(negPart).filter((t) => !stop.has(t) && !t.startsWith('ka-'))),
    }
  })

  let ok = 0, total = 0
  for (const s of skills) {
    for (const c of s.cases) {
      if (c.scenario || c.should_trigger === null) continue
      total++
      const explicit = (c.prompt.match(/^\/([a-z0-9-]+)/) || [])[1]
      let best = 'NONE', bestScore = 0
      if (explicit) {
        best = explicit
        bestScore = 10
      } else {
        const pTokens = tokenize(c.prompt).filter((t) => !stop.has(t))
        for (const prof of profiles) {
          if (prof.aliasOnly) continue
          let score = 0
          for (const t of pTokens) {
            if (prof.pos.has(t)) score += 2
            if (prof.neg.has(t)) score -= 1.5
          }
          if (score > bestScore) { bestScore = score; best = prof.name }
        }
        if (bestScore < 2) best = 'NONE'
      }
      const pass = c.should_trigger ? best === s.name : best !== s.name
      if (pass) ok++
      if (verbose || !pass) {
        console.log(`${pass ? 'PASS' : 'MISS'} ${s.name}#${c.id} (should=${c.should_trigger}) -> picked=${best} (score=${bestScore}) :: "${c.prompt}"`)
      }
    }
  }
  const pct = total ? ((ok / total) * 100).toFixed(1) : '0.0'
  console.log(`heuristic lexical baseline: ${ok}/${total} (${pct}%) — dùng --mode llm để đo semantic routing thật`)
  return 0
}

async function llmMode(skills) {
  const base = process.env.EVAL_BASE_URL
  const model = process.env.EVAL_MODEL
  const key = process.env.EVAL_API_KEY
  if (!base || !model) {
    console.error('llm mode cần EVAL_BASE_URL, EVAL_MODEL (và EVAL_API_KEY nếu cần)')
    return 2
  }
  const catalog = skills.map((s) => `- ${s.name}: ${s.desc}`).join('\n')
  let all = skills.flatMap((s) => s.cases.filter((c) => !c.scenario && c.should_trigger !== null).map((c) => ({ owner: s.name, ...c })))
  if (limit > 0) all = all.slice(0, limit)

  let ok = 0, total = 0
  for (const c of all) {
    total++
    const body = {
      model,
      temperature: 0,
      max_tokens: 16,
      messages: [
        { role: 'system', content: `Bạn là router chọn skill phù hợp nhất cho yêu cầu của developer. Danh sách skill:\n${catalog}\nTrả lời DUY NHẤT tên 1 skill phù hợp nhất, hoặc NONE nếu không cần skill nào.` },
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
    const picked = answer.toLowerCase()
    const pass = c.should_trigger ? picked === c.owner.toLowerCase() : picked !== c.owner.toLowerCase()
    if (pass) ok++
    if (verbose || !pass) console.log(`${pass ? 'PASS' : 'FAIL'} ${c.owner}#${c.id} should=${c.should_trigger} got=${answer}`)
  }
  const acc = total ? ok / total : 0
  console.log(`llm: ${ok}/${total} (${(acc * 100).toFixed(1)}%)`)
  return acc >= 0.8 ? 0 : 1
}

const skills = loadSkills()
if (mode === 'llm') process.exit(await llmMode(skills))
if (mode === 'heuristic') process.exit(heuristicMode(skills))
process.exit(staticMode(skills))
