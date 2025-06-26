/* =========================================================
   1.  CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyDgdI3UcnHuRlcynH-pCHcGORcGBAD3FSU",
  authDomain: "winnet-708db.firebaseapp.com",
  projectId: "winnet-708db",
  storageBucket: "winnet-708db.appspot.com",
  messagingSenderId: "869401097323",
  appId: "1:869401097323:web:fddb5e44af9d27a7cfed2e",
  measurementId: "G-12LH5QRVD0"
};
firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

/* =========================================================
   2.  UTILIDADES Y ELEMENTOS GLOBALES
   ========================================================= */
const betList      = document.getElementById('bet-list');
const tabCombi     = document.querySelector('.bs-tab[data-target="combi"]');
const totalOddsEl  = document.getElementById('total-odds');
const stakeInput   = document.getElementById('stake');
const winEl        = document.getElementById('potential-winnings');
const sidebar      = document.querySelector('.user-sidebar');
const mobileBtn    = document.querySelector('.mobile-menu-btn');
const bets         = [];   // almacén de selecciones

const qsButtons = document.querySelectorAll('.qs'); // botones 2 €, 5 €, etc.

/* =========================================================
   3.  LISTENER GENERALES
   ========================================================= */
mobileBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
stakeInput.addEventListener('input', updatePotentialWinnings);
qsButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const valor = parseFloat(btn.textContent) || 0;
    stakeInput.value = valor;
    updatePotentialWinnings();
  });
});
document.getElementById('clear-bets').addEventListener('click', () => {
  bets.length = 0;
  refreshSlip();
  cambiarPestania('simple');
});

/* =========================================================
   4.  REFRESH DEL SLIP Y GANANCIAS
   ========================================================= */
function refreshSlip() {
  /* ---- PINTAR APOSTADAS ---- */
  betList.innerHTML = '';
  bets.forEach(({ partido, tipo, cuota }, i) => {
    betList.insertAdjacentHTML('beforeend', `
      <li class="bs-item">
        <div class="bs-top">
          <span class="bs-deporte">⚽</span>
          <span class="bs-tipo">${tipo.toLowerCase().includes('empate') ? tipo : 'Gana ' + tipo}</span>
          <span class="bs-cuota">${cuota}</span>
        </div>
        <div class="bs-info">${partido}</div>
        <button class="bs-remove" data-index="${i}">✕</button>
      </li>
    `);
  });

  /* ---- CUOTA TOTAL Y CONTADOR ---- */
  const totalOdds = bets.reduce((acc, b) => acc * parseFloat(b.cuota), 1);
  totalOddsEl.textContent = bets.length ? totalOdds.toFixed(2).replace('.', ',') : '0,00';
  tabCombi.textContent    = `Combinada (${bets.length})`;

  /* ---- CAMBIO AUTOMÁTICO DE PESTAÑA ---- */
  cambiarPestania(bets.length >= 2 ? 'combi' : 'simple');

  /* ---- GANANCIAS POTENCIALES Y BOTÓN MÓVIL ---- */
  updatePotentialWinnings();
  refreshMobileButton();
}

function updatePotentialWinnings() {
  const stake = parseFloat(stakeInput.value) || 0;
  const cuota = parseFloat(totalOddsEl.textContent.replace(',', '.')) || 0;
  const win   = stake * cuota;
  winEl.textContent = win > 0 ? `${win.toFixed(2).replace('.', ',')} €` : '0,00 €';
}

function refreshMobileButton() {
  mobileBtn.classList.toggle('active', bets.length > 0);
}

/* =========================================================
   5.  CAMBIO MANUAL/AUTOMÁTICO DE PESTAÑAS
   ========================================================= */
document.querySelectorAll('.js-tab').forEach(tab => {
  tab.addEventListener('click', () => cambiarPestania(tab.dataset.target));
});
function cambiarPestania(target) {
  /* botones */
  document.querySelectorAll('.bs-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.target === target)
  );
  /* secciones */
  document.querySelectorAll('[data-content]').forEach(sec =>
    sec.style.display = sec.dataset.content === target ? 'block' : 'none'
  );
}

/* =========================================================
   6.  EVENTO PRINCIPAL: AÑADIR/QUITAR APUESTAS
   ========================================================= */
document.getElementById('partidos-container').addEventListener('click', e => {
  const btnCuota = e.target.closest('.cuota-btn');
  if (!btnCuota) return;

  const { partido, tipo } = btnCuota.dataset;
  const cuota = btnCuota.textContent.trim();

  if (bets.some(b => b.partido === partido)) {
    alert(`Ya tienes una apuesta de este partido en el carrito.`);
    return;
  }
  bets.push({ partido, tipo, cuota });
  refreshSlip();
  if (window.innerWidth <= 768) sidebar.classList.add('open');
});

/* Eliminar apuesta individual (delegado) */
betList.addEventListener('click', e => {
  if (!e.target.classList.contains('bs-remove')) return;
  const idx = parseInt(e.target.dataset.index, 10);
  if (!isNaN(idx)) {
    bets.splice(idx, 1);
    refreshSlip();
  }
});

