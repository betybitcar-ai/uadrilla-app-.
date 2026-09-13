document.addEventListener('DOMContentLoaded', () => {
  // Manejo de pestañas de autenticación (Login / Registro)
  const tabs = document.querySelectorAll('.auth-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('is-active'));
      document.getElementById(`form-${target}`).classList.add('is-active');
    });
  });

  // Mostrar u ocultar campo de código según el rol seleccionado en el registro
  const selectRol = document.getElementById('select-rol');
  const campoCodigo = document.getElementById('campo-codigo');
  if (selectRol && campoCodigo) {
    selectRol.addEventListener('change', (e) => {
      if (e.target.value === 'admin' || e.target.value === 'profesor') {
        campoCodigo.style.display = 'block';
      } else {
        campoCodigo.style.display = 'none';
      }
    });
  }

  // Login de usuarios
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(formLogin);
      const data = Object.fromEntries(formData);
      const errorEl = document.getElementById('login-error');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error al iniciar sesión');

        // Guardar sesión y refrescar interfaz
        localStorage.setItem('usuario', JSON.stringify(result.usuario));
        verificarSesion();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  // Registro de usuarios
  const formRegistro = document.getElementById('form-registro');
  if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(formRegistro);
      const data = Object.fromEntries(formData);
      const errorEl = document.getElementById('registro-error');

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error al registrarse');

        alert('¡Cuenta creada con éxito! Ya podés ingresar.');
        document.querySelector('[data-tab="login"]').click();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  // Cerrar sesión
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('usuario');
      window.location.reload();
    });
  }

  // Navegación entre vistas del sistema
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('is-active'));
      item.classList.add('is-active');
      const vista = item.dataset.vista;
      document.querySelectorAll('.main-area .vista').forEach(v => v.classList.remove('is-active'));
      const vistaTarget = document.getElementById(`vista-${vista}`);
      if (vistaTarget) vistaTarget.classList.add('is-active');
    });
  });

  // Configuración de búsqueda y carga de horarios
  const btnBuscar = document.getElementById('btn-buscar-lupita');
  const inputBusqueda = document.getElementById('busqueda-horarios');

  if (btnBuscar && inputBusqueda) {
    btnBuscar.addEventListener('click', () => {
      cargarHorariosConFiltro(inputBusqueda.value);
    });

    inputBusqueda.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        cargarHorariosConFiltro(e.target.value);
      }
    });
  }

  // Eventos para interactuar con el chatbot
  const btnEnviarChat = document.getElementById('btn-enviar-chat');
  const inputChat = document.getElementById('input-mensaje-chat');

  if (btnEnviarChat && inputChat) {
    btnEnviarChat.addEventListener('click', enviarMensajeChatbot);
    inputChat.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') enviarMensajeChatbot();
    });
  }

  verificarSesion();
});

// Función para verificar si hay una sesión activa y configurar permisos
async function verificarSesion() {
  const usuarioStr = localStorage.getItem('usuario');
  const pantallaAuth = document.getElementById('pantalla-auth');
  const appPrincipal = document.getElementById('app-principal');

  if (!usuarioStr) {
    if (pantallaAuth) pantallaAuth.hidden = false;
    if (appPrincipal) appPrincipal.hidden = true;
    return;
  }

  const usuario = JSON.parse(usuarioStr);
  if (pantallaAuth) pantallaAuth.hidden = true;
  if (appPrincipal) appPrincipal.hidden = false;

  const userNombre = document.getElementById('user-nombre');
  const userRol = document.getElementById('user-rol');
  if (userNombre) userNombre.textContent = usuario.nombre;
  if (userRol) userRol.textContent = usuario.rol;

  // Mostrar u ocultar elementos exclusivos de administrador o staff
  if (usuario.rol === 'admin') {
    document.querySelectorAll('.btn-admin-only').forEach(el => el.hidden = false);
  }

  cargarHorariosConFiltro();
  cargarNoticias();
}

// Cargar y filtrar horarios
async function cargarHorariosConFiltro(query = '') {
  const url = query ? `/api/horarios?search=${encodeURIComponent(query)}` : '/api/horarios';
  try {
    const res = await fetch(url);
    const data = await res.json();
    const tbody = document.querySelector('#tabla-horarios tbody');
    const contenedorImg = document.getElementById('contenedor-imagen-horario');
    
    if (query.toLowerCase().includes('bt') || query.toLowerCase().includes('3º')) {
      if (contenedorImg) contenedorImg.hidden = false;
    } else {
      if (contenedorImg) contenedorImg.hidden = true;
    }

    if (!tbody) return;

    if (!data.horarios || data.horarios.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No se encontraron horarios</td></tr>`;
      return;
    }

    tbody.innerHTML = data.horarios.map(h => `
      <tr>
        <td>${h.dia}</td>
        <td>${h.hora_inicio} - ${h.hora_fin}</td>
        <td><strong>${h.materia}</strong></td>
        <td>${h.profesor_nombre || 'Sin asignar'}</td>
        <td>${h.salon || 'Sin salón'}</td>
        <td><span class="badge ${h.estado}">${h.estado}</span></td>
        <td></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error al cargar horarios:', err);
  }
}

// Cargar noticias institucionales
async function cargarNoticias() {
  try {
    const res = await fetch('/api/noticias');
    const data = await res.json();
    const contenedor = document.getElementById('lista-noticias');
    if (!contenedor) return;

    if (!data.noticias || data.noticias.length === 0) {
      contenedor.innerHTML = `<p>No hay noticias publicadas.</p>`;
      return;
    }

    contenedor.innerHTML = data.noticias.map(n => `
      <div class="tarjeta">
        <h3>${n.titulo}</h3>
        <p>${n.contenido}</p>
        <small>${n.fecha || ''}</small>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error al cargar noticias:', err);
  }
}

// Envío y recepción de mensajes con el chatbot
async function enviarMensajeChatbot() {
  const inputChat = document.getElementById('input-mensaje-chat');
  const contenedorMensajes = document.getElementById('chat-mensajes');
  if (!inputChat || !contenedorMensajes) return;

  const texto = inputChat.value.trim();
  if (!texto) return;

  // Agregar mensaje del usuario en pantalla
  contenedorMensajes.innerHTML += `<div class="mensaje usuario"><strong>Tú:</strong> ${texto}</div>`;
  inputChat.value = '';
  contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;

  try {
    const res = await fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: texto })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error en la respuesta');

    let htmlRespuesta = `<div class="mensaje bot"><strong>Asistente:</strong> ${data.respuesta}</div>`;

    // Si la respuesta incluye una imagen vectorial en formato SVG base64
    if (data.tipo === 'imagen' && data.imagen_url) {
      htmlRespuesta += `
        <div class="mensaje bot">
          <img src="${data.imagen_url}" alt="Esquema de Cuadrilla" style="max-width: 100%; border-radius: 8px; margin-top: 8px;">
        </div>
      `;
    }

    contenedorMensajes.innerHTML += htmlRespuesta;
    contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
  } catch (err) {
    contenedorMensajes.innerHTML += `<div class="mensaje error"><strong>Error:</strong> ${err.message}</div>`;
  }
}