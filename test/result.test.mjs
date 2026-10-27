// La slide del risultato (fase 13): la trasformazione delle righe di setup/result-slides.mjs.
// Ogni caso trasforma un deck scritto qui, poi lo fa leggere a @slidev/parser: le slide che
// conta Slidev sono la prova che la slide generata sta dove deve stare.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse } from '@slidev/parser'
import { addResultSlides, splitSlides } from '../setup/result-slides.mjs'

const FENCE = '```'

function transform(source) {
  const lines = source.split('\n')
  const added = addResultSlides(lines)
  return { added, text: lines.join('\n') }
}

async function slides(text) {
  const { slides } = await parse(text, 'deck.md')
  return slides.map(slide => ({ layout: slide.frontmatter.layout, title: slide.title, content: slide.content, frontmatter: slide.frontmatter }))
}

const deck = (...parts) => ['---', 'theme: ./', '---', '', '# Apertura', '', ...parts].join('\n')

const codeSlide = (frontmatter = ['layout: code', 'output: next'], title = '# Che cosa stampa?') => [
  '---',
  ...frontmatter,
  '---',
  '',
  title,
  '',
  `${FENCE}python {monaco-run} {autorun:false}`,
  'for i in range(3):',
  '    print(i)',
  FENCE,
  '',
]

test('genera la slide del risultato subito dopo la slide giusta', async () => {
  const { added, text } = transform(deck(...codeSlide(), '---', '', '# Dopo', ''))
  assert.equal(added, 1)
  const result = await slides(text)
  assert.deepEqual(result.map(slide => slide.title), ['Apertura', 'Che cosa stampa?', 'Che cosa stampa: il risultato', 'Dopo'])
  assert.equal(result[2].layout, 'result')
})

test('il blocco della slide generata è lo stesso, e parte da solo', async () => {
  const { text } = transform(deck(...codeSlide()))
  const [, code, generated] = await slides(text)
  assert.match(code.content, /\{monaco-run\} \{autorun:false\}/, 'la slide del codice non cambia')
  assert.match(generated.content, /```python \{monaco-run\} \{autorun:true\}\nfor i in range\(3\):\n {4}print\(i\)\n```/)
})

test('tiene le altre opzioni del blocco e toglie quelle che fermerebbero l’output', () => {
  const source = deck(
    '---',
    'output: next',
    '---',
    '',
    '# Opzioni',
    '',
    `${FENCE}python {monaco-run} {autorun:false, showOutputAt:'+1', outputHeight:'200px'} title`,
    'print(1)',
    FENCE,
  )
  const { text } = transform(source)
  assert.match(text, /```python \{monaco-run\} \{outputHeight:'200px', autorun:true\} title\nprint\(1\)/)
})

test('prende il titolo dal primo # fuori dai blocchi, senza la punteggiatura finale', async () => {
  const source = deck(
    '---',
    'output: next',
    '---',
    '',
    `${FENCE}python {monaco-run}`,
    '# un commento, non un titolo',
    'print("ciao")',
    FENCE,
    '',
    '# Il saluto…',
  )
  const { text } = transform(source)
  assert.equal((await slides(text))[2].title, 'Il saluto: il risultato')
})

test('senza titolo la slide generata si chiama «Il risultato»', async () => {
  const source = deck('---', 'output: next', '---', '', `${FENCE}python {monaco-run}`, 'print(1)', FENCE)
  const { text } = transform(source)
  assert.equal((await slides(text))[2].title, 'Il risultato')
})

test('ignora un --- dentro un blocco di codice, con ``` e con ~~~', async () => {
  for (const fence of ['```', '~~~~']) {
    const source = deck(
      '---',
      'output: next',
      '---',
      '',
      '# Separatori',
      '',
      `${fence}python {monaco-run}`,
      'print("---")',
      '---',
      'print("fine")',
      fence,
      '',
      '---',
      '',
      '# Dopo',
    )
    const lines = source.split('\n')
    assert.deepEqual(splitSlides(lines).map(slide => lines[slide.body + 1] ?? lines[slide.body]), ['# Apertura', '# Separatori', '# Dopo'], fence)
    addResultSlides(lines)
    const generated = lines.indexOf('# Separatori: il risultato')
    assert.ok(generated > lines.indexOf('print("fine")'), `${fence}: la slide generata sta dopo la chiusura del blocco`)
    assert.ok(generated < lines.indexOf('# Dopo'), `${fence}: e prima della slide successiva`)
    assert.deepEqual(lines.slice(generated + 2, generated + 7), [`${fence}python {monaco-run} {autorun:true}`, 'print("---")', '---', 'print("fine")', fence])
  }
})

test('ignora un --- dentro le note del relatore', async () => {
  const source = deck(...codeSlide(), '<!--', 'Nota: prima la previsione.', '---', 'poi l’esecuzione.', '-->', '', '---', '', '# Dopo')
  const { text } = transform(source)
  assert.deepEqual((await slides(text)).map(slide => slide.title), ['Apertura', 'Che cosa stampa?', 'Che cosa stampa: il risultato', 'Dopo'])
})

test('lascia intatto un deck senza output: next', () => {
  const source = deck(...codeSlide(['layout: code']), '---', '', '# Dopo', '')
  const { added, text } = transform(source)
  assert.equal(added, 0)
  assert.equal(text, source)
})

test('non genera niente senza un blocco eseguibile o in una slide nascosta', () => {
  const plain = deck('---', 'output: next', '---', '', '# Statico', '', `${FENCE}python`, 'print(1)', FENCE)
  assert.equal(transform(plain).added, 0)
  const hidden = deck(...codeSlide(['output: next', 'hide: true']))
  assert.equal(transform(hidden).added, 0)
})

test('copia nella slide generata verify e le chiavi della cornice', async () => {
  const source = deck(...codeSlide(['layout: exercise', 'output: "next"', 'verify: error', 'volume: archivista', 'kicker: Prova tu']))
  const { text } = transform(source)
  const generated = (await slides(text))[2]
  assert.deepEqual(generated.frontmatter, { layout: 'result', verify: 'error', volume: 'archivista' })
})

test('più slide con output: next, anche l’ultima del file', async () => {
  const source = deck(...codeSlide(), ...codeSlide(['output: next'], '# Seconda'))
  const { added, text } = transform(source)
  assert.equal(added, 2)
  assert.deepEqual((await slides(text)).map(slide => slide.title), [
    'Apertura',
    'Che cosa stampa?',
    'Che cosa stampa: il risultato',
    'Seconda',
    'Seconda: il risultato',
  ])
})

test('più blocchi eseguibili nella stessa slide passano tutti nella slide generata', async () => {
  const source = deck('---', 'output: next', '---', '', '# Due blocchi', '', `${FENCE}python {monaco-run}`, 'print(1)', FENCE, '', `${FENCE}python {monaco-run}`, 'print(2)', FENCE)
  const { text } = transform(source)
  const generated = (await slides(text))[2]
  assert.equal(generated.content.match(/\{monaco-run\} \{autorun:true\}/g).length, 2)
})
