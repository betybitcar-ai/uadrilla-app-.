const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const router = express.Router();

const PROFE_CODE = process.env.PROFE_CODE || 'PROFE-2026';
const ADMIN_CODE = process.env.ADMIN_CODE || 'ADMIN-2026';

// Middleware integrado para evitar errores de módulos externos faltantes
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
}

router.post('/register', (req, res) => {
  const { nombre, email, password, rol, codigo } = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, email, password, rol.' });
  }

  const rolesValidos = ['alumno', 'profesor', 'admin'];
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: `Rol inválido. Debe ser uno de: ${rolesValidos.join(', ')}.` });
  }

  if (rol === 'profesor' && codigo !== PROFE_CODE) {
    return res.status(403).json({ error: 'Código de acceso para profesor inválido.' });
  }
  if (rol === 'admin' && codigo !== ADMIN_CODE) {
    return res.status(403).json({ error: 'Código de acceso para administrador inválido.' });
  }

  const yaExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (yaExiste) {
    return res.status(409).json({ error: 'Ya existe un usuario registrado con ese email.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const info = db.prepare(`
    INSERT INTO usuarios (nombre, email, password_hash, rol)
    VALUES (?, ?, ?, ?)
  `).run(nombre, email, passwordHash, rol);

  const nuevoUsuario = {
    id: Number(info.lastInsertRowid),
    nombre,
    email,
    rol
  };

  req.session.user = nuevoUsuario;

  res.status(201).json({ mensaje: 'Usuario registrado correctamente.', usuario: nuevoUsuario });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan email o password.' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const passwordOk = bcrypt.compareSync(password, usuario.password_hash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const sesionUsuario = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  };

  req.session.user = sesionUsuario;

  res.json({ mensaje: 'Sesión iniciada correctamente.', usuario: sesionUsuario });
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
    }
    res.clearCookie('connect.sid');
    res.json({ mensaje: 'Sesión cerrada correctamente.' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'No hay sesión activa.' });
  }
  res.json({ usuario: req.session.user });
});

module.exports = router;