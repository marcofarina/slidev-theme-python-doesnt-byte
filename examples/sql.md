---
layout: code
volume: archivista
kicker: SQL dal vivo
---

# Gli studenti del quinto anno

```sql {monaco-run} {autorun:false} dataset=hogwarts
SELECT nome, casa
FROM studente
WHERE anno = 5
ORDER BY nome;
```

---
layout: exercise
volume: archivista
output: next
---

# Tre modifiche, un pannello

Prevedi quali righe di `studente` cambiano, poi esegui.

```sql {monaco-run} {autorun:false} dataset=hogwarts show=studente
INSERT INTO studente (nome, casa, anno)
VALUES ('Luna Lovegood', 'Corvonero', 4);
UPDATE studente SET anno = 5 WHERE nome = 'Ginny Weasley';
DELETE FROM studente WHERE nome = 'Cedric Diggory';
```

---
layout: exercise
volume: archivista
verify: error
---

# Una casa che non c’è

Prevedi che cosa risponde il DBMS, poi esegui.

```sql {monaco-run} {autorun:false} dataset=hogwarts
INSERT INTO studente (nome, casa, anno)
VALUES ('Viktor Krum', 'Durmstrang', 7);
```
