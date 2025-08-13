/* =========================================================
   1.  CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
   ========================================================= */

/* ================= FIREBASE INIT =================== */
if (typeof firebaseConfig === "undefined") {
  var firebaseConfig = {
    apiKey: "AIzaSyDgdI3UcnHuRlcynH-pCHcGORcGBAD3FSU",
    authDomain: "winnet-708db.firebaseapp.com",
    projectId: "winnet-708db",
    storageBucket: "winnet-708db.appspot.com",
    messagingSenderId: "869401097323",
    appId: "1:869401097323:web:fddb5e44af9d27a7cfed2e",
    measurementId: "G-12LH5QRVD0"
  };
}
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db   = firebase.firestore();
const auth = firebase.auth();

/* ========== ELEMENTOS GLOBALES Y UTILIDADES ========== */
const betList      = document.getElementById('bet-list');
const totalOddsEl  = document.getElementById('total-odds');
const stakeInput   = document.getElementById('stake');
const winEl        = document.getElementById('potential-winnings');
const sidebar      = document.getElementById('userSidebar');
const mobileBtn    = document.getElementById('mobileMenuBtn');
const cartIcon      = document.getElementById('cartIcon');
const totalOddsText = document.getElementById('totalOddsText');
const betBadge      = mobileBtn ? mobileBtn.querySelector('.bet-badge') : null;
const qsButtons     = document.querySelectorAll('.qs');

/* ========== GLOBAL BETS ARRAY ========== */
let bets = []; // almacén de selecciones

// ==== LOCALSTORAGE Carrito ====
function guardarCarrito() {
  localStorage.setItem('carritoApuestas', JSON.stringify(bets));
}
function cargarCarrito() {
  try {
    const datos = localStorage.getItem('carritoApuestas');
    if (datos) {
      const arr = JSON.parse(datos);
      if (Array.isArray(arr)) {
        bets = arr;
      }
    }
  } catch {}
}

/* ============ FUNCIÓN LIMPIAR PARENTESIS TARJETAS ============ */
function limpiaParentesisTarjetas(tipo) {
  return tipo.replace(/\s*\([^)]+\)\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}

/* ============ PUBLIC API PARA OTRAS PÁGINAS ============ */
// Ahora recibe 'mercado'
window.addBetToSlip = function({ partido, tipo, cuota, partidoId, mercado }) {
  if (bets.some(b => b.partido === partido && b.tipo === tipo && b.mercado === mercado)) {
    alert('Ya tienes una apuesta de este tipo para este partido.');
    return;
  }
  bets.push({ partido, tipo, cuota, partidoId, mercado });
  guardarCarrito();
  refreshSlip();
  // if (window.innerWidth <= 768) openSidebar();
};

/* ================= LISTENERS GENERALES ================= */
if (stakeInput) {
  stakeInput.addEventListener('input', updatePotentialWinnings);
}
if (qsButtons.length) {
  qsButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const valor = parseFloat(btn.textContent) || 0;
      stakeInput.value = valor;
      updatePotentialWinnings();
    });
  });
}
const clearBtn = document.getElementById('clear-bets');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    bets = [];
    guardarCarrito();
    refreshSlip();
    cambiarPestania('simple');
  });
}

// ...código previo igual...

