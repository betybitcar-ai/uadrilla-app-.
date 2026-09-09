const express = require('express');
const session = require('express-session');
const path = require('path');

// Importar las rutas del backend
const authRoutes = require('./routes/auth');
const horariosRoutes = require('./routes/horarios');
const noticiasRoutes = require('./routes/noticias');
const ausenciasRoutes = require('./routes/ausencias');
const listaNegraRoutes = require('./routes/listaNegra');
const mensajesRoutes = require('./routes/mensajes');
const chatbotRoutes = require('./routes/chatbot');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares para procesar JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesiones
app.use(session({
  secret: 'clave-secreta-edusync',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Cambiar a true si usas HTTPS en producción
}));

// Servir archivos estáticos del frontend (HTML, CSS, JS) desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Montar las rutas de la API con sus prefijos correctos
app.use('/api/auth', authRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/noticias', noticiasRoutes);
app.use('/api/ausencias', ausenciasRoutes);
app.use('/api/lista-negra', listaNegraRoutes);
app.use('/api/mensajes', mensajesRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Ruta por defecto para manejar el frontend (SPA) en caso de recargas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});