const express = require('express');
const db = require('../db/database');
const { requireRole } = require('../middleware/auth');
const { generarImagenCuadrilla } = require('../services/huggingface');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers de datos
// ---------------------------------------------------------------------------

function obtenerHorarios() {
  return db.prepare('SELECT * FROM horarios ORDER BY dia, hora_inicio').all();
}

function tablaMarkdownHorarios(horarios) {
  if (horarios.length === 0) return '_No hay horarios cargados todavía._';
  let tabla = '| Día | Hora | Materia | Profesor | Salón | Estado |\n';
  tabla += '|-----|------|---------|----------|-------|--------|\n';
  for (const h of horarios) {
    const estadoIcono = h.estado === 'disponible' ? '🟢 Disponible' : '🔴 Ocupado';
    tabla += `| ${h.dia} | ${h.hora_inicio}-${h.hora_fin} | ${h.materia} | ${h.profesor_nombre || '—'} | ${h.salon || '—'} | ${estadoIcono} |\n`;
  }
  return tabla;
}

function resumenDisponibilidad(horarios) {
  if (horarios.length === 0) return '_No hay horarios cargados todavía._';
  let texto = '';
  for (const h of horarios) {
    if (h.estado === 'disponible') {
      texto += `🟢 [ID ${h.id}] ${h.dia} ${h.hora_inicio}-${h.hora_fin} — ${h.materia} (${h.salon || 'sin salón'}) — Disponible\n`;
    } else {
      texto += `🔴 [ID ${h.id}] ${h.dia} ${h.hora_inicio}-${h.hora_fin} — ${h.materia} — Ocupado por ${h.profesor_nombre} (ID ${h.profesor_id})\n`;
    }
  }
  return texto;
}

function buscarProfesorSuplente(horarioOcupado) {
  const candidatos = db.prepare(`
    SELECT DISTINCT u.id, u.nombre
    FROM usuarios u
    WHERE u.rol = 'profesor' AND u.id != ?
  `).all(horarioOcupado.profesor_id || -1);

  for (const candidato of candidatos) {
    const ocupadoEnEseBloque = db.prepare(`
      SELECT id FROM horarios
      WHERE profesor_id = ? AND dia = ? AND hora_inicio = ?
    `).get(candidato.id, horarioOcupado.dia, horarioOcupado.hora_inicio);

    if (!ocupadoEnEseBloque) {
      return candidato;
    }
  }
  return null;
}

function ausenciasRecientes(limite = 10) {
  return db.prepare('SELECT * FROM ausencias ORDER BY fecha DESC LIMIT ?').all(limite);
}

// ---------------------------------------------------------------------------
// Detección simple de intenciones por palabras clave
// ---------------------------------------------------------------------------

function detectarIntencion(texto) {
  const t = texto.toLowerCase();

  if (/genera(r)?\s+(una\s+)?imagen|imagen\s+de\s+la\s+cuadrilla|dibuja/.test(t)) {
    return 'generar_imagen';
  }
  if (/no puedo dar clase|busca(r)?\s+(un\s+)?reemplazo|necesito\s+(un\s+)?reemplazo|falto|no voy a poder/.test(t)) {
    return 'buscar_reemplazo';
  }
  if (/disponib|qui[eé]n est[aá] libre|horarios libres/.test(t)) {
    return 'disponibilidad';
  }
  if (/tabla|cuadrilla completa|exporta|export[aá]|markdown/.test(t)) {
    return 'tabla_markdown';
  }
  if (/ausencias?\s+recientes|faltas?\s+recientes|inasistencias?\s+recientes/.test(t)) {
    return 'ausencias_recientes';
  }
  if (/listado\s+(general|de\s+clases)|todas\s+las\s+clases/.test(t)) {
    return 'listado_general';
  }
  return 'chat_libre';
}

// ---------------------------------------------------------------------------
// POST /api/chatbot
// body: { mensaje, historial? }
// ---------------------------------------------------------------------------