function refreshSlip() {
  if (!betList) return;
  betList.innerHTML = '';
  bets.forEach(({ partido, tipo, cuota, mercado }, i) => {
    let tipoTexto = tipo;

    // Personalización según mercado/acordeón
    if (mercado === 'resultado') {
      if (tipo === 'Empate') {
        tipoTexto = 'Empate';
      } else {
        tipoTexto = `Gana ${tipo}`;
      }
    } else if (mercado === 'tarjetas') {
      // tipo puede ser: "Menos de 1 tarjeta - Ambos equipos - Encuentro"
      let partes = tipo.split(' - ').map(s => s.trim());
      let main = '', cantidad = '', equipo = '', periodo = '';

      // 1. Extraer valores
      if (partes.length === 4) {
        // "Menos de - 1 - Ambos equipos - Encuentro"
        main = partes[0];
        cantidad = partes[1];
        equipo = partes[2];
        periodo = partes[3];
      } else if (partes.length === 3) {
        // "Menos de 1 tarjeta - Ambos equipos - Encuentro"
        // Extrae correctamente main y cantidad
        let match = partes[0].match(/(Más de|Menos de|Exactamente)\s*(\d+)/i);
        if (match) {
          main = match[1];
          cantidad = match[2];
        } else {
          // Si no matchea, usa todo como main
          main = partes[0];
        }
        equipo = partes[1];
        periodo = partes[2];
      } else {
        main = tipo; // fallback
      }

      // 2. Limpiar main de cualquier cosa entre paréntesis o extra
      main = main.replace(/\(.*/, '').replace(/\d+\)\s*$/, '').trim();

      // 3. Construir texto final
      let cantidadTexto = cantidad ? ` ${cantidad} tarjeta${cantidad == 1 ? '' : 's'}` : '';
      tipoTexto = `Tarjetas: ${main} ${periodo ? ' - ' + periodo : ''}${equipo ? ' - ' + equipo : ''}`;
    } else if (mercado === 'corners') {
      tipoTexto = `Corners: ${tipo}`;
    } else {
      tipoTexto = tipo;
    }

    betList.insertAdjacentHTML('beforeend', `
      <li class="bs-item">
        <div class="bs-top">
          <span class="bs-deporte">⚽</span>
          <span class="bs-tipo">${tipoTexto}</span>
          <span class="bs-cuota">${cuota}</span>
          <button class="bs-remove" data-index="${i}">✕</button>
        </div>
        <div class="bs-info">${partido}</div>
      </li>
    `);
  });

  const totalOdds = bets.reduce((acc, b) => acc * parseFloat(b.cuota), 1);
  if (totalOddsEl) {
    totalOddsEl.textContent = bets.length ? totalOdds.toFixed(2).replace('.', ',') : '0,00';
  }
  // Pestaña combinada (si existe en tu HTML)
  const tabCombi = document.querySelector('.bs-tab[data-target="combi"]');
  if (tabCombi) tabCombi.textContent = `Combinada (${bets.length})`;
  cambiarPestania && cambiarPestania(bets.length >= 2 ? 'combi' : 'simple');
  updatePotentialWinnings();
  updateMobileButton();
  actualizarBadgeApuestas();
  guardarCarrito();
}


function updatePotentialWinnings() {
  if (!stakeInput || !winEl || !totalOddsEl) return;
  const stake = parseFloat(stakeInput.value) || 0;
  const cuota = parseFloat(totalOddsEl.textContent.replace(',', '.')) || 0;
  const win   = stake * cuota;
  winEl.textContent = win > 0 ? `${win.toFixed(2).replace('.', ',')} €` : '0,00 €';
}

function updateMobileButton() {
  if (!cartIcon || !totalOddsText || !totalOddsEl) return;
  const total = parseFloat(totalOddsEl.textContent.replace(',', '.')) || 0;
  if (!bets.length) {
    cartIcon.style.display      = 'inline';
    totalOddsText.style.display = 'none';
  } else {
    cartIcon.style.display      = 'none';
    totalOddsText.style.display = 'inline';
    totalOddsText.textContent   = total.toFixed(2).replace('.', ',');
  }
}

function actualizarBadgeApuestas() {
  if (!betBadge) return;
  const cantidad = bets.length;
  if (cantidad > 0) {
    betBadge.style.display = 'inline-block';
    betBadge.textContent = cantidad;
  } else {
    betBadge.style.display = 'none';
  }
}

/* =============== ELIMINAR APUESTA INDIVIDUAL ================ */
if (betList) {
  betList.addEventListener('click', e => {
    if (!e.target.classList.contains('bs-remove')) return;
    const idx = parseInt(e.target.dataset.index, 10);
    if (!isNaN(idx)) {
      bets.splice(idx, 1);
      guardarCarrito();
      refreshSlip();
    }
  });
}

