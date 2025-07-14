/* =========================================================
   1.  CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
   ========================================================= */
// Evita doble declaración de firebaseConfig
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

// INICIALIZA LA APP SOLO UNA VEZ
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

const container = document.getElementById('apuestas-container');
const tabButtons = document.querySelectorAll('.tab-btn');

let apuestas = [];
let currentUser = null;
let currentTab = 'pendientes';

// Cambia la pestaña activa visualmente y muestra apuestas
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.getAttribute('data-tab');
    render();
  });
});

// Espera a que el usuario esté autenticado y carga solo sus apuestas
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    container.innerHTML = "<p>Debes iniciar sesión para ver tus apuestas.</p>";
    return;
  }
  currentUser = user;
  await loadApuestas();
});

async function loadApuestas() {
  apuestas = [];
  container.innerHTML = "<p>Cargando apuestas...</p>";
  try {
    const snap = await db.collection('apuestas')
      .where('usuarioId', '==', currentUser.uid)
      .get();
    apuestas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Ordena por fecha descendente en el frontend
    apuestas.sort((a, b) => {
      if (!a.fecha || !b.fecha) return 0;
      return b.fecha.seconds - a.fecha.seconds;
    });

    // 1. Buscar todas las partidoId únicos de las bets
    const partidoIds = new Set();
    apuestas.forEach(a => {
      a.bets.forEach(b => {
        if (b.partidoId) partidoIds.add(b.partidoId);
      });
    });

    // 2. Descargar todos los partidos necesarios de una vez
    const partidoDocs = {};
    if (partidoIds.size > 0) {
      const promises = Array.from(partidoIds).map(async partidoId => {
        const doc = await db.collection('partidos').doc(partidoId).get();
        if (doc.exists) partidoDocs[partidoId] = doc.data();
      });
      await Promise.all(promises);
    }

    // 3. Poner la fecha formateada en cada bet
    apuestas.forEach(a => {
      a.bets.forEach(b => {
        if (b.partidoId && partidoDocs[b.partidoId]) {
          const partido = partidoDocs[b.partidoId];
          b.fechaPartidoFormateada = formateaFechaHora(partido.fecha, partido.hora);
        } else {
          b.fechaPartidoFormateada = '';
        }
      });
    });

    render();
  } catch (e) {
    console.error("Error al cargar apuestas:", e);
    container.innerHTML = "<p>Error cargando apuestas.</p>";
  }
}

// Formatea "2025-07-05" + "20:20" => "Sáb 20:20"
function formateaFechaHora(fechaStr, horaStr) {
  if (!fechaStr || !horaStr) return '';
  try {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const [a, m, d] = fechaStr.split('-').map(Number);
    const date = new Date(a, m - 1, d);
    const dia = dias[date.getDay()];
    return `${dia} ${horaStr}`;
  } catch {
    return '';
  }
}

// NUEVA: Formatea el timestamp de Firestore a "dd/mm/yyyy HH:MM"
function formateaFechaApuesta(fecha) {
  if (!fecha || !fecha.toDate) return '';
  const d = fecha.toDate();
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  const diaSemana = dias[d.getDay()];
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = meses[d.getMonth()];
  const año = d.getFullYear();
  const horas = String(d.getHours()).padStart(2, '0');
  const minutos = String(d.getMinutes()).padStart(2, '0');
  return `${diaSemana} ${dia} de ${mes} del ${año} a las ${horas}:${minutos}`;
}

function render() {
  let filtered = [];
  switch(currentTab) {
    case 'pendientes':
      filtered = apuestas.filter(a => a.estado === 'pendiente');
      break;
    case 'listas':
      filtered = apuestas.filter(a => a.estado !== 'pendiente' && (a.aceptadaPorUsuario === false));
      break;
    case 'terminadas':
      filtered = apuestas.filter(a => a.estado !== 'pendiente' && (a.aceptadaPorUsuario === true));
      break;
    case 'porAceptar':
      filtered = apuestas.filter(a => a.estado === 'finalizada' && !a.aceptadaPorUsuario);
      break;
    case 'aceptadas':
      filtered = apuestas.filter(a => a.estado === 'aceptada');
      break;
    case 'todas':
      filtered = [...apuestas]; // copia para no modificar el original
      // Ordenar por fecha descendente (más reciente primero)
      filtered.sort((a, b) => {
        if (!a.fecha || !b.fecha) return 0;
        return b.fecha.seconds - a.fecha.seconds;
      });
      break;
  }
  renderApuestas(filtered, currentTab);
}

