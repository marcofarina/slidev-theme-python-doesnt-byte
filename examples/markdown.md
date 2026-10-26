---
layout: two-columns
cols: 2-2
---

# Prerequisiti e obiettivi

::left::

:::prereq
Funzioni, liste e cicli `for`.
:::

::right::

:::learn Cosa imparerai
Creare una classe e istanziarla.
:::

---
layout: two-columns
cols: 2-2
---

# Esercizio e definizione

::left::

:::exercise
Aggiungi il metodo `rinasci()` alla classe `Fenice`.
:::

::right::

:::definition
Una **classe** è lo stampo da cui nascono gli oggetti.
:::

---
layout: two-columns
cols: 2-2
---

# Storia e sintassi

::left::

:::history
Il linguaggio Simula 67 introduce le classi.
:::

::right::

:::code
Il metodo `__init__` imposta lo stato iniziale.
:::

---
layout: two-columns
cols: 2-2
---

# Stile e sintesi

::left::

:::cleancode
Il nome di una classe descrive una cosa, non un’azione.
:::

::right::

:::nutshell
Una classe descrive un tipo di oggetto; ogni istanza ne è un esemplare.
:::

---
layout: two-columns
cols: 2-2
---

# Mappa e informazioni

::left::

:::mindmap
Classe → istanza → attributi e metodi.
:::

::right::

:::info
Python crea la classe quando esegue l'istruzione `class`.
:::

---
layout: two-columns
cols: 2-2
---

# Suggerimento e attenzione

::left::

:::tip
Stampa `type(oggetto)` per vedere a quale classe appartiene.
:::

::right::

:::warning
Senza `self` il metodo non riceve l'istanza.
:::

---
layout: two-columns
cols: 2-2
---

# Pericolo e nota

::left::

:::danger
Una lista come attributo di classe è condivisa da tutte le istanze.
:::

::right::

:::note
Le istanze di `Fenice` rinascono più volte.
:::

---
layout: default
kicker: Tipografia
---

# Virgolette curve in automatico

Il sorgente `"classe"` diventa "classe".

- L'apostrofo di `l'oggetto` diventa l'oggetto
- Nel codice inline resta dritto: `print("ciao")`
- I puntini `...` diventano ...

---
layout: default
kicker: Glossario
glossary:
  istanza: Un oggetto creato a partire da una classe.
  metodo: Una funzione definita dentro una classe.
  attributo: Un valore che appartiene a un oggetto. Si legge con `oggetto.nome`.
---

# Passa il mouse sui termini

Ogni istanza ha un attributo per ogni valore. Un metodo lo legge e lo modifica.

Nel codice, `metodo` e `istanza` restano fuori dal glossario.
