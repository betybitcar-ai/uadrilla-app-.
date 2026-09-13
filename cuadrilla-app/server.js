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
  secret: process.env.SESSION_SECRET || 'clave-secreta-edusync',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Servir archivos estáticos de la carpeta 'public'
app.use(express.static(path.resolve(__dirname, 'public')));

// Montar las rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/noticias', noticiasRoutes);
app.use('/api/ausencias', ausenciasRoutes);
app.use('/api/lista-negra', listaNegraRoutes);
app.use('/api/mensajes', mensajesRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Ruta catch-all para servir index.html en cualquier otra petición
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// Iniciar servidor solo en entorno local
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

// Exportar la instancia de Express para Vercel
module.exports = app;