/* =========================================================
   7.  CARGAR PARTIDOS DESDE FIRESTORE
   ========================================================= */
function removeTildes(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function cargarPartidos() {
  try {
    const snap = await db.collection('partidos').get();
    mostrarPartidos(snap.docs.map(d => d.data()));
  } catch (err) {
    console.error('Error cargando partidos:', err);
  }
}
cargarPartidos();

/* ------- Mostrar partidos (idéntico a tu lógica original) ------- */
function mostrarPartidos(partidos) {
  const cont = document.getElementById('partidos-container');
  cont.innerHTML = '';
  /* … (tu código de renderizado tal cual) … */
  // Al final:
  // — No necesitas asignarEventosCuotas: usamos delegación arriba —
}


// Scroll suave al principio al hacer clic en el logo
document.getElementById('logo-scroll').addEventListener('click', () => {
  console.log("Click en logo-scroll: scroll a inicio");
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Función para eliminar tildes y normalizar cadenas
function removeTildes(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Mostrar partidos en el contenedor
function mostrarPartidos(partidos) {
  console.log("Mostrar partidos recibidos:", partidos);
  const container = document.getElementById('partidos-container');
  container.innerHTML = '';

  if (!Array.isArray(partidos)) {
    console.error("mostrarPartidos: 'partidos' no es array");
    return;
  }

  partidos.sort((a, b) => {
    const fechaA = a.fecha ? new Date(a.fecha + 'T' + (a.hora || '00:00')) : new Date(0);
    const fechaB = b.fecha ? new Date(b.fecha + 'T' + (b.hora || '00:00')) : new Date(0);
    return fechaA - fechaB;
  });

  const partidosPorFecha = {};

  partidos.forEach((partido) => {
    if (!partido.fecha) {
      console.warn("Partido sin fecha:", partido);
      return;
    }

    // Convertir fecha a objeto Date para obtener día semana y día número
    const fechaObj = new Date(partido.fecha + 'T00:00');
    const diaSemana = fechaObj.toLocaleDateString('es-ES', { weekday: 'short' });
    const diaNumero = fechaObj.getDate();
    const claveFecha = `${diaSemana} ${diaNumero}`;

    if (!partidosPorFecha[claveFecha]) partidosPorFecha[claveFecha] = [];
    partidosPorFecha[claveFecha].push(partido);
  });

  for (const claveFecha in partidosPorFecha) {
    const grupo = partidosPorFecha[claveFecha];

    const grupoDiv = document.createElement('div');
    grupoDiv.classList.add('grupo-fecha');

    const fechaDiv = document.createElement('div');
    fechaDiv.classList.add('fecha');
    fechaDiv.textContent = claveFecha;
    grupoDiv.appendChild(fechaDiv);

    grupo.forEach((partido) => {
      const equipo1 = partido.equipo1;
      const equipo2 = partido.equipo2;

      const escudo1 = `Equipos/${removeTildes(equipo1.toLowerCase().replace(/\s/g, ''))}.png`;
      const escudo2 = `Equipos/${removeTildes(equipo2.toLowerCase().replace(/\s/g, ''))}.png`;

      const horaPartido = partido.hora || '00:00';

      // Buscar cuotas dentro de mercados.resultado.opciones
      // Asumimos que siempre existen las 3 cuotas: gana local (valor "1"), empate ("X"), gana visitante ("2")
      let cuota1 = '-';
      let cuotaX = '-';
      let cuota2 = '-';

      if (partido.mercados && partido.mercados.resultado && Array.isArray(partido.mercados.resultado.opciones)) {
        partido.mercados.resultado.opciones.forEach(opcion => {
          if (opcion.valor === "1") cuota1 = opcion.cuota.toFixed(2);
          else if (opcion.valor === "X") cuotaX = opcion.cuota.toFixed(2);
          else if (opcion.valor === "2") cuota2 = opcion.cuota.toFixed(2);
        });
      }

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
            <div class="nombre-equipo-cuota">${equipo1}</div>
            <button class="valor-cuota cuota-btn"
                    data-partido="${equipo1} vs ${equipo2}"
                    data-tipo="${equipo1}">
              ${cuota1}
            </button>
          </div>
          <div class="cuota">
            <div class="nombre-equipo-cuota">Empate</div>
            <button class="valor-cuota cuota-btn"
                    data-partido="${equipo1} vs ${equipo2}"
                    data-tipo="Empate">
              ${cuotaX}
            </button>
          </div>
          <div class="cuota">
            <div class="nombre-equipo-cuota">${equipo2}</div>
            <button class="valor-cuota cuota-btn"
                    data-partido="${equipo1} vs ${equipo2}"
                    data-tipo="${equipo2}">
              ${cuota2}
            </button>
          </div>
        </div>
      `;

      grupoDiv.appendChild(partidoDiv);
    });

    container.appendChild(grupoDiv);
  }

  asignarEventosCuotas();
  console.log("Partidos mostrados y eventos asignados.");
}

/* =========================================================
   AÑADIR APUESTA AL HACER CLIC EN CUALQUIER PARTE DE .cuota
   ========================================================= */
document.getElementById('partidos-container').addEventListener('click', e => {
  // 1) ¿Hiciste clic dentro de una caja .cuota (o en sus hijos)?
  const cuotaBox = e.target.closest('.cuota');
  if (!cuotaBox) return;                   // Fuera de .cuota ⟶ no hacer nada

  // 2) El botón real con la cuota numérica vive dentro de esa caja
  const btn = cuotaBox.querySelector('.cuota-btn');
  if (!btn) return;                        // Seguridad: no debería pasar

  // 3) Datos de la apuesta
  const partido = btn.dataset.partido;
  const tipo    = btn.dataset.tipo;
  const cuota   = btn.textContent.trim();

  // ‼️ 4) Solo UNA apuesta por partido
  if (bets.some(b => b.partido === partido)) {
    alert('Ya tienes una apuesta de este partido en el carrito.');
    return;
  }

  // 5) Añadimos y refrescamos
  bets.push({ partido, tipo, cuota });
  refreshSlip();
  if (window.innerWidth <= 768) sidebar.classList.add('open');
});


// Cargar partidos desde Firestore
async function cargarPartidos() {
  console.log("Cargando partidos desde Firestore...");
  try {
    const snapshot = await db.collection('partidos').get();
    const partidos = snapshot.docs.map(doc => doc.data());
    console.log("Partidos cargados:", partidos);
    mostrarPartidos(partidos);
  } catch (error) {
    console.error("Error al cargar partidos:", error);
  }
}
  cargarPartidos();


// Cerrar menú si haces clic fuera (opcional)
document.addEventListener('click', (e) => {
  if (
    !userSidebar.contains(e.target) &&
    !mobileMenuBtn.contains(e.target) &&
    userSidebar.classList.contains('open')
  ) {
    userSidebar.classList.remove('open');
  }
});



// HEADER //
// Mostrar datos de usuario y controlar login/logout
const headerLeft = document.getElementById('header-left');
const headerRight = document.getElementById('header-right');

auth.onAuthStateChanged(async (user) => {
  console.log("Cambio en estado de autenticación:", user);
  if (user) {
    try {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      const userData = userDoc.data();
      console.log("Datos del usuario:", userData);

      headerLeft.innerHTML = userData ? `${parseFloat(userData.saldo).toFixed(2)} €` : '';

      // Construir contenido del headerRight (usuario + menú)
      headerRight.innerHTML = `
        <div class="user-menu" style="position: relative; display: inline-block;">
          <span class="username" style="cursor:pointer;">${userData?.username || user.email}</span>
          <div class="dropdown-content" id="dropdown-menu" style="
              display: none;
              position: absolute;
              right: 0;
              top: 100%;
              box-shadow: 0 4px 8px rgba(255, 255, 0, 0.3);
              border-radius: 4px;
              padding: 10px;
              opacity: 0;
              transition: opacity 0.3s ease;
              z-index: 1000;
              background-color: var(--rojo-oscuro);
              font-size: 16px;
              min-width: 140px;
            ">
            ${userData?.rol === "admin" ? `<a href="admin.html" id="admin-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Panel Admin</a>` : ''}
            <a href="#" id="logout-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Cerrar sesión</a>
          </div>
        </div>
      `;

      const username = document.querySelector('.username');
      const dropdownMenu = document.getElementById('dropdown-menu');

      let menuOpen = false;

      // Función para abrir menú
      function openMenu() {
        dropdownMenu.style.display = 'block';
        requestAnimationFrame(() => {
          dropdownMenu.style.opacity = '1';
        });
        menuOpen = true;
      }

      // Función para cerrar menú
      function closeMenu() {
        dropdownMenu.style.opacity = '0';
        setTimeout(() => {
          dropdownMenu.style.display = 'none';
        }, 300);
        menuOpen = false;
      }

      // Al hacer hover *una vez*, abrir menú y fijar abierto
      username.addEventListener('mouseenter', () => {
        if (!menuOpen) openMenu();
      });

      // Detectar clic fuera del menú y del username para cerrar menú
      document.addEventListener('click', (event) => {
        const isClickInsideMenu = dropdownMenu.contains(event.target);
        const isClickOnUsername = username.contains(event.target);

        if (!isClickInsideMenu && !isClickOnUsername && menuOpen) {
          closeMenu();
        }
      });

      document.getElementById('logout-link').addEventListener('click', async (e) => {
        e.preventDefault();
        console.log("Cerrando sesión...");
        await auth.signOut();
        window.location.href = 'login.html';
      });

    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
    }
  } else {
    console.log("No hay usuario logueado.");
    headerLeft.innerHTML = `<a href="register.html" class="header-btn">Registrarse</a>`;
    headerRight.innerHTML = `<a href="login.html" class="header-btn">Iniciar sesión</a>`;
  }
});

/* ----------------------------------------------
   Botón flecha: abre/cierra el user-sidebar
   ---------------------------------------------- */
document.querySelector('.bs-toggle').addEventListener('click', () => {
  sidebar.classList.toggle('open');
});