function renderApuestas(lista, currentTab) {
  if (lista.length === 0) {
    container.innerHTML = "<p>No hay apuestas en este apartado.</p>";
    return;
  }

  container.innerHTML = `
      <ul class="pending-bet-list">
      ${lista.map(apuesta => {
      const tipoApuesta = apuesta.bets.length > 1 ? "Combinada" : "Simple";
      // Estado y resultado
      let estadoTexto = "";
      if (apuesta.estado === 'pendiente') {
        estadoTexto = '<span class="pbi-status pendiente">Pendiente</span>';
      } else if (apuesta.estado === 'ganada') {
        estadoTexto = '<span class="pbi-status ganada">Ganada</span>';
      } else if (apuesta.estado === 'perdida') {
        estadoTexto = '<span class="pbi-status perdida">Perdida</span>';
      } else {
        estadoTexto = `<span class="pbi-status ${apuesta.estado}">${apuesta.estado.charAt(0).toUpperCase() + apuesta.estado.slice(1)}</span>`;
      }

      // Botones para el apartado "Listas"
      let acciones = "";
      if (currentTab === "listas") {
        if (apuesta.estado === "ganada") {
          acciones = `
            <div class="pbi-boton-container">
              <button class="btn-cobrar" onclick="aceptarApuesta('${apuesta.id}', true)">
                Cobrar ganancia
                <span class="pbi-ganancias-potenciales">${apuesta.potentialWin.toFixed(2)}€</span>
              </button>
            </div>
          `;
        } else if (apuesta.estado === "perdida") {
          acciones = `
            <div class="pbi-boton-container">
              <button class="btn-perder" onclick="aceptarApuesta('${apuesta.id}', false)">Confirmar pérdida</button>
            </div>
          `;
        }
      }

      // Mostrar .pbi-footer solo en tabs PENDIENTES y TODAS
      let mostrarFooter = (currentTab === 'pendientes' || currentTab === 'todas');
      let footer = '';
      if (mostrarFooter) {
        // Oculta apuesta.resultado en el footer si ya hay resultado decorado
        const mostrarResultadoPlano = !(
          (currentTab === 'todas' || currentTab === 'listas' || currentTab === 'terminadas') &&
          apuesta.estado !== "pendiente" &&
          (apuesta.estado === "ganada" || apuesta.estado === "perdida")
        );
        footer = `
          <div class="pbi-footer">
            <span class="pbi-stake-footer">Importe: ${apuesta.stake}€</span>
            <span class="pbi-potential">Ganancias: ${apuesta.potentialWin.toFixed(2)}€</span>
            ${mostrarResultadoPlano && apuesta.resultado && apuesta.estado !== "pendiente" ? `<span class="pbi-resultado">${apuesta.resultado}</span>` : ""}
          </div>
        `;
      } else {
        // Solo muestra el resultado si no es pendiente/todas y hay resultado, y tampoco doble
        if (
          apuesta.resultado && apuesta.estado !== "pendiente" &&
          !((currentTab === 'todas' || currentTab === 'listas' || currentTab === 'terminadas') &&
            (apuesta.estado === "ganada" || apuesta.estado === "perdida"))
        ) {
          footer = `<div class="pbi-footer"><span class="pbi-resultado">${apuesta.resultado}</span></div>`;
        }
      }

      // Mostrar fecha de realización encima de la apuesta en las pestañas 'listas', 'terminadas' y 'todas'
      let fechaApuesta = '';
      if ((currentTab === "todas" || currentTab === "listas" || currentTab === "terminadas") && apuesta.fecha) {
        fechaApuesta = `<div class="pbi-fecha-apuesta">${formateaFechaApuesta(apuesta.fecha)}</div>`;
      }

      // Mostrar resultado decorado en 'listas', 'terminadas' y 'todas', al final de la apuesta
      let resultadoApuesta = '';
      if (
        (currentTab === 'todas' || currentTab === 'listas' || currentTab === 'terminadas') &&
        apuesta.estado !== 'pendiente' &&
        (apuesta.estado === 'ganada' || apuesta.estado === 'perdida')
      ) {
        const esGanada = apuesta.estado === 'ganada';
        resultadoApuesta = `
          <div class="pbi-resultado-apuesta ${esGanada ? 'ganada' : 'perdida'}">
            <span class="icon">${esGanada ? '🏆' : '❌'}</span>
            Tu apuesta ha resultado ${esGanada ? 'ganadora' : 'no ganadora'}
          </div>
        `;
      }

      return `
      <li class="pending-bet-item">
          ${fechaApuesta}
          <div class="pbi-header">
            <span class="pbi-type-label">
                ${tipoApuesta}
                <span class="pbi-total-odds">${apuesta.totalOdds.toFixed(2)}</span>
            </span>
            ${estadoTexto}
          </div>
          <div class="pbi-body">
            <ul class="pbi-bets-list">
              ${apuesta.bets.map((b, idx) => {
                const [equipo1, equipo2] = b.partido.split(' vs ');
                let tipoMostrado = "";
                if (b.tipo === equipo1) {
                  tipoMostrado = `Gana ${equipo1}`;
                } else if (b.tipo === equipo2) {
                  tipoMostrado = `Gana ${equipo2}`;
                } else {
                  tipoMostrado = b.tipo;
                }
                let dotClass = "";
                if (b.resultado === "ganada") dotClass = "ganada";
                else if (b.resultado === "perdida") dotClass = "perdida";
                let dot = `<span class="pbi-dot ${dotClass}"></span>`;
                return `
                  <li class="pbi-bet">
                    ${dot}
                    <div style="flex:1">
                      <div class="pbi-type-main">
                        <span>${tipoMostrado}</span>
                        <span class="pbi-odds">${b.cuota}</span>
                      </div>
                      <div class="pbi-container">
                        <div class="pbi-partido">${b.partido}</div>
                        <div class="pbi-fecha">${b.fechaPartidoFormateada || ""}</div>
                      </div>
                    </div>
                  </li>
                `;
              }).join('')}
            </ul>
          </div>
          ${footer}
          ${acciones}
          ${resultadoApuesta}
      </li>
      `}).join('')}
      </ul>
  `;
}

