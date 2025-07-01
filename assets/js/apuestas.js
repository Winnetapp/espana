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

  if (currentTab === 'pendientes') {
    container.innerHTML = `
        <ul class="pending-bet-list">
        ${lista.map(apuesta => {
        const tipoApuesta = apuesta.bets.length > 1 ? "Combinada" : "Simple";
        return `
        <li class="pending-bet-item">
            <div class="pbi-header">
            <span class="pbi-type-label">
                ${tipoApuesta}
                <span class="pbi-total-odds">${apuesta.totalOdds.toFixed(2)}</span>
            </span>
            <span class="pbi-status">Pendiente</span>
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
                return `
                    <li class="pbi-bet">
                    <span class="pbi-dot"></span>
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
            <div class="pbi-footer">
            <span class="pbi-stake-footer">Importe: ${apuesta.stake}€</span>
            <span class="pbi-potential">Ganancias: ${apuesta.potentialWin.toFixed(2)}€</span>
            </div>
        </li>
        `}).join('')}
        </ul>
    `;
    return;
    }

  // resto de pestañas (igual que antes, pero con fecha formateada)
  container.innerHTML = lista.map(apuesta => `
    <div class="apuesta">
      <p><strong>Fecha:</strong> ${apuesta.fecha?.toDate?.().toLocaleString?.() || '-'}</p>
      <p><strong>Stake:</strong> ${apuesta.stake} €</p>
      <p><strong>Cuota total:</strong> ${apuesta.totalOdds.toFixed(2)}</p>
      <p><strong>Ganancia potencial:</strong> ${apuesta.potentialWin.toFixed(2)} €</p>
      <p><strong>Estado:</strong> ${getEstadoText(apuesta.estado)}</p>
      <p><strong>Resultado:</strong> ${apuesta.resultado ? apuesta.resultado : '-'}</p>
      <ul>
        ${apuesta.bets.map(b => `
          <li>
            ${b.partido} - ${b.tipo} - cuota: ${b.cuota}
            <div class="pbi-fecha">${b.fechaPartidoFormateada || ""}</div>
          </li>
        `).join('')}
      </ul>
      ${(apuesta.estado === 'finalizada' && !apuesta.aceptadaPorUsuario) ? `
        <button onclick="aceptarApuesta('${apuesta.id}', '${apuesta.resultado}')">
          ${apuesta.resultado === 'ganada' ? 'Aceptar y recibir dinero' : 'Aceptar'}
        </button>
      ` : ''}
    </div>
  `).join('');
}

window.aceptarApuesta = async function(id, resultado) {
  try {
    // Aquí puedes agregar lógica para actualizar saldo si la apuesta es ganada
    await db.collection('apuestas').doc(id).update({
      estado: 'aceptada',
      aceptadaPorUsuario: true
    });
    await loadApuestas();
  } catch (e) {
    alert("Error al aceptar la apuesta. Intenta de nuevo.");
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
