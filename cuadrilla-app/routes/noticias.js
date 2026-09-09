const express = require('express');
const db = require('../db/database');

const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/noticias
// Cualquier usuario autenticado puede leer las noticias
router.get('/', requireAuth, (req, res) => {
    try {
        const noticias = db
            .prepare('SELECT * FROM noticias ORDER BY creado_en DESC')
            .all();

        res.json({ noticias });
    } catch (error) {
        console.error('Error al obtener noticias:', error);

        res.status(500).json({
            error: 'Error al obtener las noticias.'
        });
    }
});

// POST /api/noticias
// Solo los administradores pueden publicar noticias
// body: { titulo, contenido }
router.post('/', requireRole('admin'), (req, res) => {
    try {
        const { titulo, contenido } = req.body;

        if (!titulo || !contenido) {
            return res.status(400).json({
                error: 'Faltan campos obligatorios: titulo, contenido.'
            });
        }

        const info = db
            .prepare(`
                INSERT INTO noticias (
                    titulo,
                    contenido,
                    autor_id,
                    autor_nombre
                )
                VALUES (?, ?, ?, ?)
            `)
            .run(
                titulo,
                contenido,
                req.session.user.id,
                req.session.user.nombre
            );

        const noticia = db
            .prepare('SELECT * FROM noticias WHERE id = ?')
            .get(info.lastInsertRowid);

        res.status(201).json({
            mensaje: 'Noticia publicada correctamente.',
            noticia
        });

    } catch (error) {
        console.error('Error al publicar noticia:', error);

        res.status(500).json({
            error: 'Error al publicar la noticia.'
        });
    }
});

// DELETE /api/noticias/:id
// Solo los administradores pueden eliminar noticias
router.delete('/:id', requireRole('admin'), (req, res) => {
    try {
        const { id } = req.params;

        const noticia = db
            .prepare('SELECT * FROM noticias WHERE id = ?')
            .get(id);

        if (!noticia) {
            return res.status(404).json({
                error: 'Noticia no encontrada.'
            });
        }

        db
            .prepare('DELETE FROM noticias WHERE id = ?')
            .run(id);

        res.json({
            mensaje: 'Noticia eliminada correctamente.'
        });

    } catch (error) {
        console.error('Error al eliminar noticia:', error);

        res.status(500).json({
            error: 'Error al eliminar la noticia.'
        });
    }
});

module.exports = router;