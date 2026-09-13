const express = require('express');
const pool = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/horarios - Ver todos los horarios o buscar con JOIN a profesores
router.get('/', requireAuth, async (req, res) => {
    const { search } = req.query;

    try {
        let query = `
            SELECT h.id, h.dia, h.hora_inicio, h.hora_fin, h.materia, h.salon, h.estado, h.profesor_id,
                   p.nombre AS profesor_nombre
            FROM horarios h
            LEFT JOIN profesores p ON h.profesor_id = p.id
        `;
        let params = [];

        if (search) {
            query += `
                WHERE h.materia LIKE ?
                   OR p.nombre LIKE ?
                   OR h.dia LIKE ?
            `;
            const searchTerm = `%${search}%`;
            params = [searchTerm, searchTerm, searchTerm];
        }

        query += ` ORDER BY FIELD(h.dia, 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES'), h.hora_inicio`;

        const [horarios] = await pool.query(query, params);
        res.json({ horarios });
    } catch (error) {
        console.error('Error al obtener horarios:', error);
        res.status(500).json({ error: 'Error al obtener los horarios de la base de datos.' });
    }
});

// POST /api/horarios - Crear nuevo horario (Solo Admin)
router.post('/', requireRole('admin'), async (req, res) => {
    const { dia, hora_inicio, hora_fin, materia, salon } = req.body;

    if (!dia || !hora_inicio || !hora_fin || !materia) {
        return res.status(400).json({
            error: 'Faltan campos obligatorios: dia, hora_inicio, hora_fin, materia.'
        });
    }

    try {
        const [result] = await pool.query(`
            INSERT INTO horarios (dia, hora_inicio, hora_fin, materia, salon, estado, creado_por)
            VALUES (?, ?, ?, ?, ?, 'disponible', ?)
        `, [dia, hora_inicio, hora_fin, materia, salon || null, req.session.user.id]);

        const [nuevo] = await pool.query('SELECT * FROM horarios WHERE id = ?', [result.insertId]);

        res.status(201).json({
            mensaje: 'Horario creado correctamente.',
            horario: nuevo[0]
        });
    } catch (error) {
        console.error('Error al crear horario:', error);
        res.status(500).json({ error: 'Error al guardar el horario.' });
    }
});

// DELETE /api/horarios/:id - Eliminar horario (Solo Admin)
router.delete('/:id', requireRole('admin'), async (req, res) => {
    const { id } = req.params;

    try {
        const [horarios] = await pool.query('SELECT * FROM horarios WHERE id = ?', [id]);

        if (horarios.length === 0) {
            return res.status(404).json({ error: 'Horario no encontrado.' });
        }

        await pool.query('DELETE FROM horarios WHERE id = ?', [id]);

        res.json({ mensaje: 'Horario eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar horario:', error);
        res.status(500).json({ error: 'Error al eliminar el horario.' });
    }
});

// POST /api/horarios/:id/reclamar - Reclamar horario (Solo Profesor)
router.post('/:id/reclamar', requireRole('profesor'), async (req, res) => {
    const { id } = req.params;

    try {
        const [horarios] = await pool.query('SELECT * FROM horarios WHERE id = ?', [id]);

        if (horarios.length === 0) {
            return res.status(404).json({ error: 'Horario no encontrado.' });
        }

        if (horarios[0].estado !== 'disponible') {
            return res.status(409).json({ error: 'Este horario ya está ocupado.' });
        }

        await pool.query(`
            UPDATE horarios
            SET estado = 'ocupado',
                profesor_id = ?
            WHERE id = ?
        `, [req.session.user.id, id]);

        const [actualizado] = await pool.query('SELECT * FROM horarios WHERE id = ?', [id]);

        res.json({
            mensaje: 'Horario reclamado correctamente.',
            horario: actualizado[0]
        });
    } catch (error) {
        console.error('Error al reclamar horario:', error);
        res.status(500).json({ error: 'Error al procesar el reclamo.' });
    }
});

// POST /api/horarios/:id/liberar - Liberar horario
router.post('/:id/liberar', requireRole('profesor', 'admin'), async (req, res) => {
    const { id } = req.params;

    try {
        const [horarios] = await pool.query('SELECT * FROM horarios WHERE id = ?', [id]);

        if (horarios.length === 0) {
            return res.status(404).json({ error: 'Horario no encontrado.' });
        }

        const horario = horarios[0];
        const esDueno = horario.profesor_id === req.session.user.id;
        const esAdmin = req.session.user.rol === 'admin';

        if (!esDueno && !esAdmin) {
            return res.status(403).json({
                error: 'Solo el profesor asignado o un admin pueden liberar este horario.'
            });
        }

        await pool.query(`
            UPDATE horarios
            SET estado = 'disponible',
                profesor_id = NULL
            WHERE id = ?
        `, [id]);

        const [actualizado] = await pool.query('SELECT * FROM horarios WHERE id = ?', [id]);

        res.json({
            mensaje: 'Horario liberado correctamente.',
            horario: actualizado[0]
        });
    } catch (error) {
        console.error('Error al liberar horario:', error);
        res.status(500).json({ error: 'Error al liberar el horario.' });
    }
});

module.exports = router;