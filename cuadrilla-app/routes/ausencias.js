const express = require('express');
const db = require('../db/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/ausencias - listar ausencias (todas para admin, propias para profesor)
// Los alumnos no tienen acceso a este módulo.
router.get('/', requireRole('profesor', 'admin'), (req, res) => {
  const { user } = req.session;
  const selectConHorario = `
    SELECT
      a.*,
      h.dia AS horario_dia,
      h.hora_inicio AS horario_hora_inicio,
      h.hora_fin AS horario_hora_fin,
      h.materia AS horario_materia
    FROM ausencias a
    LEFT JOIN horarios h ON h.id = a.horario_id
  `;
  let ausencias;

  if (user.rol === 'admin') {
    ausencias = db.prepare(`${selectConHorario} ORDER BY a.fecha DESC`).all();
  } else {
    ausencias = db.prepare(`${selectConHorario} WHERE a.profesor_id = ? ORDER BY a.fecha DESC`).all(user.id);
  }

  res.json({ ausencias });
});

// POST /api/ausencias - profesores y admins pueden registrar una ausencia
// body: { profesor_id?, profesor_nombre?, horario_id?, motivo }
router.post('/', requireRole('profesor', 'admin'), (req, res) => {
  const { user } = req.session;
  const { profesor_id, profesor_nombre, horario_id, motivo } = req.body;

  if (!motivo) {
    return res.status(400).json({ error: 'El motivo de la ausencia es obligatorio.' });
  }

  // Si es profesor, la ausencia es sobre sí mismo salvo que un admin especifique otro profesor
  const idProfesor = user.rol === 'profesor' ? user.id : (profesor_id || user.id);
  const nombreProfesor = user.rol === 'profesor' ? user.nombre : (profesor_nombre || user.nombre);

  const info = db.prepare(`
    INSERT INTO ausencias (profesor_id, profesor_nombre, horario_id, motivo, registrado_por)
    VALUES (?, ?, ?, ?, ?)
  `).run(idProfesor, nombreProfesor, horario_id || null, motivo, user.id);

  const ausencia = db.prepare('SELECT * FROM ausencias WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ mensaje: 'Ausencia registrada correctamente.', ausencia });
});

module.exports = router;
