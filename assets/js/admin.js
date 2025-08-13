import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* 1️⃣  Firebase ------------------------------------------------------------------ */
const firebaseConfig = {
  apiKey: "AIzaSyDgdI3UcnHuRlcynH-pCHcGORcGBAD3FSU",
  authDomain: "winnet-708db.firebaseapp.com",
  projectId: "winnet-708db",
  storageBucket: "winnet-708db.appspot.com",
  messagingSenderId: "869401097323",
  appId: "1:869401097323:web:fddb5e44af9d27a7cfed2e",
  measurementId: "G-12LH5QRVD0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* 2️⃣  Referencias DOM ----------------------------------------------------------- */
const $ = id => document.getElementById(id);
const campos = ["deporte","liga","equipo1","equipo2","fecha","hora",
                "cuota1","cuotaX","cuota2"]
  .reduce((o,k)=>{o[k]=$(k);return o;}, {});
const msg = $("msg");
const spinner = $("spinner");
const modal = $("modalConfirm");
const modalText = $("modalText");
const btnConfirm = $("btnConfirm");
const btnCancel = $("btnCancel");
const previewContainer = $("previewContainer"); // Para futuras previsualizaciones

// Selectores de nacionalidad y sus wrappers (en HTML)
const wrapperNac1 = document.querySelector(".nacionalidad-1");
const wrapperNac2 = document.querySelector(".nacionalidad-2");

// Goleadores section
const goleadoresSection = document.getElementById("goleadores-section");

/* 3️⃣  Datos --------------------------------------------------------------------- */
const ligasPorDeporte = {
  futbol: ["La Liga","Premier League","Serie A","Bundesliga","Ligue 1","Champions League","Mundial de Clubes"],
  baloncesto: ["NBA","Euroliga"],
  tenis: ["ATP Madrid","Roland Garros"]
};

const equiposPorLiga = {
  "La Liga": [
    "Real Madrid","Barcelona","Atletico Madrid","Sevilla","Valencia",
    "Real Sociedad","Villarreal","Real Betis","Athletic Bilbao","Celta de Vigo",
    "Getafe","Espanyol","Osasuna","Alavés", "Rayo Vallecano",
    "Elche","Mallorca","Levante", "Girona", "Real Oviedo"
  ],
  "La Liga Hypermotion": [
    "Albacete","Almería","Andorra","Burgos","Cádiz",
    "Castellón","Leganés","Ceuta","Córdoba","Cultural Leonesa",
    "Deportivo","Eibar","Granada","Huesca","Málaga",
    "Mirandés","Racing Santander","Real Sociedad B","Zaragoza",
    "Sporting","Las Palmas","Valladolid"
  ],
  "Premier League": [
    "Manchester City","Liverpool","Manchester United","Arsenal","Chelsea",
    "Tottenham","Newcastle","Everton","Aston Villa","West Ham",
    "Brighton","Crystal Palace", "Wolves", "Leeds United", "Burnley",
    "Brentford","Fulham","Bournemouth","Nottingham Forest", "Sunderland"
  ],
  "Serie A": [
    "Juventus","Milan","Inter","Napoli","Roma",
    "Lazio","Atalanta","Fiorentina","Torino","Bolonia",
    "Como", "Udinense","Parma","Leece","Genoa",
    "Cagliari","Verona", "Sassuolo","Pisa","Cremonese"
  ],
  "Bundesliga": [
    "Bayern Munich","Borussia Dortmund","RB Leipzig","Bayer Leverkusen",
    "Eintracht Frankfurt","Wolfsburg","Mönchengladbach","Freiburg","Union Berlin",
    "Werder Bremen", "Stuttgart","Hoffenheim","Mainz",
    "Augsburgo","San Pauli","Heidenheim","köln"
  ],
  "Ligue 1": [
    "Paris Saint-Germain","Olympique Lyon","Marseille","Monaco","Lille",
    "Rennes","Nice","Lens","Nantes","Bordeaux"
  ],
  "Champions League": [
    "Real Madrid","Manchester City","Bayern Munich","Liverpool","Paris Saint-Germain",
    "Barcelona","Juventus","Chelsea","Arsenal","Inter Milan"
  ],
  NBA: [
    "Los Angeles Lakers","Golden State Warriors","Boston Celtics","Chicago Bulls",
    "Miami Heat","Milwaukee Bucks","Brooklyn Nets","Dallas Mavericks","Denver Nuggets"
  ],
  Euroliga: [
    "Real Madrid Baloncesto","FC Barcelona Basket","Anadolu Efes","Olympiacos",
    "Fenerbahçe","Maccabi Tel-Aviv","Panathinaikos","CSKA Moscú","Baskonia","Virtus Bologna"
  ],
  "ATP Madrid": [
    "Carlos Alcaraz","Rafael Nadal","Novak Djokovic","Daniil Medvedev","Stefanos Tsitsipas",
    "Jannik Sinner","Andrey Rublev","Alexander Zverev","Casper Ruud","Felix Auger-Aliassime"
  ],
  "Roland Garros": [
    "Novak Djokovic","Rafael Nadal","Carlos Alcaraz","Stefanos Tsitsipas","Casper Ruud",
    "Alexander Zverev","Jannik Sinner","Daniil Medvedev","Dominic Thiem","Andrey Rublev"
  ]
};

// Jugadores por equipo (ejemplo, amplía según necesites)
const jugadoresPorEquipo = {
  "Real Madrid": ["Vinícius Jr.", "Rodrygo", "Jude Bellingham", "Joselu", "Brahim Díaz"],
  "Barcelona": ["Robert Lewandowski", "Lamine Yamal", "Ferran Torres", "Pedri"],
  "Borussia Dortmund": ["Niclas Füllkrug", "Marco Reus", "Julian Brandt", "Karim Adeyemi"],
  "Bayern Munich": ["Harry Kane", "Thomas Müller", "Serge Gnabry", "Leroy Sané"],
  // ... añade todos los equipos y jugadores que quieras
};

/* 4️⃣  Autocompletado ------------------------------------------------------------ */
const ligaDatalist    = $("ligas-list");
const equiposDatalist = $("equipos-list");
const cuotaXInput     = campos.cuotaX;

/* --- Datalist para goleadores dinámico según equipos --- */
const datalistGoleadores = document.getElementById("goleadores-datalist");
function actualizarDatalistGoleadores() {
  const equipo1 = campos.equipo1.value.trim();
  const equipo2 = campos.equipo2.value.trim();
  let jugadores = [];
  if (jugadoresPorEquipo[equipo1]) jugadores = jugadores.concat(jugadoresPorEquipo[equipo1]);
  if (jugadoresPorEquipo[equipo2]) jugadores = jugadores.concat(jugadoresPorEquipo[equipo2]);
  jugadores = [...new Set(jugadores)];
  datalistGoleadores.innerHTML = jugadores.map(j => `<option value="${j}">`).join("");
}
campos.equipo1.addEventListener("input", actualizarDatalistGoleadores);
campos.equipo2.addEventListener("input", actualizarDatalistGoleadores);

// --- Mostrar/ocultar nacionalidades, cuotas y goleadores según deporte ---
campos.deporte.addEventListener("change", () => {
  const dep = campos.deporte.value;

  // Limpiar campos menos deporte
  Object.keys(campos).forEach(key => {
    if (key !== "deporte") campos[key].value = "";
  });

  if (ligaDatalist) {
    ligaDatalist.innerHTML = "";
    (ligasPorDeporte[dep] || []).forEach(l => {
      const opt = document.createElement("option");
      opt.value = l;
      ligaDatalist.appendChild(opt);
    });
  }

  if (equiposDatalist) equiposDatalist.innerHTML = "";

  // Mostrar/ocultar cuotaX
  if (dep === "tenis" || dep === "baloncesto") {
    if (campos.cuotaX) {
      campos.cuotaX.style.display = "none";
      campos.cuotaX.value = "";
    }
  } else {
    if (campos.cuotaX) campos.cuotaX.style.display = "inline-block";
  }

  // Mostrar u ocultar nacionalidades según deporte
  if (dep === "tenis") {
    if (wrapperNac1) wrapperNac1.style.display = "block";
    if (wrapperNac2) wrapperNac2.style.display = "block";
  } else {
    if (wrapperNac1) wrapperNac1.style.display = "none";
    if (wrapperNac2) wrapperNac2.style.display = "none";
    const sel1 = $("nacionalidad1");
    const sel2 = $("nacionalidad2");
    if (sel1) sel1.value = "";
    if (sel2) sel2.value = "";
  }

  // Mostrar/ocultar sección de goleadores solo en fútbol
  if (goleadoresSection) {
    goleadoresSection.style.display = (dep === "futbol") ? "block" : "none";
    if (dep !== "futbol") {
      goleadores.length = 0;
      renderGoleadores();
    }
  }

  // Mostrar/ocultar sección de tarjetas solo en fútbol
  const tarjetasSection = document.getElementById('tarjetas-section');
  if (tarjetasSection) {
    tarjetasSection.style.display = (dep === "futbol" ? "block" : "none");
    // Si cambias a otro deporte, limpia los campos de tarjetas
    if (dep !== "futbol") {
      if (window.tarjetasCuotas) {
        window.tarjetasCuotas = {};
      }
      const tabs = document.getElementById("tarjetas-tabs");
      const subtabs = document.getElementById("tarjetas-subtabs");
      const tables = document.getElementById("tarjetas-tables");
      if (tabs) tabs.innerHTML = "";
      if (subtabs) subtabs.innerHTML = "";
      if (tables) tables.innerHTML = "";
    } else {
      if (typeof renderTarjetasTabs === "function") renderTarjetasTabs();
    }
  }
});

/* 4.2  Al cambiar LIGA → llenar lista de equipos/jugadores */
if (campos.liga && equiposDatalist) {
  campos.liga.addEventListener("input", () => {
    const liga = campos.liga.value.trim();
    equiposDatalist.innerHTML = "";

    (equiposPorLiga[liga] || []).forEach(eq => {
      const opt = document.createElement("option");
      opt.value = eq;
      equiposDatalist.appendChild(opt);
    });
  });
}

/* 5️⃣  Invertir Equipos (botón ⮃) ------------------------------------------------ */
const btnInvertir = $("invertirEquipos");
if (btnInvertir && campos.equipo1 && campos.equipo2 && campos.cuota1 && campos.cuota2) {
  btnInvertir.addEventListener("click", (e) => {
    e.preventDefault();
    [campos.equipo1.value, campos.equipo2.value] =
      [campos.equipo2.value, campos.equipo1.value];
    [campos.cuota1.value , campos.cuota2.value ] =
      [campos.cuota2.value , campos.cuota1.value ];
    actualizarDatalistGoleadores();
  });
}

/* --- Goleadores: manejo inputs y lista --- */
const goleadores = [];
const goleadoresList = document.getElementById("goleadores-list");
const inputGoleadorNombre = document.getElementById("goleador-nombre");
const inputGoleadorCuota = document.getElementById("goleador-cuota");
const btnAgregarGoleador = document.getElementById("agregar-goleador");

function renderGoleadores() {
  goleadoresList.innerHTML = "";
  goleadores.forEach((g, idx) => {
    const div = document.createElement("div");
    div.style.marginBottom = "4px";
    div.textContent = `${g.nombre} (Cuota: ${g.cuota})`;
    const btnDel = document.createElement("button");
    btnDel.textContent = "X";
    btnDel.style.marginLeft = "7px";
    btnDel.style.background = "#ff4d4d";
    btnDel.style.color = "white";
    btnDel.style.border = "none";
    btnDel.style.borderRadius = "4px";
    btnDel.style.cursor = "pointer";
    btnDel.onclick = () => {
      goleadores.splice(idx,1);
      renderGoleadores();
    };
    div.appendChild(btnDel);
    goleadoresList.appendChild(div);
  });
}

if (btnAgregarGoleador) {
  btnAgregarGoleador.onclick = () => {
    const nombre = inputGoleadorNombre.value.trim();
    const cuota = parseFloat(inputGoleadorCuota.value);
    if (!nombre || isNaN(cuota) || cuota <= 1) {
      msg.textContent = "Introduce un nombre de jugador y una cuota válida (>1)";
      msg.style.color = "red";
      return;
    }
    goleadores.push({ nombre, cuota, valor: nombre.toLowerCase().replace(/\s/g, '_') });
    inputGoleadorNombre.value = "";
    inputGoleadorCuota.value = "";
    renderGoleadores();
    msg.textContent = "";
  };
}

// ---------- BLOQUE TARJETAS AVANZADO (dinámico, tipo tabla) -------------
const TARJETAS_SEGMENTOS = [
  { id: 'primera', label: '1ª Mitad' },
  { id: 'segunda', label: '2ª Mitad' },
  { id: 'encuentro', label: 'Encuentro' }
];
const TARJETAS_EQUIPOS = [
  { id: 'equipo1', label: 'Equipo 1' },
  { id: 'equipo2', label: 'Equipo 2' },
  { id: 'ambos', label: 'Ambos Equipos' }
];
const TARJETAS_COLUMNAS = [
  { id: 'mas', label: 'Más de' },
  { id: 'exactamente', label: 'Exactamente' },
  { id: 'menos', label: 'Menos de' }
];
const TARJETAS_FILAS = [1,2,3,4,5,6,7,8,9,10];

window.tarjetasCuotas = {}; // { segmento: { equipo: { nTarjetas: { mas:..., exactamente:..., menos:... } } } }

function renderTarjetasTabs() {
  const $tabs = document.getElementById("tarjetas-tabs");
  const $subtabs = document.getElementById("tarjetas-subtabs");
  const $tables = document.getElementById("tarjetas-tables");
  if (!$tabs || !$subtabs || !$tables) return;

  // Estado seleccionado:
  if (!window.tarjetasTabSel) window.tarjetasTabSel = 'primera';
  if (!window.tarjetasSubtabSel) window.tarjetasSubtabSel = 'equipo1';

  // Tabs segmento
  $tabs.innerHTML = TARJETAS_SEGMENTOS.map(seg =>
    `<button type="button" class="${window.tarjetasTabSel === seg.id ? "active" : ""}" data-tab="${seg.id}">${seg.label}</button>`
  ).join('');
  // Subtabs equipo
  $subtabs.innerHTML = TARJETAS_EQUIPOS.map(eq =>
    `<button type="button" class="${window.tarjetasSubtabSel === eq.id ? "active" : ""}" data-subtab="${eq.id}">${eq.label}</button>`
  ).join('');

  // Tabla
  // Inicializa estructura si no existe
  if (!window.tarjetasCuotas[window.tarjetasTabSel]) window.tarjetasCuotas[window.tarjetasTabSel] = {};
  if (!window.tarjetasCuotas[window.tarjetasTabSel][window.tarjetasSubtabSel]) {
    window.tarjetasCuotas[window.tarjetasTabSel][window.tarjetasSubtabSel] = {};
    TARJETAS_FILAS.forEach(n => {
      window.tarjetasCuotas[window.tarjetasTabSel][window.tarjetasSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
    });
  }
  const datos = window.tarjetasCuotas[window.tarjetasTabSel][window.tarjetasSubtabSel];

  let html = `<table class="tarjetas-table"><thead><tr><th></th>`;
  TARJETAS_COLUMNAS.forEach(col => html += `<th>${col.label}</th>`);
  html += `</tr></thead><tbody>`;
  TARJETAS_FILAS.forEach(n => {
    html += `<tr><td>${n} tarjeta${n>1?'s':''}</td>`;
    TARJETAS_COLUMNAS.forEach(col => {
      const valor = datos[n][col.id] ?? '';
      html += `<td>
        <input type="number" min="1.01" step="0.01" 
          data-n="${n}" data-col="${col.id}"
          value="${valor !== undefined ? valor : ''}" 
          placeholder="-" />
      </td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;

  $tables.innerHTML = html;

  // Eventos para tabs
  $tabs.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      window.tarjetasTabSel = btn.dataset.tab;
      renderTarjetasTabs();
    };
  });
  $subtabs.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      window.tarjetasSubtabSel = btn.dataset.subtab;
      renderTarjetasTabs();
    };
  });

  // Evento para inputs
  $tables.querySelectorAll("input[type=number]").forEach(input => {
    input.addEventListener("input", () => {
      const n = input.getAttribute("data-n");
      const col = input.getAttribute("data-col");
      let v = input.value;
      if (!window.tarjetasCuotas[window.tarjetasTabSel][window.tarjetasSubtabSel][n])
        window.tarjetasCuotas[window.tarjetasTabSel][window.tarjetasSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
      window.tarjetasCuotas[window.tarjetasTabSel][window.tarjetasSubtabSel][n][col] = v;
    });
  });
}

// --- Validar datos ---
function validarDatos() {
  const dep   = campos.deporte.value.trim();
  const liga  = campos.liga.value.trim();
  const eq1   = campos.equipo1.value.trim();
  const eq2   = campos.equipo2.value.trim();
  const fecha = campos.fecha.value;
  const hora  = campos.hora.value;

  const cuota1 = parseFloat(campos.cuota1.value);
  const cuota2 = parseFloat(campos.cuota2.value);
  const cuotaX = parseFloat(campos.cuotaX.value);

  const errores = [];

  const oblig = ["deporte","liga","equipo1","equipo2","fecha","hora","cuota1","cuota2"];
  if (dep !== "tenis" && dep !== "baloncesto") oblig.push("cuotaX");

  oblig.forEach(id=>{
    if(!campos[id].value.trim()) errores.push(`El campo «${id}» es obligatorio.`);
  });

  if (eq1 && eq2 && eq1.toLowerCase() === eq2.toLowerCase())
    errores.push("Equipo/Jugador 1 y 2 no pueden ser iguales.");

  if (fecha && hora) {
    const f = new Date(`${fecha}T${hora}`);
    if (isNaN(f.getTime()))     errores.push("Fecha u hora con formato inválido.");
    else if (f < new Date())    errores.push("La fecha/hora debe ser futura.");
  }

  if (isNaN(cuota1) || cuota1 <= 1) errores.push("La cuota 1 debe ser > 1.");
  if (isNaN(cuota2) || cuota2 <= 1) errores.push("La cuota 2 debe ser > 1.");
  if (dep!=="tenis"&&dep!=="baloncesto" && (isNaN(cuotaX)||cuotaX<=1))
    errores.push("La cuota X debe ser > 1.");

  // Validar nacionalidades solo si están visibles
  const nac1 = $("nacionalidad1")?.value;
  const nac2 = $("nacionalidad2")?.value;
  if (wrapperNac1 && wrapperNac1.style.display !== "none" && !nac1) errores.push("La nacionalidad del equipo/jugador 1 es obligatoria.");
  if (wrapperNac2 && wrapperNac2.style.display !== "none" && !nac2) errores.push("La nacionalidad del equipo/jugador 2 es obligatoria.");

  // Validar goleadores: cuotas válidas si hay alguno
  for (const g of goleadores) {
    if (!g.nombre || isNaN(g.cuota) || g.cuota <= 1) {
      errores.push(`Cuota de goleador inválida para "${g.nombre || "[sin nombre]"}"`);
    }
  }

  // Validar tarjetas avanzadas (tablas)
  if (dep === "futbol" && window.tarjetasCuotas) {
    for (const segmento of TARJETAS_SEGMENTOS) {
      for (const equipo of TARJETAS_EQUIPOS) {
        for (const n of TARJETAS_FILAS) {
          for (const col of TARJETAS_COLUMNAS) {
            const v = (((window.tarjetasCuotas?.[segmento.id]?.[equipo.id]?.[n]?.[col.id]) || '') + '').trim();
            if (v !== "" && (isNaN(parseFloat(v)) || parseFloat(v) <= 1)) {
              errores.push(`Cuota de tarjetas inválida en ${segmento.label} - ${equipo.label} - ${n} tarjeta(s) - ${col.label}: debe ser > 1`);
            }
          }
        }
      }
    }
  }

  if (errores.length) {
    msg.textContent = errores.join(" ");
    msg.style.color = "red";
    return false;
  }
  msg.textContent = "";
  return true;
}

/* 6️⃣  Construir objeto partido ------------------------------------------- */
function construirPartido() {
  const dep   = campos.deporte.value.trim();
  const liga  = campos.liga.value.trim();
  const eq1   = campos.equipo1.value.trim();
  const eq2   = campos.equipo2.value.trim();
  const fecha = campos.fecha.value;
  const hora  = campos.hora.value;

  const nacionalidad1 = $("nacionalidad1") ? $("nacionalidad1").value.trim() : null;
  const nacionalidad2 = $("nacionalidad2") ? $("nacionalidad2").value.trim() : null;

  const cuota1 = parseFloat(campos.cuota1.value);
  const cuota2 = parseFloat(campos.cuota2.value);
  const cuotaX = parseFloat(campos.cuotaX.value);

  const opciones = [
    {nombre:`Gana ${eq1}`, valor:"1", cuota:cuota1},
    {nombre:`Gana ${eq2}`, valor:"2", cuota:cuota2}
  ];
  if (dep!=="tenis"&&dep!=="baloncesto")
    opciones.splice(1,0,{nombre:"Empate", valor:"X", cuota:cuotaX});

  // ----> Añadir el mercado de goleadores si hay alguno
  const mercados = {
    resultado:{ nombre:"Resultado final", opciones }
  };
  if (dep === "futbol" && goleadores.length > 0) {
    mercados.goleadores = {
      nombre: "Goleadores",
      opciones: goleadores.map(g => ({
        nombre: g.nombre,
        cuota: g.cuota,
        valor: g.valor
      }))
    };
  }

  // ----> Añadir mercado de tarjetas avanzado solo si alguna cuota está rellena
  let tarjetasObj = {};
  let algunaTarjeta = false;
  if (dep === "futbol" && window.tarjetasCuotas) {
    for (const segmento of TARJETAS_SEGMENTOS) {
      tarjetasObj[segmento.id] = {};
      for (const equipo of TARJETAS_EQUIPOS) {
        tarjetasObj[segmento.id][equipo.id] = {};
        for (const n of TARJETAS_FILAS) {
          tarjetasObj[segmento.id][equipo.id][n] = {};
          for (const col of TARJETAS_COLUMNAS) {
            const v = (((window.tarjetasCuotas?.[segmento.id]?.[equipo.id]?.[n]?.[col.id]) || '') + '').trim();
            if (v !== "") algunaTarjeta = true;
            tarjetasObj[segmento.id][equipo.id][n][col.id] = v === "" ? null : parseFloat(v);
          }
        }
      }
    }
    if (algunaTarjeta) {
      mercados.tarjetas = {
        nombre: "Tarjetas",
        opciones: tarjetasObj
      };
    }
  }

  return {
    deporte: dep,
    liga,
    equipo1: eq1,
    nacionalidad1,
    equipo2: eq2,
    nacionalidad2,
    fecha,
    hora,
    mercados
    // NO añadas partidoId aquí, lo añadimos después con el ID del documento
  };
}

/* 7️⃣  Mostrar modal y esperar confirmación ----------------------------- */
function mostrarModal(mensaje) {
  modalText.textContent = mensaje;
  modal.style.display = "block";

  return new Promise((resolve) => {
    btnConfirm.onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };
    btnCancel.onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };
  });
}

/* 8️⃣  Mostrar/Ocultar spinner ------------------------------------------ */
function mostrarSpinner(mostrar) {
  spinner.style.display = mostrar ? "block" : "none";
}

/* 9️⃣  Guardar partido en Firestore -------------------------------------- */
async function guardarPartido() {
  if (!auth.currentUser) {
    msg.style.color = "red";
    msg.textContent = "Debes iniciar sesión para crear un partido.";
    return;
  }

  if (!validarDatos()) return;

  const partido = construirPartido();
  const confirm = await mostrarModal("¿Quieres crear este partido?");
  if (!confirm) return;

  mostrarSpinner(true);

  try {
    const docRef = await addDoc(collection(db, "partidos"), partido);
    await setDoc(doc(db, "partidos", docRef.id), { partidoId: docRef.id }, { merge: true });

    mostrarSpinner(false);
    msg.style.color = "green";
    msg.textContent = "¡Partido creado con éxito!";

    // Reset formulario
    Object.values(campos).forEach(input => input.value = "");
    const sel1 = $("nacionalidad1");
    const sel2 = $("nacionalidad2");
    if (sel1) sel1.value = "";
    if (sel2) sel2.value = "";
    if (campos.cuotaX) campos.cuotaX.style.display = "inline-block";
    goleadores.length = 0;
    renderGoleadores();
    actualizarDatalistGoleadores();
    // Reset tarjetas avanzadas
    if (window.tarjetasCuotas) window.tarjetasCuotas = {};
    if (typeof renderTarjetasTabs === "function") renderTarjetasTabs();

  } catch (error) {
    mostrarSpinner(false);
    msg.style.color = "red";
    msg.textContent = "Error guardando partido: " + error.message;
  }
}

/*  🔟  Evento submit ----------------------------------------------------- */
const form = $("formCrearPartido");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      guardarPartido();
    });
  }
});
