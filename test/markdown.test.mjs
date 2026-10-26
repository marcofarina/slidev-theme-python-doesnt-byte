// Test dei plugin Markdown del tema (fase 4). `node --test test/markdown.test.mjs`
//
// Si usa MarkdownExit, il parser di Slidev 53, con gli stessi plugin che registra
// `vite.config.ts`. I sorgenti TypeScript si caricano con jiti.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createJiti } from 'jiti'
import MagicString from 'magic-string'
import { MarkdownExit } from 'markdown-exit'

const jiti = createJiti(import.meta.url, { moduleCache: false })
const root = new URL('../', import.meta.url).pathname
const { callout } = await jiti.import(`${root}plugins/callout.ts`)
const { smartquotes } = await jiti.import(`${root}plugins/smartquotes.ts`)
const { calloutTypes } = await jiti.import(`${root}plugins/callout-types.ts`)
const { applyGlossary, readGlossary, glossaryTransformer } = await jiti.import(`${root}plugins/glossary.ts`)

// Le opzioni di Slidev (html: true) e i plugin del tema, nell'ordine di vite.config.ts.
function createMd() {
  const md = new MarkdownExit({ html: true, xhtmlOut: true, linkify: true })
  smartquotes(md)
  callout(md)
  return md
}
const md = createMd()
const render = src => md.render(src).trim()

// ── Virgolette curve ──────────────────────────────────────────────────────────

test('virgolette doppie e apostrofi diventano curvi', () => {
  assert.equal(render('Un "oggetto" e l\'istanza.'), '<p>Un “oggetto” e l’istanza.</p>')
})

test('virgolette singole annidate', () => {
  assert.equal(render('Scrive "dice \'ciao\' a tutti".'), '<p>Scrive “dice ‘ciao’ a tutti”.</p>')
})

test('apostrofo davanti a un numero', () => {
  assert.equal(render('Usa l\'8 bit'), '<p>Usa l’8 bit</p>')
})

// Limite noto di markdown-it: un apostrofo isolato a inizio parola (l'anno '99) non ha una
// virgoletta di chiusura e resta dritto; si scrive ’ a mano.
test('apostrofo isolato davanti a un numero: resta dritto', () => {
  assert.equal(render('Il \'99'), '<p>Il \'99</p>')
})

test('i puntini diventano un solo carattere', () => {
  assert.equal(render('Vedremo...'), '<p>Vedremo…</p>')
})

test('le altre sostituzioni del typographer restano spente', () => {
  assert.equal(render('(c) (tm) a -- b +-3'), '<p>(c) (tm) a -- b +-3</p>')
})

test('codice inline invariato', () => {
  assert.equal(render('Scrivi `print("ciao")` e "ok"'), '<p>Scrivi <code>print(&quot;ciao&quot;)</code> e “ok”</p>')
  assert.equal(render('Usa `a...b` qui...'), '<p>Usa <code>a...b</code> qui…</p>')
})

test('blocchi di codice invariati', () => {
  const html = render('```python\nprint("ciao") # l\'esempio...\n```')
  assert.match(html, /print\(&quot;ciao&quot;\)/)
  assert.ok(html.includes('l\'esempio...'))
  assert.doesNotMatch(html, /[“”’…]/)
})

test('attributi HTML e componenti Vue invariati', () => {
  assert.equal(
    render('Il <span title="l\'oggetto">"termine"</span> qui'),
    '<p>Il <span title="l\'oggetto">“termine”</span> qui</p>',
  )
  assert.equal(
    render('<Foo title="l\'oggetto" :items="[\'a\', \'b\']" />'),
    '<Foo title="l\'oggetto" :items="[\'a\', \'b\']" />',
  )
  assert.equal(
    render('Testo <Tooltip text="dice \'ciao\'...">"tupla"</Tooltip>.'),
    '<p>Testo <Tooltip text="dice \'ciao\'...">“tupla”</Tooltip>.</p>',
  )
})

test('interpolazioni Vue invariate, il testo intorno no', () => {
  assert.equal(
    render('Il "valore" {{ \'a\' + "b" }} e l\'altro...'),
    '<p>Il “valore” {{ \'a\' + &quot;b&quot; }} e l’altro…</p>',
  )
})

test('formule inline e titoli', () => {
  assert.equal(render('# L\'idea di "classe"'), '<h1>L’idea di “classe”</h1>')
})

// ── Callout ───────────────────────────────────────────────────────────────────

test('callout con titolo', () => {
  assert.equal(
    render(':::tip Una scorciatoia\nUsa `type()`.\n:::'),
    '<Callout type="tip" title="Una scorciatoia">\n<p>Usa <code>type()</code>.</p>\n</Callout>',
  )
})

test('callout con spazio dopo i due punti e senza titolo', () => {
  assert.equal(
    render('::: warning\nAttenzione al **doppio**.\n:::'),
    '<Callout type="warning">\n<p>Attenzione al <strong>doppio</strong>.</p>\n</Callout>',
  )
})

test('callout: il titolo ha virgolette curve ed è protetto', () => {
  assert.equal(
    render(':::info L\'uso di "if" & x < y\ntesto\n:::'),
    '<Callout type="info" title="L’uso di “if” &amp; x &lt; y">\n<p>testo</p>\n</Callout>',
  )
})

