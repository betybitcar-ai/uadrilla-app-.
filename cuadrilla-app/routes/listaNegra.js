const express = require('express');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Cantidad de faltas a partir de la cual un profesor entra a la Lista Negra.
const LIMITE_FALTAS = 67;

// GET /api/lista-negra - exclusivo del Administrador.
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const profesoresEnLista = db.prepare(`
    SELECT
      profesor_id,
      profesor_nombre,
      COUNT(*) AS total_faltas,
      MAX(fecha) AS ultima_falta
    FROM ausencias
    WHERE profesor_id IS NOT NULL
    GROUP BY profesor_id, profesor_nombre
    HAVING COUNT(*) >= ?
    ORDER BY total_faltas DESC
  `).all(LIMITE_FALTAS);

  res.json({ limite_faltas: LIMITE_FALTAS, lista_negra: profesoresEnLista });
});

module.exports = router;