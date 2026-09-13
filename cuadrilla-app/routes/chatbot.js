const express = require('express');
const pool = require('../db/database'); // Conexión a MySQL
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers de datos (MySQL asíncronos)
// ---------------------------------------------------------------------------

async function obtenerHorarios() {
  const [rows] = await pool.query('SELECT * FROM horarios ORDER BY dia, hora_inicio');
  return rows;
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
      texto += `🔴 [ID ${h.id}] ${h.dia} ${h.hora_inicio}-${h.hora_fin} — ${h.materia} — Ocupado por ${h.profesor_nombre || 'docente'} (ID ${h.profesor_id})\n`;
    }
  }
  return texto;
}

async function buscarProfesorSuplente(horarioOcupado) {
  const [candidatos] = await pool.query(`
    SELECT DISTINCT id, nombre
    FROM profesores
    WHERE id != ?
  `, [horarioOcupado.profesor_id || -1]);

  for (const candidato of candidatos) {
    const [ocupado] = await pool.query(`
      SELECT id FROM horarios
      WHERE profesor_id = ? AND dia = ? AND hora_inicio = ?
    `, [candidato.id, horarioOcupado.dia, horarioOcupado.hora_inicio]);

    if (ocupado.length === 0) {
      return candidato;
    }
  }
  return null;
}

async function ausenciasRecientes(limite = 10) {
  const [rows] = await pool.query('SELECT * FROM ausencias ORDER BY fecha DESC LIMIT ?', [limite]);
  return rows;
}

function detectarIntencion(texto) {
  const t = texto.toLowerCase();

  if (/genera(r)?\s+(una\s+)?imagen|imagen\s+de\s+la\s+cuadrilla|dibuja|esquema|grafico/.test(t)) {
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
// ---------------------------------------------------------------------------

router.post('/', requireRole('profesor', 'admin'), async (req, res) => {
  const { mensaje } = req.body;
  const usuario = req.session.user;

  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  const intencion = detectarIntencion(mensaje);

  try {
    switch (intencion) {
      case 'generar_imagen': {
        const horarios = await obtenerHorarios();

        // Generar un gráfico vectorial SVG nativo sin APIs externas de IA
        let altoSVG = Math.max(200, horarios.length * 60 + 40);
        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="${altoSVG}" style="background-color: #1e1e2f; font-family: Arial, sans-serif;">`;
        
        svgContent += `<text x="20" y="30" fill="#ffffff" font-size="18" font-weight="bold">Esquema de Cuadrilla Horaria</text>`;

        horarios.forEach((h, index) => {
          let y = 60 + index * 55;
          let colorEstado = h.estado === 'disponible' ? '#4CAF50' : '#F44336';

          svgContent += `
            <rect x="20" y="${y}" width="460" height="45" rx="5" fill="#2d2d44" stroke="${colorEstado}" stroke-width="2"/>
            <text x="35" y="${y + 27}" fill="#ffffff" font-size="14">${h.dia} (${h.hora_inicio}-${h.hora_fin}) - ${h.materia}</text>
            <circle cx="450" cy="${y + 22}" r="8" fill="${colorEstado}"/>
          `;
        });

        svgContent += `</svg>`;

        const base64Svg = Buffer.from(svgContent).toString('base64');
        const dataUri = `data:image/svg+xml;base64,${base64Svg}`;

        return res.json({
          tipo: 'imagen',
          respuesta: 'Generé el esquema gráfico vectorial de la cuadrilla directamente con los datos del sistema:',
          imagen_url: dataUri
        });
      }

      case 'buscar_reemplazo': {
        const [horariosProfesor] = await pool.query(`
          SELECT * FROM horarios WHERE profesor_id = ? ORDER BY dia, hora_inicio LIMIT 1
        `, [usuario.id]);

        const horarioDelProfesor = horariosProfesor[0];

        if (!horarioDelProfesor) {
          return res.json({
            tipo: 'texto',
            respuesta: 'No encontré ningún horario asignado a tu nombre para buscar un reemplazo.'
          });
        }

        const suplente = await buscarProfesorSuplente(horarioDelProfesor);

        await pool.query(`
          INSERT INTO ausencias (profesor_id, profesor_nombre, horario_id, motivo, registrado_por, reemplazo_asignado)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          usuario.id,
          usuario.nombre,
          horarioDelProfesor.id,
          'Aviso vía chatbot',
          usuario.id,
          suplente ? suplente.nombre : null
        ]);

        if (!suplente) {
          return res.json({
            tipo: 'texto',
            respuesta: `Registré tu ausencia para ${horarioDelProfesor.dia} ${horarioDelProfesor.hora_inicio}-${horarioDelProfesor.hora_fin} (${horarioDelProfesor.materia}), pero no encontré ningún profesor disponible.`
          });
        }

        await pool.query(`
          INSERT INTO mensajes (remitente_id, remitente_nombre, destinatario_id, destinatario_nombre, contenido, tipo)
          VALUES (?, ?, ?, ?, ?, 'relevo')
        `, [
          usuario.id,
          usuario.nombre,
          suplente.id,
          suplente.nombre,
          `${usuario.nombre} no puede dar la clase de ${horarioDelProfesor.materia} el ${horarioDelProfesor.dia}. ¿Podés cubrir ese horario?`
        ]);

        return res.json({
          tipo: 'texto',
          respuesta: `Listo. Registré tu ausencia y le envié una notificación interna a **${suplente.nombre}**.`
        });
      }

      case 'disponibilidad': {
        const horarios = await obtenerHorarios();
        return res.json({
          tipo: 'texto',
          respuesta: `Este es el estado actual de la cuadrilla:\n\n${resumenDisponibilidad(horarios)}`
        });
      }

      case 'tabla_markdown':
      case 'listado_general': {
        const horarios = await obtenerHorarios();
        return res.json({
          tipo: 'texto',
          respuesta: `Cuadrilla completa:\n\n${tablaMarkdownHorarios(horarios)}`
        });
      }

      case 'ausencias_recientes': {
        const ausencias = await ausenciasRecientes();
        if (ausencias.length === 0) {
          return res.json({ tipo: 'texto', respuesta: 'No hay ausencias registradas recientemente.' });
        }
        let texto = 'Ausencias recientes:\n\n';
        for (const a of ausencias) {
          texto += `- ${a.fecha || 'Reciente'}: ${a.profesor_nombre || 'Docente'} — ${a.motivo}${a.reemplazo_asignado ? ` (reemplazo: ${a.reemplazo_asignado})` : ''}\n`;
        }
        return res.json({ tipo: 'texto', respuesta: texto });
      }

      case 'chat_libre':
      default: {
        const textoMsg = mensaje.toLowerCase();
        let respuestaSimulada = "Hola, soy el asistente de Cuadrilla. ¿En qué te puedo ayudar con los horarios?";

        if (textoMsg.includes('hola') || textoMsg.includes('buenos días')) {
          respuestaSimulada = `¡Hola ${usuario.nombre}! Estoy aquí para ayudarte a gestionar los horarios.`;
        } else if (textoMsg.includes('ayuda')) {
          respuestaSimulada = "Puedo mostrarte la disponibilidad, buscar reemplazos, listar ausencias o ver la tabla completa.";
        }

        return res.json({ tipo: 'texto', respuesta: respuestaSimulada });
      }
    }
  } catch (error) {
    console.error('Error en el chatbot:', error);
    res.status(500).json({ error: 'Ocurrió un error al procesar tu mensaje con el asistente.' });
  }
});

module.exports = router;