test('tutti i quattordici tipi sono accettati', () => {
  const names = Object.keys(calloutTypes)
  assert.equal(names.length, 14)
  for (const name of names)
    assert.match(render(`:::${name}\nx\n:::`), new RegExp(`^<Callout type="${name}">`))
})

test('callout: due callout nella stessa slide e testo intorno', () => {
  const html = render('Prima\n\n:::note\nuno\n:::\n\n:::danger Stop\ndue\n:::\n\nDopo')
  assert.equal(html.match(/<Callout /g).length, 2)
  assert.equal(html.match(/<\/Callout>/g).length, 2)
  assert.match(html, /^<p>Prima<\/p>/)
  assert.match(html, /<p>Dopo<\/p>$/)
})

test('callout di tipo sconosciuto: errore leggibile con la riga', () => {
  assert.throws(
    () => render('Testo\n\n:::consiglio Titolo\nx\n:::'),
    err => /callout sconosciuto «consiglio» \(riga 3 della slide\)/.test(err.message) && err.message.includes('tip'),
  )
})

// ── Glossario ─────────────────────────────────────────────────────────────────

const g = { tupla: 'Sequenza **immutabile**.', 'tupla annidata': 'Una tupla dentro una tupla.' }
const tip = (term, text) => `<Tooltip text="${text}">${term}</Tooltip>`

test('glossario: parola intera, non frammenti', () => {
  assert.equal(
    applyGlossary('Una tupla, due tuple, tuplare.', { tupla: 'T' }),
    `Una ${tip('tupla', 'T')}, due tuple, tuplare.`,
  )
})

test('glossario: parola intera anche con lettere accentate', () => {
  assert.equal(applyGlossary('perché sì', { perché: 'P' }), `${tip('perché', 'P')} sì`)
  assert.equal(applyGlossary('imperché', { perché: 'P' }), 'imperché')
})

test('glossario: ogni occorrenza, maiuscole esatte', () => {
  assert.equal(
    applyGlossary('Tupla e tupla', { tupla: 'T' }),
    `Tupla e ${tip('tupla', 'T')}`,
  )
})

test('glossario: vince il termine più lungo e i tooltip non si annidano', () => {
  const out = applyGlossary('Una tupla annidata contiene una tupla.', g)
  assert.equal(
    out,
    `Una ${tip('tupla annidata', 'Una tupla dentro una tupla.')} contiene una ${tip('tupla', 'Sequenza **immutabile**.')}.`,
  )
})

test('glossario: la definizione è protetta nell\'attributo', () => {
  assert.equal(
    applyGlossary('La tupla', { tupla: 'Dice "ciao"\nin `codice` <b>&</b>' }),
    `La ${tip('tupla', 'Dice &quot;ciao&quot; in &#96;codice&#96; &lt;b&gt;&amp;&lt;/b&gt;')}`,
  )
})

test('glossario: codice, titoli, formule, tag, link e commenti restano fuori', () => {
  const src = [
    '# La tupla',
    '',
    '```python',
    'tupla = (1, 2)',
    '```',
    '',
    '~~~',
    'tupla',
    '~~~',
    '',
    'Con `tupla` o ``una `tupla` qui`` no. Con $tupla^2$ no.',
    '<Foo tupla="tupla" /> {{ tupla }} [x](http://a/tupla) <!-- tupla -->',
    '',
    'Qui la tupla sì.',
  ].join('\n')
  const out = applyGlossary(src, { tupla: 'T' })
  assert.equal(out.match(/<Tooltip/g).length, 1)
  assert.ok(out.endsWith(`Qui la ${tip('tupla', 'T')} sì.`))
  assert.equal(out.replace(tip('tupla', 'T'), 'tupla'), src)
})

test('glossario: un blocco di codice senza chiusura protegge il resto', () => {
  const src = '```\ntupla'
  assert.equal(applyGlossary(src, { tupla: 'T' }), src)
})

test('glossario: il tooltip a inizio riga resta dentro il paragrafo', () => {
  const html = render(applyGlossary('Prima riga\ntupla subito dopo.\n\ntupla', { tupla: 'T' }))
  assert.equal(
    html,
    `<p>Prima riga\n${tip('tupla', 'T')} subito dopo.</p>\n<p>${tip('tupla', 'T')}</p>`,
  )
})

test('glossario: senza voci o con voci vuote il testo non cambia', () => {
  assert.equal(applyGlossary('tupla', {}), 'tupla')
  assert.equal(applyGlossary('tupla', { tupla: '  ' }), 'tupla')
})

test('glossario: il frontmatter deve essere una mappa di testi', () => {
  assert.equal(readGlossary(undefined, 'slide 1'), null)
  assert.deepEqual(readGlossary({ a: 'b' }, 'slide 1'), { a: 'b' })
  assert.throws(() => readGlossary(['a'], 'slide 4'), /glossary di slide 4/)
  assert.throws(() => readGlossary({ a: 3 }, 'slide 4'), /glossary di slide 4/)
})

test('glossario: il transformer di Slidev legge il frontmatter della slide', () => {
  const s = new MagicString('Una tupla qui.')
  glossaryTransformer({ s, slide: { index: 0, frontmatter: { glossary: { tupla: 'T' } } }, options: {} })
  assert.equal(s.toString(), `Una ${tip('tupla', 'T')} qui.`)

  const none = new MagicString('Una tupla qui.')
  glossaryTransformer({ s: none, slide: { index: 1, frontmatter: {} }, options: {} })
  assert.equal(none.toString(), 'Una tupla qui.')
})
