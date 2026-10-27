-- Dataset «hogwarts» del deck di prova del tema (examples/sql.md).
-- Ogni Run di un blocco ```sql {monaco-run} dataset=hogwarts riparte da qui.

CREATE TABLE casa (
    nome      TEXT PRIMARY KEY,
    fondatore TEXT NOT NULL
);

CREATE TABLE studente (
    id    INTEGER PRIMARY KEY,
    nome  TEXT    NOT NULL UNIQUE,
    casa  TEXT    NOT NULL REFERENCES casa(nome),
    anno  INTEGER NOT NULL CHECK (anno BETWEEN 1 AND 7)
);

INSERT INTO casa (nome, fondatore) VALUES
    ('Grifondoro', 'Godric Grifondoro'),
    ('Serpeverde', 'Salazar Serpeverde'),
    ('Corvonero',  'Priscilla Corvonero'),
    ('Tassorosso', 'Tosca Tassorosso');

INSERT INTO studente (nome, casa, anno) VALUES
    ('Hermione Granger', 'Grifondoro', 5),
    ('Draco Malfoy',     'Serpeverde', 5),
    ('Cedric Diggory',   'Tassorosso', 6),
    ('Cho Chang',        'Corvonero',  6),
    ('Ginny Weasley',    'Grifondoro', 4),
    ('Neville Longbottom', 'Grifondoro', 5);