/* ============ Cargar carrito al iniciar ========== */
cargarCarrito();
refreshSlip();

/* ========== SIDEBAR MÓVIL UNIVERSAL ========== */
const sidebarOverlay = document.getElementById('sidebar-overlay');
const bsToggle = document.querySelector('.bs-toggle');

// Abrir sidebar
function openSidebar() {
  if (sidebar) sidebar.classList.add('open');
  if (sidebarOverlay) {
    sidebarOverlay.style.display = 'block';
    sidebarOverlay.classList.add('active');
  }
  document.body.style.overflow = "hidden";
}

// Cerrar sidebar
function closeSidebar() {
  if (sidebar) sidebar.classList.remove('open');
  if (sidebarOverlay) {
    sidebarOverlay.style.display = 'none';
    sidebarOverlay.classList.remove('active');
  }
  document.body.style.overflow = "";
}

// Abrir al pulsar el botón flotante
if (mobileBtn) mobileBtn.addEventListener('click', openSidebar);

// Cerrar al pulsar el overlay
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

// Cerrar al pulsar el botón "▼" del sidebar
if (bsToggle) bsToggle.addEventListener('click', closeSidebar);

// Cerrar al pulsar fuera del sidebar (en móvil)
document.addEventListener('click', function(e) {
  if (
    window.innerWidth <= 768 &&
    sidebar &&
    sidebar.classList.contains('open') &&
    !sidebar.contains(e.target) &&
    mobileBtn &&
    !mobileBtn.contains(e.target) &&
    (!sidebarOverlay || !sidebarOverlay.contains(e.target))
  ) {
    closeSidebar();
  }
});

// Por defecto, overlay oculto
if (sidebarOverlay) sidebarOverlay.style.display = 'none';

/* ============ GUARDAR APUESTA AL PULSAR "ACEPTAR" ========== */
const acceptBtn = document.querySelector('.accept-btn');
if (acceptBtn) {
  acceptBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      alert('Debes iniciar sesión para realizar una apuesta.');
      return;
    }
    if (bets.length === 0) {
      alert('No hay apuestas en el carrito.');
      return;
    }
    const stake = parseFloat(stakeInput.value) || 0;
    if (stake <= 0) {
      alert('El importe debe ser mayor que cero.');
      return;
    }
    const betsSinPartidoId = bets.filter(b => !b.partidoId);
    if (betsSinPartidoId.length > 0) {
      alert('Error interno: Hay una apuesta sin partidoId. Por favor, contacta soporte o vuelve a añadir el partido.');
      console.error("Apuestas sin partidoId:", betsSinPartidoId);
      return;
    }
    const userRef = db.collection('usuarios').doc(user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const saldoActual = parseFloat(userData?.saldo) || 0;
    if (stake > saldoActual) {
      alert('No tienes saldo suficiente para realizar esta apuesta.');
      return;
    }
    const totalOdds = bets.reduce((acc, b) => acc * parseFloat(b.cuota), 1);
    const potentialWin = stake * totalOdds;
    const apuestaData = {
      usuarioId: user.uid,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      stake: stake,
      totalOdds: totalOdds,
      potentialWin: potentialWin,
      bets: bets.map(b => ({
        partido: b.partido,
        tipo: b.mercado === 'tarjetas' ? limpiaParentesisTarjetas(b.tipo) : b.tipo,
        cuota: parseFloat(b.cuota),
        partidoId: b.partidoId,
        mercado: b.mercado
      })),
      estado: "pendiente",
      resultado: null,
      aceptadaPorUsuario: false
    };
    try {
      await db.collection('apuestas').add(apuestaData);
      await userRef.update({
        saldo: firebase.firestore.FieldValue.increment(-stake)
      });
      alert('¡Apuesta realizada con éxito!');
      bets = [];
      guardarCarrito();
      refreshSlip();
      stakeInput.value = 5;
      updatePotentialWinnings();
      closeSidebar();
      if (typeof headerLeft !== "undefined" && headerLeft) {
        headerLeft.innerHTML = `${(saldoActual - stake).toFixed(2)} €`;
      }
    } catch (error) {
      console.error('Error al guardar la apuesta:', error);
      alert('Ocurrió un error al guardar la apuesta. Intenta de nuevo.');
    }
  });
}


