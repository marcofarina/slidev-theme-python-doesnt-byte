# Changelog

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/); le versioni seguono [semver](https://semver.org/lang/it/).

## 0.1.0 — 2026-10-27

Prima versione pubblicata. Non è ancora stata provata in classe: il deck pilota («Classi, istanze e metodi») arriva con la 1.0.0.

### Aggiunto

- **Token e font.** Token di Atmospheric (`tokens/tokens.json`) convertiti in variabili CSS per il tema chiaro e scuro; Crimson Pro e Monaspace in locale (OFL 1.1); `npm run contrast` controlla ogni coppia testo/fondo (soglia 4,5:1).
- **Cornice e layout.** `cover`, `section`, `default`, `code`, `two-columns`, `definition`, `quote`, `fact`, `figure`, `question`, `exercise`, `result`, `end`. Il footer mostra «Vol. N · Cap. NN · lezione» e il numero di slide; il volume (`volume:` nell’headmatter o nella slide) colora kicker, pallini e icona.
- **Codice.** Tema Shiki costruito dai token, commenti in Monaspace Radon, evidenziazione per passi.
- **Markdown.** I 14 callout del libro (`:::tip Titolo`), virgolette curve automatiche, glossario con tooltip (`glossary:` nel frontmatter).
- **Domande ed esercizi.** `<Options>` con rivelazione della risposta al clic; blocchi ```` ```python {monaco-run} ```` con Pyodide 314 offline, copiato nel deck da `pdb-copy-pyodide`.
- **SQL.** Blocchi ```` ```sql {monaco-run} dataset=… show=… ```` con sql.js offline (`pdb-copy-sqljs`), dataset in `public/sql/` del deck e pannello «Database» che mostra le righe nuove, cambiate e tolte.
- **`output: next`.** Il risultato di un blocco eseguibile in una slide sua, generata dal tema (layout `result`).
- **Diagrammi.** Mermaid disegnato con Pele, colorato dai token e senza ridisegno al cambio di tema.
- **QR della lezione** sulla slide `end`, da `lessonUrl`.
- **Verifiche dei deck.** `pdb-check` (controllo strutturale), `pdb-verify` (esecuzione in un browser senza finestra, misure sulla tela, `verify: error` e `verify: skip`), `pdb-contact-sheet` (provino con tutte le slide).
- **Test.** Unit test, test dei runner offline, test visivi con immagini di riferimento per `example.md` e per i quattro volumi.

### Limiti noti

- Un blocco di codice sta in 11 righe (10 con il kicker); l’output di un blocco eseguibile in 6 righe, 9 nella slide del risultato.
- Il codice Python gira nel thread della pagina: un ciclo infinito blocca la presentazione.
- `slidev export --dark` funziona solo con `colorSchema: auto`.
- La console del browser logga «Failed to patch FloatingVue» (dev, build ed export): viene dal codice di Slidev (`@shikijs/vitepress-twoslash`), non dal tema, e le slide non cambiano.
