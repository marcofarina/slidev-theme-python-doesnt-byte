// Test del tema Shiki (fase 3). `node --test test/shiki.test.mjs`
//
// Il setup si carica con jiti e passa da resolveShikiOptions di Slidev, come fa
// `slidev build`; i colori attesi si leggono da tokens/tokens.json, non si ricopiano.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { textmateThemeToMonacoTheme } from '@shikijs/monaco'
import { createJiti } from 'jiti'
import { createHighlighter } from 'shiki'

const root = new URL('../', import.meta.url)
const jiti = createJiti(import.meta.url, { moduleCache: false })

const setup = (await jiti.import(new URL('setup/shiki.ts', root).pathname)).default
const { resolveShikiOptions } = await jiti.import('@slidev/client/setup/shiki-options.ts')
const { options } = resolveShikiOptions([await setup({})])

const tokens = JSON.parse(readFileSync(new URL('tokens/tokens.json', root), 'utf8'))
const hex = name => tokens.color.tokens.find(t => t.name === name).value

const highlighter = await createHighlighter({
  themes: Object.values(options.themes),
  langs: ['python', 'json'],
})

const SAMPLE = [
  '# conta le rinascite',
  'def rinasci(volte=3):',
  '    for n in range(volte):  # passo',
  '        print(f"rinascita #{n}", 4.5, True)',
].join('\n')

// Span di testo dell'HTML di Shiki: testo, classi e stile, nell'ordine.
function spans(code, lang = 'python') {
  const hast = highlighter.codeToHast(code, { ...options, lang })
  const out = []
  const walk = (node) => {
    if (node.type === 'element' && node.tagName === 'span' && !String(node.properties.class ?? '').includes('line')) {
      const text = node.children.filter(c => c.type === 'text').map(c => c.value).join('')
      const cls = [node.properties.class ?? node.properties.className ?? []].flat().join(' ')
      out.push({ text, cls, style: String(node.properties.style ?? '').toLowerCase() })
      return
    }
    for (const child of node.children ?? [])
      walk(child)
  }
  walk(hast)
  return out
}

// Shiki fonde gli span vicini dello stesso colore: si cerca prima il testo esatto,
// poi uno span che contiene la parola intera.
const find = (list, text) => {
  const word = new RegExp(`(^|\\W)${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`)
  const span = list.find(s => s.text.trim() === text) ?? list.find(s => word.test(s.text))
  assert.ok(span, `nessuno span con il testo ${JSON.stringify(text)}`)
  return span
}

function assertColor(span, token) {
  const { light, dark } = hex(token)
  assert.match(span.style, new RegExp(`--shiki-light:${light.toLowerCase()}(;|$)`), `${span.text}: light di ${token}`)
  assert.match(span.style, new RegExp(`--shiki-dark:${dark.toLowerCase()}(;|$)`), `${span.text}: dark di ${token}`)
}

test('Slidev riceve due temi con nome e defaultColor: false', () => {
  assert.equal(options.defaultColor, false)
  assert.equal(options.themes.light.name, 'python-doesnt-byte-light')
  assert.equal(options.themes.dark.name, 'python-doesnt-byte-dark')
})

test('commenti: classe token-comment e colore code-comment', () => {
  const list = spans(SAMPLE)
  const comments = list.filter(s => s.cls.includes('token-comment'))
  assert.deepEqual(comments.map(s => s.text.trim()), ['# conta le rinascite', '# passo'])
  for (const span of comments)
    assertColor(span, 'code-comment')
})

test('un # dentro una stringa non è un commento', () => {
  const list = spans(SAMPLE)
  const inString = list.find(s => s.text.includes('rinascita #'))
  assert.ok(inString)
  assert.ok(!inString.cls.includes('token-comment'))
  assertColor(inString, 'code-string')
})

test('parole chiave, funzioni predefinite, numeri, costanti e nomi', () => {
  const list = spans(SAMPLE)
  for (const word of ['def', 'for', 'in', 'print', 'range'])
    assertColor(find(list, word), 'code-keyword')
  for (const number of ['3', '4.5', 'True'])
    assertColor(find(list, number), 'code-number')
  assertColor(find(list, 'rinasci'), 'code-fg')
  // L'operatore = si fonde con i nomi vicini, tutti in code-fg.
  assertColor(list.find(s => s.text.includes('=')), 'code-fg')
})

test('la classe dei commenti non dipende dal linguaggio né dal colore', () => {
  // JSON non ha commenti: nessuno span marcato, le chiavi restano stringhe.
  const list = spans('{"chiave": 1}', 'json')
  assert.ok(list.every(s => !s.cls.includes('token-comment')))
  assertColor(find(list, 'chiave'), 'code-string')
})

test('nessun corsivo nei temi', () => {
  for (const theme of Object.values(options.themes)) {
    for (const rule of theme.settings)
      assert.ok(!rule.settings.fontStyle, `${theme.name}: fontStyle in ${rule.scope}`)
  }
  assert.ok(spans(SAMPLE).every(s => !s.style.includes('font-style')))
})

test('Monaco accetta i temi (colori esadecimali)', () => {
  for (const theme of Object.values(options.themes)) {
    const monaco = textmateThemeToMonacoTheme(theme)
    for (const rule of monaco.rules)
      assert.match(rule.foreground ?? '000000', /^[0-9a-f]{6}$/)
    assert.equal(monaco.colors['editor.background'], hex('code-bg')[theme.type].toLowerCase())
  }
})