/* ========== FUNCIÓN OPCIONAL PARA CARGAR PARTIDOS Y MOSTRARLOS EN LA PRINCIPAL ========== */
function removeTildes(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Global para acceder al ID
let listaPartidos = [];

// Solo ejecuta si existe el contenedor de partidos (página principal)
if (document.getElementById('partidos-container')) {
  async function cargarPartidos() {
    try {
      const snapshot = await db.collection('partidos').get();
      listaPartidos = snapshot.docs.map(doc => ({
        ...doc.data(),
        partidoId: doc.id
      }));
      mostrarPartidos(listaPartidos);
    } catch (error) {
      console.error("Error al cargar partidos:", error);
    }
  }
  cargarPartidos();

  function mostrarPartidos(partidos) {
    const container = document.getElementById('partidos-container');
    container.innerHTML = '';
    if (!Array.isArray(partidos)) return;
    // Agrupa partidos por fecha
    const partidosPorFecha = {};
    partidos.forEach((partido) => {
      if (!partido.fecha) return;
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
        const deporte = (partido.deporte || "").toLowerCase();
        const escudo1 = `Equipos/${removeTildes(equipo1.toLowerCase().replace(/\s/g, ''))}.png`;
        const escudo2 = `Equipos/${removeTildes(equipo2.toLowerCase().replace(/\s/g, ''))}.png`;
        const nacionalidad1 = partido.nacionalidad1 || "";
        const nacionalidad2 = partido.nacionalidad2 || "";
        const bandera1 = nacionalidad1
          ? `<img src="banderas/${removeTildes(nacionalidad1.toLowerCase().replace(/\s/g, ''))}.png" alt="${nacionalidad1}" class="bandera"/>`
          : '';
        const bandera2 = nacionalidad2
          ? `<img src="banderas/${removeTildes(nacionalidad2.toLowerCase().replace(/\s/g, ''))}.png" alt="${nacionalidad2}" class="bandera"/>`
          : '';
        const horaPartido = partido.hora || '00:00';
        let cuota1 = '-', cuotaX = '-', cuota2 = '-';
        if (partido.mercados && partido.mercados.resultado && Array.isArray(partido.mercados.resultado.opciones)) {
          partido.mercados.resultado.opciones.forEach(opcion => {
            if (opcion.valor === "1") cuota1 = opcion.cuota.toFixed(2);
            else if (opcion.valor === "X") cuotaX = opcion.cuota.toFixed(2);
            else if (opcion.valor === "2") cuota2 = opcion.cuota.toFixed(2);
          });
        }
        const partidoDiv = document.createElement('div');
        partidoDiv.classList.add('partido');
        let cuotasHTML = '';
        let claseCuotas = '';
        if (deporte === 'futbol') {
          claseCuotas = 'cuotas-futbol';
          cuotasHTML = `
            <div class="cuota">
              <div class="nombre-equipo-cuota">${equipo1}</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="${equipo1}">
                ${cuota1}
              </div>
            </div>
            <div class="cuota">
              <div class="nombre-equipo-cuota">Empate</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="Empate">
                ${cuotaX}
              </div>
            </div>
            <div class="cuota">
              <div class="nombre-equipo-cuota">${equipo2}</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="${equipo2}">
                ${cuota2}
              </div>
            </div>
          `;
        } else if (deporte === 'baloncesto' || deporte === 'tenis') {
          claseCuotas = deporte === 'baloncesto' ? 'cuotas-baloncesto' : 'cuotas-tenis';
          cuotasHTML = `
            <div class="cuota">
              <div class="nombre-equipo-cuota">${equipo1}</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="${equipo1}">
                ${cuota1}
              </div>
            </div>
            <div class="cuota cuota-derecha">
              <div class="nombre-equipo-cuota">${equipo2}</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="${equipo2}">
                ${cuota2}
              </div>
            </div>
          `;
        }
        let equiposHTML = '';
        if (deporte === "tenis") {
          equiposHTML = `
            <div class="info-equipos">
              <div class="equipo equipo1">
                ${bandera1}
                <span>${equipo1}</span>
              </div>
              <div class="hora">${horaPartido}</div>
              <div class="equipo equipo2">
                ${bandera2}
                <span>${equipo2}</span>
              </div>
            </div>
          `;
        } else {
          equiposHTML = `
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
          `;
        }
        let goleadoresHTML = '';
        if (
          deporte === 'futbol' &&
          partido.mercados &&
          partido.mercados.goleadores &&
          Array.isArray(partido.mercados.goleadores.opciones) &&
          partido.mercados.goleadores.opciones.length > 0
        ) {
          const partidoId = partido.partidoId || (partido.id ?? 'p'+Math.random());
          goleadoresHTML += `<button class="btn-goleadores" data-id="${partidoId}">Ver goleadores</button>`;
          goleadoresHTML += `<div class="goleadores-lista" id="goleadores-${partidoId}" style="display:none;">`;
          partido.mercados.goleadores.opciones.forEach(gol => {
            goleadoresHTML += `
              <div class="goleador-opcion"
                  data-partido="${equipo1} vs ${equipo2}"
                  data-jugador="${gol.nombre}"
                  data-cuota="${gol.cuota}"
                  data-partidoid="${partidoId}">
                <span class="nombre-goleador">${gol.nombre}</span>
                <span class="cuota-goleador">${gol.cuota}</span>
              </div>`;
          });
          goleadoresHTML += `</div>`;
        }
        let verMasHTML = `<a class="ver-partido-btn" href="partido.html?partidoId=${partido.partidoId}">Ver mercados</a>`;
        partidoDiv.innerHTML = `
          <div class="info-hora">${equiposHTML}</div>
          <div class="cuotas ${claseCuotas}">${cuotasHTML}</div>
          ${goleadoresHTML}
          ${verMasHTML}
        `;
        grupoDiv.appendChild(partidoDiv);
      });
      container.appendChild(grupoDiv);
    }
    asignarEventosGoleadores();
  }
  function asignarEventosGoleadores() {
    document.querySelectorAll('.btn-goleadores').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = this.dataset.id;
        const lista = document.getElementById('goleadores-' + id);
        if (lista) lista.style.display = lista.style.display === 'block' ? 'none' : 'block';
      });
    });
  }
  // Scroll logo
  if (document.getElementById('logo-scroll')) {
    document.getElementById('logo-scroll').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  // Añadir apuestas desde cuotas y goleadores en la principal
  if (document.getElementById('partidos-container')) {
    document.getElementById('partidos-container').addEventListener('click', e => {
      // Añadir desde cuotas normales
      const cuotaBox = e.target.closest('.cuota');
      if (cuotaBox && cuotaBox.querySelector('.cuota-btn')) {
        const btn = cuotaBox.querySelector('.cuota-btn');
        const partidoNombre = btn.dataset.partido;
        const tipo = btn.dataset.tipo;
        const cuota = btn.textContent.trim();
        const partidoObj = listaPartidos.find(p => 
          `${p.equipo1} vs ${p.equipo2}` === partidoNombre
        );
        if (!partidoObj) {
          alert('No se encontró el partido en Firestore.');
          return;
        }
        const partidoId = partidoObj.partidoId;
        if (bets.some(b => b.partido === partidoNombre && b.tipo === tipo)) {
          alert('Ya tienes una apuesta de este tipo para este partido.');
          return;
        }
        bets.push({ partido: partidoNombre, partidoId, tipo, cuota });
        refreshSlip();
        // Si quieres que se abra automáticamente en móvil al añadir apuesta, descomenta:
        // if (window.innerWidth <= 768) openSidebar();
        return;
      }
      // Añadir desde opción de goleador
      const goleadorDiv = e.target.closest('.goleador-opcion');
      if (goleadorDiv) {
        const partido = goleadorDiv.dataset.partido;
        const tipo = goleadorDiv.dataset.jugador;
        const cuota = goleadorDiv.dataset.cuota;
        const partidoId = goleadorDiv.dataset.partidoid;
        if (bets.some(b => b.partido === partido && b.tipo === tipo)) {
          alert('Ya tienes una apuesta de este goleador para este partido.');
          return;
        }
        bets.push({ partido, partidoId, tipo, cuota });
        refreshSlip();
        // Si quieres que se abra automáticamente en móvil al añadir apuesta, descomenta:
        // if (window.innerWidth <= 768) openSidebar();
        return;
      }
    });
  }
}

