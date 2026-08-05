#!/usr/bin/env node
// Guards against silently-broken Tailwind classes: our spacing/radius scales
// are restricted (tailwind.config.js), so an out-of-scale class like
// "size-20" doesn't error — it just generates no CSS. Same idea for raw
// palette colors bypassing the semantic tokens (src/theme/tokens.css).
// Run: node scripts/check-design-tokens.mjs (wired into `npm run lint`).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ALLOWED_SPACING = new Set([0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96])
const ALLOWED_RADIUS = new Set(['none', 'sm', 'md', 'lg', 'xl', 'full'])
const RAW_PALETTE = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'pink',
  'indigo',
  'gray',
  'slate',
  'zinc',
  'stone',
  'orange',
  'amber',
  'lime',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'violet',
  'fuchsia',
  'rose',
]

const SPACING_PREFIXES = [
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'gap',
  'gap-x',
  'gap-y',
  'space-x',
  'space-y',
  'w',
  'h',
  'size',
  'min-w',
  'min-h',
  'max-w',
  'max-h',
  'inset',
  'top',
  'bottom',
  'left',
  'right',
]

const spacingPattern = new RegExp(`\\b(${SPACING_PREFIXES.join('|')})-([0-9]+)\\b`, 'g')
const radiusPattern = /\brounded(-[a-z]+)?(-([a-z0-9]+))?\b/g
const palettePattern = new RegExp(
  `\\b(bg|text|border|ring|from|to|via|accent)-(${RAW_PALETTE.join('|')})-[0-9]+\\b`,
  'g'
)

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if (/\.(tsx?|jsx?)$/.test(entry)) files.push(path)
  }
  return files
}

const problems = []

for (const file of walk('src')) {
  const content = readFileSync(file, 'utf8')

  for (const match of content.matchAll(spacingPattern)) {
    const value = Number(match[2])
    if (!ALLOWED_SPACING.has(value)) {
      problems.push(`${file}: "${match[0]}" — ${value} isn't in the allowed spacing scale`)
    }
  }

  for (const match of content.matchAll(radiusPattern)) {
    // Skip compass-direction radius variants (rounded-t-xl etc.) — check
    // only the final size token. Bare "rounded" (no suffix) is also
    // invalid: this config defines no DEFAULT radius.
    const size = match[3] ?? (match[1] ? match[1].slice(1) : null)
    if (
      size === null ||
      (!ALLOWED_RADIUS.has(size) && !/^(t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee)$/.test(size))
    ) {
      problems.push(
        `${file}: "${match[0]}" — "${size ?? '(none)'}" isn't in the allowed radius scale`
      )
    }
  }

  for (const match of content.matchAll(palettePattern)) {
    problems.push(`${file}: "${match[0]}" — raw Tailwind color, use a semantic token instead`)
  }
}

if (problems.length > 0) {
  console.error(`Design token violations found (${problems.length}):\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('\nThese classes generate no CSS (spacing/radius) or bypass the semantic')
  console.error('color system (palette) — see tailwind.config.js and src/theme/tokens.css.')
  process.exit(1)
} else {
  console.log('Design token audit passed — no out-of-scale or raw-palette classes found.')
}
