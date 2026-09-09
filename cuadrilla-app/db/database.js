const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'cuadrilla.db');

const db = new Database(dbPath);

console.log('Conectado a la base de datos SQLite.');

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('alumno', 'profesor', 'admin')),
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    materia TEXT NOT NULL,
    salon TEXT,
    estado TEXT NOT NULL DEFAULT 'disponible'
      CHECK (estado IN ('disponible', 'ocupado')),
    profesor_id INTEGER,
    profesor_nombre TEXT,
    creado_por INTEGER NOT NULL,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (profesor_id)
      REFERENCES usuarios(id)
      ON DELETE SET NULL,

    FOREIGN KEY (creado_por)
      REFERENCES usuarios(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remitente_id INTEGER,
    remitente_nombre TEXT NOT NULL,
    destinatario_id INTEGER,
    destinatario_nombre TEXT,
    contenido TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'directo'
      CHECK (tipo IN ('directo', 'sistema', 'relevo')),
    leido INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (remitente_id)
      REFERENCES usuarios(id)
      ON DELETE SET NULL,

    FOREIGN KEY (destinatario_id)
      REFERENCES usuarios(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS ausencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profesor_id INTEGER,
    profesor_nombre TEXT NOT NULL,
    horario_id INTEGER,
    motivo TEXT NOT NULL,
    registrado_por INTEGER NOT NULL,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    reemplazo_asignado TEXT,

    FOREIGN KEY (profesor_id)
      REFERENCES usuarios(id)
      ON DELETE SET NULL,

    FOREIGN KEY (horario_id)
      REFERENCES horarios(id)
      ON DELETE SET NULL,

    FOREIGN KEY (registrado_por)
      REFERENCES usuarios(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS noticias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    autor_id INTEGER NOT NULL,
    autor_nombre TEXT NOT NULL,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (autor_id)
      REFERENCES usuarios(id)
      ON DELETE CASCADE
  );
`);

module.exports = db;