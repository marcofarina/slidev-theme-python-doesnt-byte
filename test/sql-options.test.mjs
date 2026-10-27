// Test delle opzioni dei blocchi SQL (fase 14). `node --test test/sql-options.test.mjs`
//
// `dataset=` e `show=` dopo `{monaco-run}` diventano `runnerOptions` senza graffe annidate:
// Slidev copia le opzioni tra graffe fino alla prima `}`. Il sorgente TypeScript si carica con jiti.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createJiti } from 'jiti'
import MagicString from 'magic-string'

const jiti = createJiti(import.meta.url, { moduleCache: false })
const root = new URL('../', import.meta.url).pathname
const { applySqlOptions, parseSqlOptions, sqlOptionsTransformer } = await jiti.import(`${root}plugins/sql-options.ts`)

// La stessa espressione regolare di Slidev 53 (RE_MONACO in @slidev/cli): le opzioni finiscono
// alla prima `}`.
const RE_MONACO = /^([\w'-]+)?\s*\{(monaco[\w-]*)\}\s*(\{[^}]*\})?(.*)$/

function infoOf(markdown) {
  return markdown.split('\n')[0].replace(/^`{3,}|^~{3,}/, '')
}

test('dataset e show diventano runnerOptions, accanto alle opzioni già scritte', () => {
  const out = applySqlOptions('```sql {monaco-run} {autorun:false} dataset=hogwarts show=studente,casa\nSELECT 1;\n```')
  assert.equal(out.split('\n')[0], '```sql {monaco-run} {autorun:false, runnerOptions: Object.fromEntries([[\'dataset\',\'hogwarts\'],[\'show\',[\'studente\',\'casa\']]])}')
  const [, lang, monaco, options, rest] = RE_MONACO.exec(infoOf(out))
  assert.deepEqual([lang, monaco, rest], ['sql', 'monaco-run', ''])
  assert.ok(!options.slice(1, -1).includes('}'), 'nessuna graffa annidata')
  // L'espressione, valutata come la valuta Vue, dà le opzioni del runner.
  const bound = new Function(`return ${options}`)()
  assert.deepEqual(bound, { autorun: false, runnerOptions: { dataset: 'hogwarts', show: ['studente', 'casa'] } })
})

test('senza graffe e con un dataset in una sottocartella', () => {
  const out = applySqlOptions('~~~sql {monaco-run} dataset=archivista/registro-punti\nSELECT 1;\n~~~')
  const options = RE_MONACO.exec(infoOf(out))[3]
  assert.deepEqual(new Function(`return ${options}`)(), { runnerOptions: { dataset: 'archivista/registro-punti' } })
})

test('il resto non cambia: blocchi senza opzioni, altri linguaggi, blocchi dentro un recinto', () => {
  const same = [
    '```sql {monaco-run} {autorun:false}\nSELECT 1;\n```',
    '```sql\nSELECT 1; -- dataset=hogwarts\n```',
    '```python {monaco-run} dataset=hogwarts\nprint(1)\n```',
    '````md\n```sql {monaco-run} dataset=hogwarts\nSELECT 1;\n```\n````',
    'Testo con ```sql {monaco-run} dataset=hogwarts``` in linea.',
  ]
  for (const markdown of same)
    assert.equal(applySqlOptions(markdown), markdown)
})

test('due blocchi nella stessa slide', () => {
  const out = applySqlOptions([
    '```sql {monaco-run} dataset=a',
    'SELECT 1;',
    '```',
    '',
    '```sql {monaco-run} show=t',
    'SELECT 2;',
    '```',
  ].join('\n')).split('\n')
  assert.match(out[0], /runnerOptions: Object\.fromEntries\(\[\['dataset','a'\]\]\)\}$/)
  assert.match(out[4], /runnerOptions: Object\.fromEntries\(\[\['show',\['t'\]\]\]\)\}$/)
})

test('gli errori dicono che cosa non va e dove', () => {
  assert.throws(() => applySqlOptions('\n```sql {monaco-run} datset=hogwarts\n```'), /riga 2: opzione «datset=hogwarts» sconosciuta/)
  assert.throws(() => parseSqlOptions('dataset=../segreti'), /dataset «\.\.\/segreti» non valido/)
  assert.throws(() => parseSqlOptions('dataset='), /dataset «» non valido/)
  // Una virgola in coda non è un errore.
  assert.deepEqual(parseSqlOptions('show=studente,'), { show: ['studente'] })
  assert.throws(() => parseSqlOptions('show=stu-dente'), /show «stu-dente» non valido/)
  assert.throws(
    () => applySqlOptions('```sql {monaco-run} {runnerOptions: Object.fromEntries([])} dataset=a\n```'),
    /usa dataset= e show= oppure runnerOptions/,
  )
})

test('il transformer parte dal Markdown già trasformato e dice la slide', () => {
  const source = 'Testo\n\n```sql {monaco-run} dataset=hogwarts\nSELECT 1;\n```'
  const s = new MagicString(source)
  s.overwrite(0, source.length, source.replace('Testo', 'Testo con glossario'))
  sqlOptionsTransformer({ s, slide: { index: 0, frontmatter: {} } })
  assert.match(s.toString(), /^Testo con glossario/)
  assert.match(s.toString(), /runnerOptions/)
  assert.throws(
    () => sqlOptionsTransformer({ s: new MagicString('```sql {monaco-run} x=1\n```'), slide: { index: 4, frontmatter: {} } }),
    /\(slide 5\)$/,
  )
})
