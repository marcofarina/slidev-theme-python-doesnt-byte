---
layout: exercise
output: next
---

# Il tabellone delle Case

Prevedi l’ordine delle Case, poi esegui: il risultato ha una slide sua.

```python {monaco-run} {autorun:false}
casate = {"Grifondoro": 482, "Serpeverde": 472,
          "Corvonero": 426, "Tassorosso": 352}

for casa in sorted(casate, key=casate.get, reverse=True):
    print(f"{casa}: {casate[casa]} punti")
    print("  " + "=" * (casate[casa] // 20))
```
