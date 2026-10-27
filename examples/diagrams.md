---
layout: figure
---

::title::

# Una playlist di brani

::default::

```mermaid
classDiagram
    direction LR
    class Brano {
        +titolo
        +artista
        +durata
        +riproduci()
        +durata_minuti()
    }
    class Playlist {
        +nome
        +brani
        +aggiungi(brano)
        +riproduci_tutti()
    }
    Playlist o-- Brano : brani
```

::caption::

Una `Playlist` tiene una lista di oggetti `Brano` e li riproduce uno per uno.

---
layout: default
kicker: Incapsulamento
---

# Getter, setter o niente?

```mermaid
flowchart LR
    A["self.__x"] --> B{"Si legge<br/>da fuori?"}
    B -- "no" --> C["nessun getter"]
    B -- "sì" --> D{"Si scrive<br/>da fuori?"}
    D -- "no" --> E["solo getter"]
    D -- "sì" --> F["getter e setter"]
```

---
layout: default
kicker: Tabelle e relazioni
volume: archivista
---

# Studenti e voti

Ogni studente riceve zero o più voti; ogni voto è di un solo studente.

```mermaid
erDiagram
    direction LR
    STUDENTE ||--o{ VOTO : riceve
    STUDENTE {
        int id PK
        string nome
    }
    VOTO {
        int id PK
        int studente FK
        float valore
    }
```