/* =========== PESTAÑAS =========== */
function cambiarPestania(target) {
  document.querySelectorAll('.bs-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.target === target)
  );
  document.querySelectorAll('[data-content]').forEach(sec =>
    sec.style.display = sec.dataset.content === target ? 'block' : 'none'
  );
}

/* ========== SALDO ALL-IN ========== */
let saldoUsuario = 0;
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      const userData = userDoc.data();
      saldoUsuario = parseFloat(userData?.saldo) || 0;
    } catch (error) {}
  } else {
    saldoUsuario = 0;
  }
});
const allInBtn = document.querySelector('.qs.all-in');
if (allInBtn && stakeInput) {
  allInBtn.addEventListener('click', function() {
    stakeInput.value = saldoUsuario > 0 ? saldoUsuario : '';
    updatePotentialWinnings();
  });
}

/* ========== HEADER (opcional, solo ejecuta si existe) ========== */
const headerLeft = document.getElementById('header-left');
const headerRight = document.getElementById('header-right');
if (headerLeft && headerRight) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        const userData = userDoc.data();
        headerLeft.innerHTML = userData ? `${parseFloat(userData.saldo).toFixed(2)} €` : '';
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
              ${userData?.rol === "admin" ? `<a href="adminhub.html" id="admin-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Panel Admin</a>` : ''}
              <a href="apuestas.html" id="apuestas-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Mis apuestas</a>
              <a href="#" id="logout-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Cerrar sesión</a>
            </div>
          </div>
        `;

        const username = document.querySelector('.username');
        const dropdownMenu = document.getElementById('dropdown-menu');
        let menuOpen = false;

        function openMenu() {
          dropdownMenu.style.display = 'block';
          requestAnimationFrame(() => {
            dropdownMenu.style.opacity = '1';
          });
          menuOpen = true;
        }
        function closeMenu() {
          dropdownMenu.style.opacity = '0';
          setTimeout(() => {
            dropdownMenu.style.display = 'none';
          }, 300);
          menuOpen = false;
        }
        username.addEventListener('mouseenter', () => {
          if (!menuOpen) openMenu();
        });
        document.addEventListener('click', (event) => {
          const isClickInsideMenu = dropdownMenu.contains(event.target);
          const isClickOnUsername = username.contains(event.target);
          if (!isClickInsideMenu && !isClickOnUsername && menuOpen) {
            closeMenu();
          }
        });
        document.getElementById('logout-link').addEventListener('click', async (e) => {
          e.preventDefault();
          await auth.signOut();
          localStorage.removeItem('carritoApuestas');
          window.location.href = 'login.html';
        });

      } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
      }
    } else {
      headerLeft.innerHTML = `<a href="register.html" class="header-btn">Registrarse</a>`;
      headerRight.innerHTML = `<a href="login.html" class="header-btn">Iniciar sesión</a>`;
    }
  });
}
