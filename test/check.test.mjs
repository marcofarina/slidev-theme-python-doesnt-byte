// pdb-check (fase 12): un deck di prova in test/fixtures/ per ogni errore, e uno valido.
// Ogni caso lancia il comando come lo lancia un deck: controlla l'uscita, la forma della riga
// «✗ <file>: slide N: <motivo>» e che il motivo nomini il difetto.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const check = fileURLToPath(new URL('../bin/check.mjs', import.meta.url))

function run(fixture) {
  const result = spawnSync(process.execPath, [check, `test/fixtures/${fixture}.md`], { cwd: root, encoding: 'utf8' })
  return { status: result.status, out: result.stdout, err: result.stderr }
}

// [fixture, dove, parte del motivo]
const ERRORS = [
  ['volume-sconosciuto', 'headmatter', 'volume «scrittore»'],
  ['chapter-non-numerico', 'headmatter', 'chapter «tre»'],
  ['lesson-mancante', 'headmatter', 'manca `lesson`'],
  ['lessonurl-non-https', 'headmatter', 'deve cominciare con https://'],
  ['layout-sconosciuto', 'slide 2', 'layout «center» non esiste nel tema'],
  ['two-columns-senza-slot', 'slide 2', 'manca lo slot ::right::'],
  ['slot-sconosciuto', 'slide 2', 'lo slot ::sinistra:: non esiste'],
  ['question-due-options', 'slide 2', '2 <Options>'],
  ['question-senza-answer', 'slide 2', '<Options> senza `answer`'],
  ['frontmatter-oggetto', 'slide 2', '`kicker:` contiene «: »'],
  ['dunder-fuori-backtick', 'slide 2', 'i nomi con __ vanno tra backtick'],
  ['codice-troppo-lungo', 'slide 2', 'blocco di codice di 12 righe'],
  ['verify-sconosciuto', 'slide 2', 'verify: «ignora»'],
  ['output-sconosciuto', 'slide 2', 'output: «sotto» non è valido'],
  ['output-senza-blocco', 'slide 2', '`output: next` senza un blocco eseguibile'],
  ['result-a-mano', 'slide 2', 'il layout «result» non si scrive a mano'],
]

test('un deck valido esce con 0', () => {
  const result = run('valido')
  assert.equal(result.status, 0, result.err)
  assert.match(result.out, /^✓ test\/fixtures\/valido\.md \(4 slide\)/)
  assert.equal(result.err, '')
})

for (const [fixture, where, reason] of ERRORS) {
  test(`${fixture}: esce con 1 e dice «${reason}»`, () => {
    const result = run(fixture)
    assert.equal(result.status, 1)
    const line = result.err.split('\n').find(row => row.includes(reason))
    assert.ok(line, `nessuna riga con «${reason}» in:\n${result.err}`)
    assert.ok(line.startsWith(`✗ test/fixtures/${fixture}.md: ${where}: `), `riga: ${line}`)
  })
}

test('output: next conta la slide generata, come Slidev', () => {
  const result = run('output-next')
  assert.equal(result.status, 0, result.err)
  assert.match(result.out, /^✓ test\/fixtures\/output-next\.md \(4 slide\)/)
})

test('senza argomenti stampa l’uso ed esce con 2', () => {
  const result = spawnSync(process.execPath, [check], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Uso: pdb-check/)
})

test('un file che non c’è esce con 1', () => {
  const result = spawnSync(process.execPath, [check, 'test/fixtures/non-esiste.md'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /il file non esiste/)
})

test('un deck che segue i src: segnala il file che contiene la slide', () => {
  const result = run('src-deck')
  assert.equal(result.status, 1)
  assert.match(result.err, /^✗ test\/fixtures\/src-sorgente\.md: slide 2: layout «center»/)
})
