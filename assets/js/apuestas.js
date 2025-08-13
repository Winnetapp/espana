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

// ----------- UTILIDAD MEJORADA PARA FORMATEAR APUESTAS DE TARJETAS Y GOLEADORES -----------
function formateaTarjetaApuesta(tipo, partido) {
  // 1. Elimina 'Marca' al principio y TODO entre paréntesis, con espacios alrededor (todas las ocurrencias)
  // LIMPIEZA COMPLETA DE TIPO
  tipo = tipo
    .replace(/^Marca\s*/i, "")               // Quita "Marca" al inicio
    .replace(/\(.*?-\s*\d+\)/g, "")          // Quita patrones como (Más de - 4), (Menos de - 3), etc.
    .replace(/\(.*?\)/g, "")                 // Quita cualquier otro texto entre paréntesis
    .replace(/\s{2,}/g, " ")                 // Reemplaza múltiples espacios
    .trim();


  // 2. Divide en partes tras limpiar
  const partes = tipo.split(' - ').map(s => s.trim()).filter(Boolean);

  // 3. Extrae condición y cantidad
  let condicion = "", cantidad = "";
  let mainPart = partes[0] || "";
  let match = mainPart.match(/(Más de|Menos de|Exactamente)\s*(\d+)/i);
  if (match) {
    condicion = match[1];
    cantidad = match[2];
  } else {
    condicion = mainPart.replace(/tarjetas?/gi, '').trim();
    cantidad = "";
  }
  let main = condicion && cantidad ? `${condicion} ${cantidad} tarjetas` : condicion ? `${condicion} tarjetas` : "";

  // 4. Equipo y periodo: SIEMPRE los dos últimos elementos si existen
  let equipo = partes.length >= 2 ? partes[partes.length - 1] : "";
  let periodo = partes.length >= 3 ? partes[partes.length - 2] : "";

  // 5. Traduce periodo y equipo
  let periodoFinal = (periodo || "")
    .replace(/1ª Mitad/i, "1ª Mitad")
    .replace(/2ª Mitad/i, "2ª Mitad")
    .replace(/primera/i, "1ª Mitad")
    .replace(/segunda/i, "2ª Mitad")
    .replace(/encuentro/i, "Encuentro");

  let equipoFinal = (equipo || "")
    .replace(/ambos equipos?/i, "Ambos equipos")
    .replace(/equipo1/i, () => {
      if (!partido) return "Equipo 1";
      const p = partido.split(' vs ');
      return (p[0] || "Equipo 1").trim();
    })
    .replace(/equipo2/i, () => {
      if (!partido) return "Equipo 2";
      const p = partido.split(' vs ');
      return (p[1] || "Equipo 2").trim();
    });

  // 6. Monta el texto final limpio
  return `Tarjetas: ${main} - ${periodoFinal} - ${equipoFinal}`.replace(/\s{2,}/g, ' ').replace(/ - +$/, '').trim();
}

function formateaTipoApuesta(b, partido) {
  const [equipo1, equipo2] = (partido || '').split(' vs ');
  if (b.tipoApuesta === "tarjetas" || (b.mercado && b.mercado.toLowerCase() === "tarjetas")) {
    return formateaTarjetaApuesta(b.tipo, partido);
  } else if (b.tipoApuesta === "goleador" || b.esGoleador) {
    return `Marca ${b.tipo}`;
  } else if (b.tipo === equipo1) {
    return `Gana ${equipo1}`;
  } else if (b.tipo === equipo2) {
    return `Gana ${equipo2}`;
  } else {
    return b.tipo;
  }
}


// -------------------------------------------------------------------------

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
      filtered = [...apuestas];
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

      let mostrarFooter = (currentTab === 'pendientes' || currentTab === 'todas');
      let footer = '';
      if (mostrarFooter) {
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
        if (
          apuesta.resultado && apuesta.estado !== "pendiente" &&
          !((currentTab === 'todas' || currentTab === 'listas' || currentTab === 'terminadas') &&
            (apuesta.estado === "ganada" || apuesta.estado === "perdida"))
        ) {
          footer = `<div class="pbi-footer"><span class="pbi-resultado">${apuesta.resultado}</span></div>`;
        }
      }

      let fechaApuesta = '';
      if ((currentTab === "todas" || currentTab === "listas" || currentTab === "terminadas") && apuesta.fecha) {
        fechaApuesta = `<div class="pbi-fecha-apuesta">${formateaFechaApuesta(apuesta.fecha)}</div>`;
      }

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
                let tipoMostrado = formateaTipoApuesta(b, b.partido)
                  .replace(/\(.*?-\s*\d+\)/g, "")  // Quita cosas como (Más de - 4)
                  .replace(/\(.*?\)/g, "")         // Quita cualquier paréntesis restante
                  .replace(/\s{2,}/g, " ")         // Quita espacios dobles
                  .trim();
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
