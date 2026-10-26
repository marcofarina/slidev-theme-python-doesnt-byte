---
layout: code
kicker: Capitolo 03
---

# Un contatore di rinascite

```python
class Fenice:
    def __init__(self, nome):
        self.nome = nome
        self.rinascite = 0

    def rinasci(self):
        self.rinascite += 1
        print(self.nome, "rinasce")
```

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

---
layout: two-columns
cols: 2-2
---

# Proporzioni 2-2

::left::

Le due colonne hanno la stessa larghezza.

- primo punto
- secondo punto

::right::

```python
for casa in ("Grifondoro", "Serpeverde"):
    print(casa)
```

---
layout: two-columns
cols: 3-1
---

# Proporzioni 3-1

::left::

Questa colonna è larga il triplo dell’altra: serve quando il testo è più lungo del codice.

::right::

```python
x = 3
```

---
layout: two-columns
---

# La sottoclasse eredita

::left::

`Fenice` non riscrive `__init__`: lo riceve da `Creatura`.

Aggiunge soltanto quello che la distingue.

::right::

```python
class Creatura:
    def __init__(self, nome):
        self.nome = nome

class Fenice(Creatura):
    def rinasci(self):
        print(self.nome, "rinasce")
```

---
layout: definition
---

# Tupla

Una sequenza ordinata di valori che, una volta creata, non si può modificare.

`punti = (3, 7, 12)`

---
layout: quote
---

Testo di prova: qui va una citazione vera, con la sua fonte.

::author::

Esempio per il layout quote

---
layout: fact
fact: Complessità
---

# $O(n)$

::source::

Per sommare `n` voci, il ciclo legge tutte le voci una volta.

---
layout: figure
---

::title::

# Due nomi, un solo oggetto

::default::

<svg width="560" height="220" viewBox="0 0 560 220" role="img" aria-label="Le variabili a e b puntano alla stessa lista">
  <g style="font-family: var(--font-mono); font-size: 20px; fill: var(--ink)">
    <rect x="20" y="40" width="96" height="48" rx="10" fill="var(--surface-chip)" stroke="var(--border-strong)" />
    <text x="68" y="71" text-anchor="middle">a</text>
    <rect x="20" y="132" width="96" height="48" rx="10" fill="var(--surface-chip)" stroke="var(--border-strong)" />
    <text x="68" y="163" text-anchor="middle">b</text>
    <rect x="300" y="80" width="240" height="60" rx="14" fill="var(--vol-tint)" stroke="var(--vol)" stroke-width="2" />
    <text x="420" y="117" text-anchor="middle">[3, 7, 12]</text>
  </g>
  <g stroke="var(--vol)" stroke-width="2.5" fill="none" stroke-linecap="round">
    <path d="M120 64 C200 64 220 100 296 104" />
    <path d="M120 156 C200 156 220 120 296 116" />
  </g>
</svg>

::caption::

`b = a` non copia la lista: crea un secondo nome per lo stesso oggetto.

---
layout: figure
---

::title::

# Il logo come immagine

::default::

![Logo di Python Doesn’t Byte](../assets/pdb-logo.svg)

::caption::

Un’immagine `img` si adatta alla cornice senza deformarsi.
