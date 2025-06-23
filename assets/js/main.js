// Inicializar Firebase Auth y Firestore
const auth = firebase.auth();

// Scroll suave al principio al hacer clic en el logo
document.getElementById('logo-scroll').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Mostrar partidos
function mostrarPartidos(partidos) {
  const container = document.getElementById('partidos-container');
  container.innerHTML = '';

  if (!Array.isArray(partidos)) return;

  partidos.sort((a, b) => {
    const fechaA = a.fecha ? new Date(a.fecha) : new Date(0);
    const fechaB = b.fecha ? new Date(b.fecha) : new Date(0);
    return fechaA - fechaB;
  });

  const partidosPorFecha = {};

  partidos.forEach((partido) => {
    const fechaObj = partido.fecha ? new Date(partido.fecha) : null;
    if (!fechaObj) return;

    const diaSemana = fechaObj.toLocaleDateString('es-ES', { weekday: 'short' });
    const diaNumero = fechaObj.getDate();
    const claveFecha = `${diaSemana} ${diaNumero}`;

    if (!partidosPorFecha[claveFecha]) partidosPorFecha[claveFecha] = [];
    partidosPorFecha[claveFecha].push(partido);
  });

  for (const claveFecha in partidosPorFecha) {
    const grupo = partidosPorFecha[claveFecha];

    // Contenedor general del grupo con fecha arriba
    const grupoDiv = document.createElement('div');
    grupoDiv.classList.add('grupo-fecha');

    // Fecha como encabezado centrado
    const fechaDiv = document.createElement('div');
    fechaDiv.classList.add('fecha');
    fechaDiv.textContent = claveFecha;
    grupoDiv.appendChild(fechaDiv);

    grupo.forEach((partido) => {
      const equipo1 = partido.equipo1;
      const equipo2 = partido.equipo2;

      const escudo1 = `Equipos/${removeTildes(equipo1.toLowerCase().replace(/\s/g, ''))}.png`;
      const escudo2 = `Equipos/${removeTildes(equipo2.toLowerCase().replace(/\s/g, ''))}.png`;

      const horaPartido = partido.fecha
        ? new Date(partido.fecha).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '00:00';

      const partidoDiv = document.createElement('div');
      partidoDiv.classList.add('partido');

      partidoDiv.innerHTML = `
        <div class="info-hora">
          <div class="info-equipos">
            <div class="equipo equipo1">
              <img src="${escudo1}" alt="${equipo1}" class="escudo" />
              <span>${equipo1}</span>
            </div>
            <div class="hora">${horaPartido}</div>
            <div class="equipo equipo2">
              <img src="${escudo2}" alt="${equipo2}" class="escudo" />
              <span>${equipo2}</span>
            </div>
          </div>
        </div>
        <div class="cuotas">
            <div class="cuota">
              <div class="nombre-equipo-cuota">${partido.equipo1}</div>
              <div class="valor-cuota">${partido.cuota1}</div>
            </div>
            <div class="cuota">
              <div class="nombre-equipo-cuota">Empate</div>
              <div class="valor-cuota">${partido.cuotaX}</div>
            </div>
            <div class="cuota">
              <div class="nombre-equipo-cuota">${partido.equipo2}</div>
              <div class="valor-cuota">${partido.cuota2}</div>
            </div>
          </div>
      `;

      grupoDiv.appendChild(partidoDiv);
    });

    container.appendChild(grupoDiv);
  }
}

function removeTildes(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}




// 🔄 Obtener partidos desde Firebase y mostrarlos
async function cargarPartidos() {
  try {
    const snapshot = await db.collection('partidos').get();
    const partidos = [];

    snapshot.forEach(doc => {
      partidos.push(doc.data());
    });

    mostrarPartidos(partidos);
  } catch (error) {
    console.error("Error al cargar partidos:", error);
  }
}

cargarPartidos();

// Mostrar datos de usuario en header
const headerLeft = document.getElementById('header-left');
const headerRight = document.getElementById('header-right');

auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      const userData = userDoc.data();

      // Mostrar saldo a la izquierda
      headerLeft.innerHTML = userData
        ? `${parseFloat(userData.saldo).toFixed(2)} €`
        : '';

      // Mostrar nombre de usuario y menú desplegable a la derecha
      headerRight.innerHTML = `
        <div class="user-menu" style="position: relative;">
          <span class="username" style="cursor:pointer;">${userData.username || user.email}</span>
          <div class="dropdown-content" id="dropdown-menu" style="
              display: none;
              position: absolute;
              right: 0;
              top: 100%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              border-radius: 4px;
              padding: 10px;
              opacity: 0;
              transition: opacity 0.3s ease;
              z-index: 1000;
            ">
            <a href="#" id="logout-link">Cerrar sesión</a>
          </div>
        </div>
      `;

      // Mostrar menú al pasar el mouse o hacer clic
      const username = document.querySelector('.username');
      const dropdownMenu = document.getElementById('dropdown-menu');

      let isMenuVisible = false;

      username.addEventListener('mouseenter', () => {
        dropdownMenu.style.display = 'block';
        requestAnimationFrame(() => {
          dropdownMenu.style.opacity = '1';
        });
        isMenuVisible = true;
      });

      username.addEventListener('mouseleave', () => {
        setTimeout(() => {
          if (!isMenuVisible) return;
          dropdownMenu.style.opacity = '0';
          setTimeout(() => dropdownMenu.style.display = 'none', 300);
        }, 200);
      });

      dropdownMenu.addEventListener('mouseenter', () => {
        isMenuVisible = true;
        dropdownMenu.style.opacity = '1';
      });

      dropdownMenu.addEventListener('mouseleave', () => {
        isMenuVisible = false;
        dropdownMenu.style.opacity = '0';
        setTimeout(() => dropdownMenu.style.display = 'none', 300);
      });

      // Logout
      document.getElementById('logout-link').addEventListener('click', async (e) => {
        e.preventDefault();
        await auth.signOut();
        window.location.href = 'login.html';
      });

    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
    }

  } else {
    // Usuario no logueado
    headerLeft.innerHTML = `<a href="register.html">Registrarse</a>`;
    headerRight.innerHTML = `<a href="login.html">Iniciar sesión</a>`;
  }
});
