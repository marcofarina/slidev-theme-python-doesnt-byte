---
layout: code
kicker: Codice
---

# Un blocco con tutti i colori

```python
# Il registro delle rinascite di ogni fenice
registro = {"Fanny": 3, "Ardente": 0}

def rinasci(nome, volte=1):
    """Aggiunge le rinascite e restituisce il totale."""
    registro[nome] += volte
    return registro[nome]

if rinasci("Fanny") > 3 and True:
    print(f"Fanny è rinata {registro['Fanny']} volte")  # 4
```

---
layout: code
kicker: Codice per passi
---

# Una riga alla volta

```python {1|3-4|6|all}
voti = [7, 8, 6, 9]

totale = 0
for voto in voti:
    totale += voto
media = totale / len(voti)
print(media)  # 7.5
```

---
layout: code
kicker: Dieci righe
---

# Il limite di un blocco

```python
class Fenice:
    def __init__(self, nome):
        self.nome = nome
        self.rinascite = 0

    def rinasci(self):
        self.rinascite += 1  # dalla cenere

fanny = Fenice("Fanny")
fanny.rinasci()
```

---
kicker: Codice inline
---

# Il codice dentro una frase

La funzione `len(voti)` conta gli elementi della lista, e `voti[0]` è il primo.

Un `dict` associa a ogni chiave un valore: `registro["Fanny"]` vale `3`.
