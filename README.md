# slidev-theme-python-doesnt-byte

Tema [Slidev](https://sli.dev) per le slide delle lezioni di *Python Doesn’t Byte*, il libro di testo aperto di Marco Farina (Rainbow Bits). Le slide si proiettano in classe o sulla LIM: poco testo, grande, tema chiaro per primo. Il design è quello del design system **Atmospheric**: tela 980 × 552, Crimson Pro e Monaspace, un colore per ciascuno dei quattro volumi.

Il tema porta con sé:

- 13 layout (copertina, sezione, codice, due colonne, definizione, citazione, dato, figura, domanda, esercizio, risultato, fine);
- i 14 callout del libro con la stessa sintassi (`:::tip`);
- codice colorato con i token del tema e blocchi **eseguibili offline**: Python con Pyodide, SQL con sql.js e pannello «Database»;
- domande a scelta multipla che rivelano la risposta al clic;
- virgolette curve automatiche, glossario con tooltip, diagrammi Mermaid disegnati con Pele;
- tre comandi di controllo dei deck: `pdb-check`, `pdb-verify`, `pdb-contact-sheet`.

Requisiti: Node 20.12 o successivo, Slidev 53.

## Installazione

Dalla cartella del deck:

```bash
npm i -D @slidev/cli slidev-theme-python-doesnt-byte
```

Nel `package.json` del deck, gli script che copiano i runtime offline in `public/` prima di ogni avvio e di ogni build:

```json
{
  "scripts": {
    "predev": "pdb-copy-pyodide && pdb-copy-sqljs",
    "dev": "slidev",
    "prebuild": "pdb-copy-pyodide && pdb-copy-sqljs",
    "build": "slidev build",
    "export": "slidev export"
  }
}
```

Un deck senza blocchi Python o SQL può toglierli. Le copie pesano 12,9 MB (Pyodide) e 0,7 MB (sql.js): aggiungile al `.gitignore` del deck.

```gitignore
public/pyodide/
public/sqljs/
contact-sheet/
```

## Headmatter minimo

La prima slide del deck porta questi campi. Il footer di ogni slide legge **Vol. N · Cap. NN · lezione**, e la slide `end` mostra il QR della lezione.

```yaml
---
theme: slidev-theme-python-doesnt-byte
title: Classi, istanze e metodi
volume: artefice
chapter: 3
lesson: Classi, istanze e metodi
lessonUrl: https://python.rainbowbits.cloud/artefice/classi-e-istanze/
---
```

| Campo | Valori | Note |
|---|---|---|
| `volume` | `programmatore`, `artefice`, `archivista`, `apprendista` | Dà il colore a kicker, pallini e icona del footer. Una slide può cambiarlo con lo stesso campo nel suo frontmatter. |
| `chapter` | numero | Si scrive a mano: le lezioni del libro non hanno un numero di capitolo. |
| `lesson` | testo | Titolo nel footer; se manca, il tema usa `title`. Oltre lo spazio disponibile prende i puntini. |
| `lessonUrl` | URL `https://…` | Compare sulla slide `end`, con il QR. |

`pdb-check` (vedi sotto) segnala un campo mancante o non valido.

## Layout

Il layout si sceglie con `layout:` nel frontmatter della slide. La slide 1 usa `cover` se non indichi altro; ogni altra slide usa `default`.

| Layout | Frontmatter | Slot | Quando |
|---|---|---|---|
| `cover` | | corpo: `# titolo` e una riga di sottotitolo | prima slide; il kicker «Volume N · …» viene dal volume |
| `section` | `section:` etichetta sopra il titolo (predefinito «Sezione») | | cambio di sezione |
| `default` | `kicker:` | | una idea per slide |
| `code` | `kicker:` | | un blocco di codice |
| `two-columns` | `cols:` `1-3`, `2-2`, `3-1`, `2-3` (predefinito `2-3`) | `::left::` e `::right::`, il titolo sta nel corpo | testo accanto al codice |
| `definition` | `kicker:` (predefinito «Definizione») | | un termine e la sua definizione |
| `quote` | | `::author::` (facoltativo) | citazione |
| `fact` | `fact:` etichetta sopra il numero | `::source::` (facoltativo) | un dato grande, per esempio `# $O(n)$` |
| `figure` | `figure: N` forza il numero | `::title::`, `::default::`, `::caption::` (facoltativo) | immagine, SVG o diagramma; la didascalia è «Figura N — …» |
| `question` | `kicker:` (predefinito «Domanda») | | domanda con `<Options>` |
| `exercise` | `kicker:` (predefinito «Prova tu») | | esercizio con un blocco eseguibile |
| `result` | | | **non si scrive**: lo genera `output: next` |
| `end` | | `::footer::` sostituisce l’URL sotto il titolo | ultima slide, con il QR della lezione |

````markdown
---
layout: two-columns
cols: 1-3
---

# Proporzioni 1-3

::left::

Il commento sta a sinistra.

::right::

```python
punti = (3, 7, 12)
print(sum(punti))
```
````

Una slide regge **11 righe** di codice (10 con il kicker); `pdb-check` ferma un blocco più lungo. Ogni slide ha una idea sola: se non ci sta, dividila o evidenzia per passi (`python {1|3-4|all}`).

## Callout

Gli stessi quattordici del libro, con la stessa sintassi. Il titolo dopo il nome è facoltativo: senza, il callout usa il titolo di default.

```markdown
:::tip
Stampa `type(oggetto)` per vedere a quale classe appartiene.
:::

:::learn Cosa imparerai
Creare una classe e istanziarla.
:::
```

Tipi: `prereq`, `learn`, `exercise`, `definition`, `history`, `code`, `cleancode`, `nutshell`, `mindmap`, `info`, `tip`, `warning`, `danger`, `note`. Un tipo sbagliato ferma `slidev build` con il numero della riga e l’elenco dei tipi validi.

## Domande

Un layout `question` con un `<Options>`: la lista ordinata diventa una griglia 2 × 2 con le lettere A–D. Al clic successivo la risposta giusta si evidenzia e le altre si attenuano; `wrong` marca una risposta sbagliata. Il colore non è mai l’unico segnale: ci sono anche l’icona e la parola.

````markdown
---
layout: question
---

# Che cosa stampa questo codice?

```python
print(sum((3, 7, 12)))
```

<Options answer="B" wrong="D">

1. `3`
2. `22`
3. `(3, 7, 12)`
4. un errore

</Options>
````

## Esercizi eseguibili

Un blocco ```` ```python {monaco-run} {autorun:false} ```` apre un editor con il pulsante «Esegui». Python gira nel browser con Pyodide (CPython 3.14), **senza rete**: `pdb-copy-pyodide` copia la distribuzione in `public/pyodide/` del deck.

````markdown
---
layout: exercise
---

# Prevedi, poi esegui

```python {monaco-run} {autorun:false}
registro = [("Harry", 10), ("Hermione", 25)]
for nome, punti in registro:
    print(nome, punti * 2)
```
````

- Ogni esecuzione è un programma nuovo, come `python file.py`: variabili globali vuote, stdout e stderr nell’output nell’ordine in cui arrivano. Un’eccezione dà l’ultima riga del traceback, segnata come errore.
- Il codice gira nel thread della pagina: un ciclo infinito blocca la presentazione finché non ricarichi.
- Nel runner normale l’output sta in 6 righe; se ne servono di più, usa `output: next`.
- `slidev export` esegue il codice una volta: il PDF mostra l’output.
- Per mostrare subito un errore in classe, vedi `verify: error` più sotto.

### `output: next`: il risultato in una slide sua

Con `output: next` nel frontmatter, il tema aggiunge dopo la slide una slide generata (layout `result`), titolata «<titolo>: il risultato», con l’output a tutta altezza (9 righe). «Esegui» porta lì invece di aprire l’output sotto il codice.

````markdown
---
layout: exercise
output: next
---

# Il tabellone delle Case

```python {monaco-run} {autorun:false}
…
```
````

La slide generata conta nella numerazione: tienine conto quando indichi un numero di slide.

## SQL

Un blocco ```` ```sql {monaco-run} ```` gira su SQLite compilato in WASM (sql.js, 0,7 MB), senza rete. `pdb-copy-sqljs` copia sql.js in `public/sqljs/` del deck.

I dati stanno in `public/sql/<nome>.sql` del deck: uno script SQL (`CREATE TABLE`, `INSERT`) che **ogni esecuzione rilegge da capo**, come ogni esecuzione Python parte da zero. Il blocco lo sceglie con `dataset=`; senza, parte da un database vuoto. Le chiavi esterne sono attive, come nel libro.

````markdown
---
layout: exercise
volume: archivista
output: next
---

# Tre modifiche, un pannello

```sql {monaco-run} {autorun:false} dataset=hogwarts show=studente
INSERT INTO studente (nome, casa, anno)
VALUES ('Luna Lovegood', 'Corvonero', 4);
DELETE FROM studente WHERE nome = 'Cedric Diggory';
```
````

Scrivi `dataset=` e `show=` **dopo** le graffe, non dentro: Slidev chiude le opzioni tra graffe alla prima `}`.

- Un `SELECT` mostra una tabella (fino a 8 righe, poi «… altre N righe»); `INSERT`, `UPDATE` e `DELETE` dicono quante righe hanno toccato. Un errore ferma le istruzioni successive e diventa l’ultima riga.
- `show=studente,casa` apre il pannello «Database»: le tabelle indicate prima e dopo le istruzioni, con le righe nuove (`+`), cambiate (`~`) e tolte (`−`) segnate anche dal colore. Mostra al massimo 5 righe per tabella. Il pannello sta nella slide del risultato (`output: next`), non sotto il codice; un `SELECT` e un pannello nella stessa esecuzione possono non starci nemmeno lì (in una prova mancavano 79 px): `pdb-verify` lo segnala, e la cura è dividere il blocco in due.

## Verifiche sul deck

Tre comandi, da lanciare dalla cartella del deck.

| Comando | Cosa fa | Richiede |
|---|---|---|
| `npx pdb-check slides.md` | Controllo strutturale, senza compilare: headmatter, layout, slot, `<Options>`, `output`, `verify`, glossario, blocchi di codice troppo lunghi, `__nome__` fuori dai backtick. Segue i `src:`. Esce con 1 se trova un difetto. | niente |
| `npx pdb-verify slides.md` | Compila il deck, lo apre in un browser senza finestra a 980 × 552 con tutti i clic fatti, esegue i blocchi Python e SQL e segnala: contenuto che esce dal footer o dal riquadro, codice più largo del suo riquadro, figure fuori cornice, blocchi che vanno in errore o non finiscono, output che scorre, richieste di rete (bloccate). | `playwright-chromium` |
| `npx pdb-contact-sheet slides.md` | Tutte le slide in un’immagine, tre per riga, numerate: `contact-sheet/slides.png`. Con `--out file.png` scegli il percorso. | `playwright-chromium` |

Per `pdb-verify` e `pdb-contact-sheet`:

```bash
npm i -D playwright-chromium
npx playwright install chromium
```

Ogni difetto è una riga `✗ <file>: slide N: <motivo>`, con N il numero del footer. Esempio:

```text
✗ slides.md: slide 6: blocco 1: l’output non sta nel riquadro e scorre (mancano 211 px): metti `output: next` nel frontmatter della slide, e il risultato avrà una slide sua
```

### `verify: error` e `verify: skip`

`pdb-verify` considera un difetto un blocco che va in errore. Quando l’errore è lo scopo dell’esercizio, dillo nel frontmatter della slide:

| Frontmatter | Effetto |
|---|---|
| `verify: error` | il blocco **deve** andare in errore; se finisce senza errori, è un difetto |
| `verify: skip` | il blocco non si esegue |

## Glossario, virgolette, diagrammi

**Glossario.** Il campo `glossary` nel frontmatter della slide aggiunge un tooltip a ogni occorrenza del termine nel testo di quella slide. Il termine si cerca a parola intera e con le maiuscole esatte (`attributi` non è `attributo`). Restano fuori codice, titoli, formule `$…$`, tag e link. Una definizione che contiene «: » va tra virgolette.

```yaml
---
glossary:
  istanza: Un oggetto creato a partire da una classe.
  attributo: "Un valore che appartiene a un oggetto: si legge con `oggetto.nome`."
---
```

**Virgolette curve.** Il sorgente `"classe"` e `l'oggetto` escono “classe” e l’oggetto; `...` esce …. Nel codice, in linea o a blocco, restano dritte.

**Diagrammi.** I blocchi ```` ```mermaid ```` si disegnano con [Pele](https://github.com/obsidianmd/pele) invece del Mermaid di Slidev. Il diagramma usa i colori del tema e segue il passaggio chiaro/scuro senza ridisegnarsi. Provati: `flowchart`, `classDiagram`, `erDiagram`, `sequenceDiagram`. Per una didascalia numerata mettilo in un layout `figure`.

## Tema chiaro e scuro

Il tema parte in chiaro. Slidev blocca il tema scelto nell’headmatter (`colorSchema: light` o `dark`) e il tasto `d` non lo cambia; per avere il cambio dal vivo scrivi `colorSchema: auto`: parte dalla preferenza del sistema operativo. `slidev export --dark` funziona solo con `auto`.

## Esportare

```bash
npx slidev export                  # PDF: una pagina per slide, con tutti i clic fatti
npx slidev export --with-clicks    # PDF: una pagina per ogni clic
npx slidev build                   # sito statico in dist/, anche da chiavetta
```

Con `--with-clicks`, una slide `question` produce due pagine: prima la domanda, poi la risposta rivelata. Il codice eseguibile gira anche durante l’export. L’export usa un browser: serve `playwright-chromium`, come per `pdb-verify`.

## Sviluppo del tema

Per lavorare sul tema stesso (non sui deck):

```bash
npm install
npm run dev          # example.md con ricarica a caldo
npm run build        # build statica di example.md
npm test             # unit test, check, verify, runner Python e SQL, test visivi
npm run tokens       # rigenera styles/tokens.css da tokens/tokens.json
npm run contrast     # controlla il contrasto di ogni coppia testo/fondo
```

`tokens/tokens.json` è la copia dei token di Atmospheric: **non modificare `styles/tokens.css` a mano**. I test visivi confrontano pixel per pixel il deck di prova e quattro deck dei volumi con le immagini di riferimento in `test/visual/baseline/`; dopo una modifica voluta, guarda le differenze e rigenera con `npm run test:visual:update`.

## Licenze

| Parte | Licenza |
|---|---|
| Codice del tema | MIT (`LICENSE`) |
| Font Crimson Pro e Monaspace (`fonts/`) | SIL Open Font License 1.1 (`fonts/OFL.txt`) |
| Logo e icone dei callout (`assets/`) | CC BY-NC-SA 4.0, come il libro: vietato l’uso commerciale |
| Pyodide, copiato nel deck da `pdb-copy-pyodide` | MPL-2.0 |
| sql.js, copiato nel deck da `pdb-copy-sqljs` | MIT |