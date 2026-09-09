const express = require('express');
const db = require('../db/database');

const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/horarios
// Ver todos los horarios o buscar
router.get('/', requireAuth, (req, res) => {
    const { search } = req.query;

    let horarios;

    if (search) {
        const searchTerm = `%${search}%`;

        horarios = db.prepare(`
            SELECT *
            FROM horarios
            WHERE materia LIKE ?
               OR profesor_nombre LIKE ?
               OR dia LIKE ?
            ORDER BY dia, hora_inicio
        `).all(searchTerm, searchTerm, searchTerm);
    } else {
        horarios = db.prepare(`
            SELECT *
            FROM horarios
            ORDER BY dia, hora_inicio
        `).all();
    }

    res.json({ horarios });
});

// POST /api/horarios
// Solo admin puede crear horarios
router.post('/', requireRole('admin'), (req, res) => {
    const {
        dia,
        hora_inicio,
        hora_fin,
        materia,
        salon
    } = req.body;

    if (!dia || !hora_inicio || !hora_fin || !materia) {
        return res.status(400).json({
            error: 'Faltan campos obligatorios: dia, hora_inicio, hora_fin, materia.'
        });
    }

    const info = db.prepare(`
        INSERT INTO horarios (
            dia,
            hora_inicio,
            hora_fin,
            materia,
            salon,
            estado,
            creado_por
        )
        VALUES (?, ?, ?, ?, ?, 'disponible', ?)
    `).run(
        dia,
        hora_inicio,
        hora_fin,
        materia,
        salon || null,
        req.session.user.id
    );

    const nuevoHorario = db.prepare(
        'SELECT * FROM horarios WHERE id = ?'
    ).get(info.lastInsertRowid);

    res.status(201).json({
        mensaje: 'Horario creado correctamente.',
        horario: nuevoHorario
    });
});

// DELETE /api/horarios/:id
// Solo admin puede eliminar horarios
router.delete('/:id', requireRole('admin'), (req, res) => {
    const { id } = req.params;

    const horario = db.prepare(
        'SELECT * FROM horarios WHERE id = ?'
    ).get(id);

    if (!horario) {
        return res.status(404).json({
            error: 'Horario no encontrado.'
        });
    }

    db.prepare(
        'DELETE FROM horarios WHERE id = ?'
    ).run(id);

    res.json({
        mensaje: 'Horario eliminado correctamente.'
    });
});

// POST /api/horarios/:id/reclamar
// Solo profesores pueden reclamar
router.post('/:id/reclamar', requireRole('profesor'), (req, res) => {
    const { id } = req.params;

    const horario = db.prepare(
        'SELECT * FROM horarios WHERE id = ?'
    ).get(id);

    if (!horario) {
        return res.status(404).json({
            error: 'Horario no encontrado.'
        });
    }

    if (horario.estado !== 'disponible') {
        return res.status(409).json({
            error: 'Este horario ya está ocupado.'
        });
    }

    db.prepare(`
        UPDATE horarios
        SET estado = 'ocupado',
            profesor_id = ?,
            profesor_nombre = ?
        WHERE id = ?
    `).run(
        req.session.user.id,
        req.session.user.nombre,
        id
    );

    const actualizado = db.prepare(
        'SELECT * FROM horarios WHERE id = ?'
    ).get(id);

    res.json({
        mensaje: 'Horario reclamado correctamente.',
        horario: actualizado
    });
});

// POST /api/horarios/:id/liberar
// Profesor asignado o admin puede liberar
router.post(
    '/:id/liberar',
    requireRole('profesor', 'admin'),
    (req, res) => {
        const { id } = req.params;

        const horario = db.prepare(
            'SELECT * FROM horarios WHERE id = ?'
        ).get(id);

        if (!horario) {
            return res.status(404).json({
                error: 'Horario no encontrado.'
            });
        }

        const esDueno =
            horario.profesor_id === req.session.user.id;

        const esAdmin =
            req.session.user.rol === 'admin';

        if (!esDueno && !esAdmin) {
            return res.status(403).json({
                error: 'Solo el profesor asignado o un admin pueden liberar este horario.'
            });
        }

        db.prepare(`
            UPDATE horarios
            SET estado = 'disponible',
                profesor_id = NULL,
                profesor_nombre = NULL
            WHERE id = ?
        `).run(id);

        const actualizado = db.prepare(
            'SELECT * FROM horarios WHERE id = ?'
        ).get(id);

        res.json({
            mensaje: 'Horario liberado correctamente.',
            horario: actualizado
        });
    }
);

module.exports = router;