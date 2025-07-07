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

// INICIALIZA LA APP AQUÍ
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
      filtered = apuestas.filter(a => a.estado !== 'pendiente' && (a.aceptadaPorUsuario === true)); // aceptadas por usuario
      break;
    case 'porAceptar':
      filtered = apuestas.filter(a => a.estado === 'finalizada' && !a.aceptadaPorUsuario);
      break;
    case 'aceptadas':
      filtered = apuestas.filter(a => a.estado === 'aceptada');
      break;
    case 'todas':
      filtered = apuestas;
      break;
  }
  renderApuestas(filtered);
}

function renderApuestas(lista) {
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
                <span class="pbi-ganancias-potenciales">Ganancias potenciales: ${apuesta.potentialWin.toFixed(2)}€</span>
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
        footer = `
          <div class="pbi-footer">
            <span class="pbi-stake-footer">Importe: ${apuesta.stake}€</span>
            <span class="pbi-potential">Ganancias: ${apuesta.potentialWin.toFixed(2)}€</span>
            ${apuesta.resultado && apuesta.estado !== "pendiente" ? `<span class="pbi-resultado">${apuesta.resultado}</span>` : ""}
          </div>
        `;
      } else {
        // Solo muestra el resultado si no es pendiente/todas y hay resultado
        if (apuesta.resultado && apuesta.estado !== "pendiente") {
          footer = `<div class="pbi-footer"><span class="pbi-resultado">${apuesta.resultado}</span></div>`;
        }
      }

      return `
      <li class="pending-bet-item">
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
  } catch (e) {
    alert("Error al aceptar la apuesta. Intenta de nuevo.");
    console.error(e);
  }
};

function getEstadoText(estado) {
  switch (estado) {
    case 'pendiente': return "Pendiente";
    case 'finalizada': return "Finalizada (por aceptar)";
    case 'aceptada': return "Aceptada";
    default: return estado;
  }
}
