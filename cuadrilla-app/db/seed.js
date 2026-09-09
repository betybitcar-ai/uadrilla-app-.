// Crea un usuario admin inicial para poder entrar al sistema la primera vez.
// Uso: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');

const email = 'admin@cuadrilla.com';
const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);

if (existe) {
  console.log('El admin de prueba ya existe:', email);
} else {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO usuarios (nombre, email, password_hash, rol)
    VALUES (?, ?, ?, 'admin')
  `).run('Administrador', email, hash);
  console.log('Admin de prueba creado:');
  console.log('  email:    admin@cuadrilla.com');
  console.log('  password: admin123');
}