window.aceptarApuesta = async function(id, ganada) {
  try {
    const apuestaRef = db.collection('apuestas').doc(id);
    const apuestaDoc = await apuestaRef.get();
    const apuesta = apuestaDoc.data();

    // Actualizar apuesta: marcar aceptada por usuario
    await apuestaRef.update({
      aceptadaPorUsuario: true
    });

    // Si ha ganado, sumar ganancias al saldo
    if (ganada && apuesta && apuesta.potentialWin) {
      const userRef = db.collection('usuarios').doc(currentUser.uid);
      // Actualizar el saldo sumando potentialWin
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw "Usuario no existe";
        const saldoActual = userDoc.data().saldo || 0;
        const nuevoSaldo = saldoActual + apuesta.potentialWin;
        transaction.update(userRef, { saldo: nuevoSaldo });
      });
    }

    await loadApuestas();

    // NUEVO: recargar el saldo en el header tras confirmar ganancia/pérdida
    await actualizarHeaderSaldo();

  } catch (e) {
    alert("Error al aceptar la apuesta. Intenta de nuevo.");
    console.error(e);
  }
};

// NUEVO: función para refrescar el saldo del header sin recargar la página
async function actualizarHeaderSaldo() {
  const headerLeft = document.getElementById('header-left');
  if (!currentUser) return;
  try {
    const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
    const userData = userDoc.data();
    const saldoUsuario = parseFloat(userData?.saldo) || 0;
    headerLeft.innerHTML = `${saldoUsuario.toFixed(2)} €`;
  } catch (e) {
    headerLeft.innerHTML = "";
  }
}

function getEstadoText(estado) {
  switch (estado) {
    case 'pendiente': return "Pendiente";
    case 'finalizada': return "Finalizada (por aceptar)";
    case 'aceptada': return "Aceptada";
    default: return estado;
  }
}

// HEADER //
// Mostrar datos de usuario y controlar login/logout
const headerLeft = document.getElementById('header-left');
const headerRight = document.getElementById('header-right');

let saldoUsuario = 0;

auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      const userData = userDoc.data();
      saldoUsuario = parseFloat(userData?.saldo) || 0;
      headerLeft.innerHTML = userData ? `${saldoUsuario.toFixed(2)} €` : '';

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
            ${userData?.rol === "admin" ? `<a href="adminhub.html" id="admin-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Panel Admin</a>` : ''}
            <a href="apuestas.html" id="apuestas-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Mis apuestas</a>
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
        await auth.signOut();
        window.location.href = 'login.html';
      });

    } catch (error) {
      saldoUsuario = 0;
      headerLeft.innerHTML = "";
    }
  } else {
    saldoUsuario = 0;
    headerLeft.innerHTML = `<a href="register.html" class="header-btn">Registrarse</a>`;
    headerRight.innerHTML = `<a href="login.html" class="header-btn">Iniciar sesión</a>`;
  }
});