router.post('/', requireRole('profesor', 'admin'), async (req, res) => {
  const { mensaje, historial } = req.body;
  const usuario = req.session.user;

  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  const intencion = detectarIntencion(mensaje);

  try {
    switch (intencion) {
      // -----------------------------------------------------------------
      case 'generar_imagen': {
        const horarios = obtenerHorarios();
        const descripcion = horarios
          .map(h => `${h.dia} ${h.hora_inicio}-${h.hora_fin} ${h.materia} (${h.estado})`)
          .join('; ');

        const urlImagen = await generarImagenCuadrilla(descripcion || 'cuadrilla vacía');

        return res.json({
          tipo: 'imagen',
          respuesta: 'Generé un diseño esquemático de la cuadrilla mediante inteligencia artificial gratuita. Podés verlo en la imagen adjunta.',
          imagen_url: urlImagen
        });
      }

      // -----------------------------------------------------------------
      case 'buscar_reemplazo': {
        const horarioDelProfesor = db.prepare(`
          SELECT * FROM horarios WHERE profesor_id = ? ORDER BY dia, hora_inicio LIMIT 1
        `).get(usuario.id);

        if (!horarioDelProfesor) {
          return res.json({
            tipo: 'texto',
            respuesta: 'No encontré ningún horario asignado a tu nombre para poder buscar un reemplazo. ¿Podés indicarme el ID del horario?'
          });
        }

        const suplente = buscarProfesorSuplente(horarioDelProfesor);

        db.prepare(`
          INSERT INTO ausencias (profesor_id, profesor_nombre, horario_id, motivo, registrado_por, reemplazo_asignado)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          usuario.id,
          usuario.nombre,
          horarioDelProfesor.id,
          'Aviso vía chatbot: no puede dar clase',
          usuario.id,
          suplente ? suplente.nombre : null
        );

        if (!suplente) {
          return res.json({
            tipo: 'texto',
            respuesta: `Registré tu ausencia para ${horarioDelProfesor.dia} ${horarioDelProfesor.hora_inicio}-${horarioDelProfesor.hora_fin} (${horarioDelProfesor.materia}), pero no encontré ningún profesor disponible como reemplazo en ese horario.`
          });
        }

        db.prepare(`
          INSERT INTO mensajes (remitente_id, remitente_nombre, destinatario_id, destinatario_nombre, contenido, tipo)
          VALUES (?, ?, ?, ?, ?, 'relevo')
        `).run(
          usuario.id,
          usuario.nombre,
          suplente.id,
          suplente.nombre,
          `${usuario.nombre} no puede dar la clase de ${horarioDelProfesor.materia} el ${horarioDelProfesor.dia} de ${horarioDelProfesor.hora_inicio} a ${horarioDelProfesor.hora_fin}. ¿Podés cubrir ese horario?`
        );

        return res.json({
          tipo: 'texto',
          respuesta: `Listo. Registré tu ausencia para ${horarioDelProfesor.dia} ${horarioDelProfesor.hora_inicio}-${horarioDelProfesor.hora_fin} (${horarioDelProfesor.materia}) y le envié una notificación interna a **${suplente.nombre}** para que evalúe cubrir el horario.`
        });
      }

      // -----------------------------------------------------------------
      case 'disponibilidad': {
        const horarios = obtenerHorarios();
        return res.json({
          tipo: 'texto',
          respuesta: `Este es el estado actual de la cuadrilla:\n\n${resumenDisponibilidad(horarios)}`
        });
      }

      // -----------------------------------------------------------------
      case 'tabla_markdown': {
        const horarios = obtenerHorarios();
        return res.json({
          tipo: 'texto',
          respuesta: `Cuadrilla completa:\n\n${tablaMarkdownHorarios(horarios)}`
        });
      }

      // -----------------------------------------------------------------
      case 'ausencias_recientes': {
        const ausencias = ausenciasRecientes();
        if (ausencias.length === 0) {
          return res.json({ tipo: 'texto', respuesta: 'No hay ausencias registradas recientemente.' });
        }
        let texto = 'Ausencias recientes:\n\n';
        for (const a of ausencias) {
          texto += `- ${a.fecha}: ${a.profesor_nombre} — ${a.motivo}${a.reemplazo_asignado ? ` (reemplazo: ${a.reemplazo_asignado})` : ''}\n`;
        }
        return res.json({ tipo: 'texto', respuesta: texto });
      }

      // -----------------------------------------------------------------
      case 'listado_general': {
        const horarios = obtenerHorarios();
        return res.json({
          tipo: 'texto',
          respuesta: `Listado general de clases:\n\n${tablaMarkdownHorarios(horarios)}`
        });
      }

      // -----------------------------------------------------------------
      case 'chat_libre':
      default: {
        const textoMsg = mensaje.toLowerCase();
        let respuestaSimulada = "Hola, soy el asistente de Cuadrilla. ¿En qué te puedo ayudar con los horarios o las clases?";

        if (textoMsg.includes('hola') || textoMsg.includes('buenos días')) {
          respuestaSimulada = `¡Hola ${usuario.nombre}! Estoy aquí para ayudarte a gestionar los horarios y turnos de la cuadrilla.`;
        } else if (textoMsg.includes('ayuda') || textoMsg.includes('que sabes hacer')) {
          respuestaSimulada = "Puedo mostrarte la disponibilidad, buscar reemplazos, listar ausencias, generar imágenes o ver la tabla completa de horarios.";
        } else {
          respuestaSimulada = `Recibí tu consulta: "${mensaje}". Como estamos en modo local y gratuito, te sugiero consultar la sección de disponibilidad o la grilla general para más detalles.`;
        }

        return res.json({ tipo: 'texto', respuesta: respuestaSimulada });
      }
    }
  } catch (error) {
    console.error('Error en el chatbot:', error);
    res.status(500).json({
      error: 'Ocurrió un error al procesar tu mensaje con el asistente.'
    });
  }
});

module.exports = router;