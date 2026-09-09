# Cuadrilla — Sistema de Horarios Académicos

Backend en Node.js + Express con base de datos SQL (SQLite vía el módulo
integrado `node:sqlite` — no requiere compilar nada ni instalar herramientas
de compilación, y es portable a Postgres/MySQL) y un frontend simple en
HTML/JS para probar todo el flujo: autenticación por roles, gestión de
horarios y un asistente con IA.

> **Requisito de versión:** Node.js 22.5 o superior (usa el módulo nativo
> `node:sqlite`). Si tenés una versión más vieja, actualizá Node antes de
> seguir — no hace falta instalar Python ni Visual Studio Build Tools.

## 1. Instalación

```bash
cd cuadrilla-app
npm install
cp .env.example .env
```

Editá `.env` y completá al menos `OPENAI_API_KEY` si querés usar el chatbot y
la generación de imágenes con DALL-E. Los códigos de acceso para registrarse
como profesor o admin también se configuran ahí (`PROFE-2026` / `ADMIN-2026`
por defecto).

## 2. Crear un admin de prueba (opcional)

```bash
npm run seed
```

Esto crea `admin@cuadrilla.com` / `admin123`. También podés registrarte
directamente desde la interfaz eligiendo el rol "Administrador" e ingresando
el código `ADMIN-2026`.

## 3. Levantar el servidor

```bash
npm start
```

Abrí `http://localhost:3000` en el navegador.

## 4. Estructura del proyecto

```
cuadrilla-app/
├── server.js              # Punto de entrada, configura Express y sesiones
├── db/
│   ├── database.js        # Conexión SQLite + esquema SQL de todas las tablas
│   └── seed.js             # Crea un admin de prueba
├── middleware/
│   └── auth.js             # requireAuth / requireRole
├── routes/
│   ├── auth.js              # /api/register /api/login /api/logout /api/me
│   ├── horarios.js          # CRUD de horarios + reclamar/liberar
│   ├── chatbot.js           # Lógica del asistente inteligente
│   ├── mensajes.js          # Mensajería interna
│   ├── ausencias.js         # Registro de ausencias
│   └── noticias.js          # Noticias institucionales
├── services/
│   └── openai.js            # Llamadas a la API de OpenAI (chat + DALL-E)
└── public/                  # Frontend estático (HTML/CSS/JS puro)
```

## 5. Roles y códigos de acceso

| Rol       | Código requerido |
|-----------|-------------------|
| Alumno    | Ninguno |
| Profesor  | `PROFE-2026` |
| Admin     | `ADMIN-2026` |

## 6. Endpoints principales

- `POST /api/register` — `{ nombre, email, password, rol, codigo? }`
- `POST /api/login` — `{ email, password }`
- `POST /api/logout`
- `GET  /api/me`
- `GET  /api/horarios`
- `POST /api/horarios` *(solo admin)* — `{ dia, hora_inicio, hora_fin, materia, salon }`
- `DELETE /api/horarios/:id` *(solo admin)*
- `POST /api/horarios/:id/reclamar` *(solo profesor)*
- `POST /api/horarios/:id/liberar` *(profesor dueño o admin)*
- `POST /api/chatbot` — `{ mensaje, historial? }`
- `GET/POST /api/mensajes`
- `GET/POST /api/ausencias`
- `GET/POST /api/noticias`, `DELETE /api/noticias/:id` *(solo admin)*

## 7. Cómo funciona el chatbot

El endpoint `/api/chatbot` detecta la intención del mensaje por palabras clave
antes de decidir qué hacer:

- **"genera una imagen..."** → llama a DALL-E (`services/openai.js`) con un
  prompt que describe la cuadrilla actual y devuelve una URL de imagen.
- **"no puedo dar clase" / "busca un reemplazo"** → registra la ausencia,
  busca automáticamente otro profesor libre en ese bloque horario y le
  envía un mensaje interno de tipo `relevo`.
- **"disponibilidad" / "quién está libre"** → responde con el estado 🟢/🔴
  de cada horario.
- **"tabla" / "exportar" / "cuadrilla completa"** → devuelve la grilla en
  una tabla Markdown.
- **"ausencias recientes"** → últimas 10 ausencias registradas.
- Cualquier otro mensaje se resuelve con una llamada de chat a OpenAI,
  usando como contexto (system prompt) el estado actual de la cuadrilla.

## 8. Migrar de SQLite a Postgres/MySQL

El esquema en `db/database.js` usa SQL estándar. Para migrar:

1. Reemplazá `node:sqlite` por `pg` (Postgres) o `mysql2` (MySQL).
2. Cambiá `AUTOINCREMENT` por `SERIAL` (Postgres) o `AUTO_INCREMENT` (MySQL).
3. Cambiá `datetime('now')` por `NOW()` (ambos) y reescribí las consultas
   `db.prepare(...).run(...)/.get(...)/.all(...)` a la API async del driver
   elegido (son cambios mecánicos, la lógica de negocio no cambia).

## 9. Notas de seguridad para producción

- Cambiá `SESSION_SECRET` por un valor largo y aleatorio.
- Poné `NODE_ENV=production` para que las cookies de sesión requieran HTTPS.
- Considerá mover los códigos de acceso (`PROFE-2026`/`ADMIN-2026`) a un
  proceso de invitación más robusto si el sistema crece.
