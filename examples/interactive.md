---
layout: question
---

# Che cosa stampa questo codice?

```python
punti = (3, 7, 12)
print(sum(punti))
```

<Options answer="B" wrong="D">

1. `3`
2. `22`
3. `(3, 7, 12)`
4. un errore

</Options>

---
layout: exercise
---

# Prevedi, poi esegui

Prima di eseguire il codice, scrivi sul quaderno le tre righe che ti aspetti.

```python {monaco-run} {autorun:false}
registro = [("Harry", 10), ("Hermione", 25), ("Ron", 5)]

for nome, punti in registro:
    print(nome, punti * 2)
```

---
layout: exercise
---

# Dodici pozioni, zero studenti

Prevedi fin dove arriva il programma prima di fermarsi, poi eseguilo.

```python {monaco-run} {autorun:false}
pozioni = 12
studenti = 0
print("Ogni studente riceverà:")
print(pozioni / studenti)
```
