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
    "Elche","Mallorca","Levante", "Girona", "Oviedo"
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
    "Bayern Munich","Borussia Dortmund","Leipzig","Bayer Leverkusen",
    "Eintracht Frankfurt","Wolfsburg","Mönchengladbach","Freiburg","Union Berlin",
    "Werder Bremen", "Stuttgart","Hoffenheim","Mainz",
    "Augsburgo","San Pauli","Heidenheim","Colonia"
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

// Jugadores por equipo - EXPANDE según tus necesidades
const jugadoresPorEquipo = {
  "Real Madrid": ["Vinícius Jr.", "Rodrygo", "Jude Bellingham", "Joselu", "Brahim Díaz"],
  "Barcelona": ["Robert Lewandowski", "Lamine Yamal", "Ferran Torres", "Pedri"],
  "Borussia Dortmund": ["Niclas Füllkrug", "Marco Reus", "Julian Brandt", "Karim Adeyemi"],
  "Bayern Munich": ["Harry Kane", "Thomas Müller", "Serge Gnabry", "Leroy Sané"],
  // ... añade todos los equipos y jugadores que quieras
};

const nacionalidades = [
  "España","Argentina","Brasil","Francia","Alemania","Italia","Portugal","Inglaterra",
  "México","Colombia","Uruguay","Chile","Estados Unidos","Canadá","Australia","Japón","Corea del Sur"
];

function slugify(text) {
  return text
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-zA-Z0-9 ]/g, "") // quita símbolos
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

// ---------- TARJETAS (EDICIÓN) - CONFIG & ESTADO ----------
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
let tarjetasOpciones = {}; // Estado global de edición

const CORNERS_SEGMENTOS = [
  { id: 'primera', label: '1ª Mitad' },
  { id: 'segunda', label: '2ª Mitad' },
  { id: 'encuentro', label: 'Encuentro' }
];
const CORNERS_EQUIPOS = [
  { id: 'equipo1', label: 'Equipo 1' },
  { id: 'equipo2', label: 'Equipo 2' },
  { id: 'ambos', label: 'Ambos Equipos' }
];
const CORNERS_COLUMNAS = [
  { id: 'mas', label: 'Más de' },
  { id: 'exactamente', label: 'Exactamente' },
  { id: 'menos', label: 'Menos de' }
];
const CORNERS_FILAS = [4,5,6,7,8,9,10,11,12,13,14,15,16,17];
let cornersOpciones = {}; // Estado global de edición para corners

// ====================== TARJETAS (EDICIÓN DE MERCADO) ======================
function renderTarjetasEditor() {
  const containerId = "tarjetasAdminContainer";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.marginTop = "20px";
    // lo insertamos después de #goleadoresContainer
    const goleadoresDiv = document.getElementById("goleadoresContainer");
    goleadoresDiv.parentNode.insertBefore(container, goleadoresDiv.nextSibling);
  }
  container.innerHTML = `<h3>Mercado Tarjetas</h3>
    <div class="tarjetas-tabs" id="edit-tarjetas-tabs"></div>
    <div class="tarjetas-subtabs" id="edit-tarjetas-subtabs"></div>
    <div id="edit-tarjetas-table"></div>
  `;

  // Inicializa seleccionadas
  if (!window.editTarjetasTabSel) window.editTarjetasTabSel = 'primera';
  if (!window.editTarjetasSubtabSel) window.editTarjetasSubtabSel = 'equipo1';

  // Tabs segmento
  const $tabs = document.getElementById("edit-tarjetas-tabs");
  $tabs.innerHTML = TARJETAS_SEGMENTOS.map(seg =>
    `<button type="button" class="${window.editTarjetasTabSel === seg.id ? "active" : ""}" data-tab="${seg.id}">${seg.label}</button>`
  ).join('');
  // Subtabs equipo
  const $subtabs = document.getElementById("edit-tarjetas-subtabs");
  $subtabs.innerHTML = TARJETAS_EQUIPOS.map(eq =>
    `<button type="button" class="${window.editTarjetasSubtabSel === eq.id ? "active" : ""}" data-subtab="${eq.id}">${eq.label}</button>`
  ).join('');

  // Inicializa estructura si no existe
  if (!tarjetasOpciones[window.editTarjetasTabSel]) tarjetasOpciones[window.editTarjetasTabSel] = {};
  if (!tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel]) {
    tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel] = {};
    TARJETAS_FILAS.forEach(n => {
      tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
    });
  }
  const datos = tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel];

  // Tabla
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

  document.getElementById("edit-tarjetas-table").innerHTML = html;

  // Eventos para tabs
  $tabs.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      window.editTarjetasTabSel = btn.dataset.tab;
      renderTarjetasEditor();
    };
  });
  $subtabs.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      window.editTarjetasSubtabSel = btn.dataset.subtab;
      renderTarjetasEditor();
    };
  });

  // Evento para inputs
  document.getElementById("edit-tarjetas-table").querySelectorAll("input[type=number]").forEach(input => {
    input.addEventListener("input", () => {
      const n = input.getAttribute("data-n");
      const col = input.getAttribute("data-col");
      let v = input.value;
      if (!tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel][n])
        tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
      tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel][n][col] = v;
    });
  });
}

// Mostrar el bloque de tarjetas sólo si deporte es fútbol
function mostrarTarjetasSiFutbol() {
  const deporte = document.getElementById("deporte").value;
  const containerId = "tarjetasAdminContainer";
  let container = document.getElementById(containerId);
  if (deporte === "futbol") {
    renderTarjetasEditor();
    if (container) container.style.display = "block";
  } else if (container) {
    container.style.display = "none";
  }
}

// ================== CORNERS (EDICIÓN DE MERCADO) ==================
function renderCornersEditor() {
  const containerId = "cornersAdminContainer";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.marginTop = "20px";
    // lo insertamos después de tarjetasAdminContainer
    const tarjetasDiv = document.getElementById("tarjetasAdminContainer");
    tarjetasDiv.parentNode.insertBefore(container, tarjetasDiv.nextSibling);
  }
  container.innerHTML = `<h3>Mercado Corners</h3>
    <div class="corners-tabs" id="edit-corners-tabs"></div>
    <div class="corners-subtabs" id="edit-corners-subtabs"></div>
    <div id="edit-corners-table"></div>
  `;

  if (!window.editCornersTabSel) window.editCornersTabSel = 'primera';
  if (!window.editCornersSubtabSel) window.editCornersSubtabSel = 'equipo1';

  // Tabs segmento
  const $tabs = document.getElementById("edit-corners-tabs");
  $tabs.innerHTML = CORNERS_SEGMENTOS.map(seg =>
    `<button type="button" class="${window.editCornersTabSel === seg.id ? "active" : ""}" data-tab="${seg.id}">${seg.label}</button>`
  ).join('');
  // Subtabs equipo
  const $subtabs = document.getElementById("edit-corners-subtabs");
  $subtabs.innerHTML = CORNERS_EQUIPOS.map(eq =>
    `<button type="button" class="${window.editCornersSubtabSel === eq.id ? "active" : ""}" data-subtab="${eq.id}">${eq.label}</button>`
  ).join('');

  // Inicializa estructura si no existe
  if (!cornersOpciones[window.editCornersTabSel]) cornersOpciones[window.editCornersTabSel] = {};
  if (!cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel]) {
    cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel] = {};
    CORNERS_FILAS.forEach(n => {
      cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
    });
  }
  const datos = cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel];

  // Tabla
  let html = `<table class="corners-table"><thead><tr><th></th>`;
  CORNERS_COLUMNAS.forEach(col => html += `<th>${col.label}</th>`);
  html += `</tr></thead><tbody>`;
  CORNERS_FILAS.forEach(n => {
    html += `<tr><td>${n} corner${n>1?'s':''}</td>`;
    CORNERS_COLUMNAS.forEach(col => {
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

  document.getElementById("edit-corners-table").innerHTML = html;

  // Eventos para tabs
  $tabs.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      window.editCornersTabSel = btn.dataset.tab;
      renderCornersEditor();
    };
  });
  $subtabs.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      window.editCornersSubtabSel = btn.dataset.subtab;
      renderCornersEditor();
    };
  });

  // Evento para inputs
  document.getElementById("edit-corners-table").querySelectorAll("input[type=number]").forEach(input => {
    input.addEventListener("input", () => {
      const n = input.getAttribute("data-n");
      const col = input.getAttribute("data-col");
      let v = input.value;
      if (!cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel][n])
        cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
      cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel][n][col] = v;
    });
  });
}

// Mostrar el bloque de corners sólo si deporte es fútbol
function mostrarCornersSiFutbol() {
  const deporte = document.getElementById("deporte").value;
  const containerId = "cornersAdminContainer";
  let container = document.getElementById(containerId);
  if (deporte === "futbol") {
    renderCornersEditor();
    if (container) container.style.display = "block";
  } else if (container) {
    container.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Firebase config
  const firebaseConfig = {
    apiKey: "AIzaSyDgdI3UcnHuRlcynH-pCHcGORcGBAD3FSU",
    authDomain: "winnet-708db.firebaseapp.com",
    projectId: "winnet-708db",
    storageBucket: "winnet-708db.appspot.com",
    messagingSenderId: "869401097323",
    appId: "1:869401097323:web:fddb5e44af9d27a7cfed2e",
    measurementId: "G-12LH5QRVD0"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.firestore();

  // DOM
  const selectPartido = document.getElementById("selectPartido");
  const editForm = document.getElementById("editMatchForm");
  const messageDiv = document.getElementById("message");
  const deporteSelect = document.getElementById("deporte");
  const ligaInput = document.getElementById("liga");
  const ligaDatalist = document.getElementById("ligas-list");
  const equipo1Input = document.getElementById("equipo1");
  const equipo2Input = document.getElementById("equipo2");
  const equiposDatalist = document.getElementById("equipos-list");
  const invertirBtn = document.getElementById("invertirEquipos");
  const mercadoCuotasContainer = document.getElementById("mercadoCuotasContainer");
  const nacionalidadesWrapper = document.getElementById("nacionalidades-wrapper");
  const nacionalidad1Input = document.getElementById("nacionalidad1");
  const nacionalidad2Input = document.getElementById("nacionalidad2");
  const nacionalidadesList = document.getElementById("nacionalidades-list");
  const jugadoresList = document.getElementById("jugadores-list");

  // ----- Corners config -----
  const CORNERS_SEGMENTOS = [
    { id: 'primera', label: '1ª Mitad' },
    { id: 'segunda', label: '2ª Mitad' },
    { id: 'encuentro', label: 'Encuentro' }
  ];
  const CORNERS_EQUIPOS = [
    { id: 'equipo1', label: 'Equipo 1' },
    { id: 'equipo2', label: 'Equipo 2' },
    { id: 'ambos', label: 'Ambos Equipos' }
  ];
  const CORNERS_COLUMNAS = [
    { id: 'mas', label: 'Más de' },
    { id: 'exactamente', label: 'Exactamente' },
    { id: 'menos', label: 'Menos de' }
  ];
  const CORNERS_FILAS = [4,5,6,7,8,9,10,11,12,13,14,15,16,17];
  let cornersOpciones = {};

  // Actualiza el datalist de jugadores según equipos seleccionados
  function actualizarJugadoresDatalist() {
    if (!jugadoresList) return;
    const equipo1 = equipo1Input.value;
    const equipo2 = equipo2Input.value;
    jugadoresList.innerHTML = "";
    let jugadores = [];
    if (jugadoresPorEquipo[equipo1]) jugadores = jugadores.concat(jugadoresPorEquipo[equipo1]);
    if (jugadoresPorEquipo[equipo2]) jugadores = jugadores.concat(jugadoresPorEquipo[equipo2]);
    jugadores = [...new Set(jugadores)];
    jugadores.forEach(j => {
      const opt = document.createElement("option");
      opt.value = j;
      jugadoresList.appendChild(opt);
    });
  }

  equipo1Input.addEventListener("input", actualizarJugadoresDatalist);
  equipo2Input.addEventListener("input", actualizarJugadoresDatalist);

  // Rellenar datalist de nacionalidades si no está ya
  if (nacionalidadesList && nacionalidadesList.children.length === 0) {
    nacionalidades.forEach(nac => {
      const option = document.createElement("option");
      option.value = nac;
      nacionalidadesList.appendChild(option);
    });
  }

  function showMessage(msg, isError = false) {
    if (messageDiv) {
      messageDiv.textContent = msg;
      messageDiv.style.color = isError ? "red" : "green";
    }
  }

  // Llenar partidos en el select
  async function cargarPartidos() {
    try {
      selectPartido.innerHTML = '<option value="">-- Selecciona --</option>';
      const snapshot = await db.collection("partidos").get();
      snapshot.forEach(doc => {
        const data = doc.data();
        const equipo1 = data.equipo1 || data.homeTeam || "Equipo 1";
        const equipo2 = data.equipo2 || data.awayTeam || "Equipo 2";
        const option = document.createElement("option");
        option.text = `${equipo1} vs ${equipo2}`;
        option.value = doc.id;
        selectPartido.add(option);
      });
    } catch (err) {
      showMessage("Error cargando partidos: " + err.message, true);
    }
  }

  // Actualizar datalist de ligas según deporte
  function actualizarLigasDatalist(deporte) {
    ligaDatalist.innerHTML = "";
    (ligasPorDeporte[deporte] || []).forEach(l => {
      const opt = document.createElement("option");
      opt.value = l;
      ligaDatalist.appendChild(opt);
    });
  }

  // Actualizar datalist de equipos según liga
  function actualizarEquiposDatalist(liga) {
    equiposDatalist.innerHTML = "";
    (equiposPorLiga[liga] || []).forEach(eq => {
      const opt = document.createElement("option");
      opt.value = eq;
      equiposDatalist.appendChild(opt);
    });
  }

  // Mostrar/ocultar nacionalidades según deporte
  function actualizarNacionalidadesVisibility() {
    if (deporteSelect.value === "tenis") {
      nacionalidadesWrapper.style.display = "flex";
    } else {
      nacionalidadesWrapper.style.display = "none";
      nacionalidad1Input.value = "";
      nacionalidad2Input.value = "";
    }
  }

  deporteSelect.addEventListener("change", function() {
    actualizarLigasDatalist(this.value);
    ligaInput.value = "";
    equipo1Input.value = "";
    equipo2Input.value = "";
    equiposDatalist.innerHTML = "";
    actualizarNacionalidadesVisibility();
    actualizarJugadoresDatalist();
    mostrarTarjetasSiFutbol();
    mostrarCornersSiFutbol();
  });

  ligaInput.addEventListener("input", function() {
    actualizarEquiposDatalist(this.value);
    equipo1Input.value = "";
    equipo2Input.value = "";
    actualizarJugadoresDatalist();
  });

  if (invertirBtn && equipo1Input && equipo2Input) {
    invertirBtn.addEventListener("click", function(e) {
      e.preventDefault();
      [equipo1Input.value, equipo2Input.value] = [equipo2Input.value, equipo1Input.value];
      actualizarJugadoresDatalist();
    });
  }

  // Renderizar SOLO cuotas de mercado (editable)
  function renderCuotasMercado(opciones = []) {
    mercadoCuotasContainer.innerHTML = "";
    if (!Array.isArray(opciones)) return;
    opciones.forEach((op, i) => {
      const div = document.createElement("div");
      div.className = "opcion-mercado";
      const labelCuota = document.createElement("label");
      labelCuota.innerText = `Cuota ${op.valor || i+1}:`;
      labelCuota.htmlFor = `opcionCuota${i}`;
      const inputCuota = document.createElement("input");
      inputCuota.type = "number";
      inputCuota.step = "0.01";
      inputCuota.id = `opcionCuota${i}`;
      inputCuota.value = op.cuota || "";
      inputCuota.required = true;
      inputCuota.min = "1";
      div.appendChild(labelCuota);
      div.appendChild(inputCuota);
      mercadoCuotasContainer.appendChild(div);
    });
  }

  // ======== GOLEADORES: EDICIÓN CON AUTOCOMPLETADO ========
  let currentGoleadoresOpciones = [];

  function renderGoleadoresList(opciones = []) {
    currentGoleadoresOpciones = opciones;
    const listDiv = document.getElementById("goleadoresList");
    listDiv.innerHTML = "";

    opciones.forEach((op, i) => {
      const row = document.createElement("div");
      row.className = "goleador-row";

      // Nombre con datalist
      const nombreIn = document.createElement("input");
      nombreIn.type = "text";
      nombreIn.value = op.nombre || "";
      nombreIn.placeholder = "Nombre jugador";
      nombreIn.className = "goleador-nombre";
      nombreIn.required = true;
      nombreIn.setAttribute("list", "jugadores-list");
      nombreIn.style.marginRight = "0.6em";

      // Cuota
      const cuotaIn = document.createElement("input");
      cuotaIn.type = "number";
      cuotaIn.value = op.cuota || "";
      cuotaIn.step = "0.01";
      cuotaIn.min = "1";
      cuotaIn.className = "goleador-cuota";
      cuotaIn.placeholder = "Cuota";
      cuotaIn.required = true;
      cuotaIn.style.width = "5em";
      cuotaIn.style.marginRight = "0.6em";

      // Eliminar botón
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.innerHTML = '<i class="fa fa-trash"></i>';
      delBtn.title = "Eliminar goleador";
      delBtn.className = "btn-del-goleador";
      delBtn.onclick = () => {
        currentGoleadoresOpciones.splice(i, 1);
        renderGoleadoresList(currentGoleadoresOpciones);
      };

      // Cuando cambie el nombre, actualiza el valor automáticamente
      nombreIn.addEventListener("input", function() {
        op.nombre = nombreIn.value;
        op.valor = slugify(nombreIn.value);
      });

      // Guarda siempre el valor actualizado aunque no cambie el nombre
      op.valor = slugify(nombreIn.value);

      // Actualizar cuota
      cuotaIn.addEventListener("input", function() {
        op.cuota = cuotaIn.value;
      });

      row.appendChild(nombreIn);
      row.appendChild(cuotaIn);
      row.appendChild(delBtn);

      listDiv.appendChild(row);
    });
  }

  document.body.addEventListener("click", function(e) {
    if (e.target && (e.target.id === "addGoleadorBtn" || e.target.closest("#addGoleadorBtn"))) {
      currentGoleadoresOpciones.push({nombre: "", valor: "", cuota: 1});
      renderGoleadoresList(currentGoleadoresOpciones);
    }
  });

  // ====================== TARJETAS (EDICIÓN DE MERCADO) ======================
  function renderTarjetasEditor() {
    const containerId = "tarjetasAdminContainer";
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.style.marginTop = "20px";
      // lo insertamos después de #goleadoresContainer
      const goleadoresDiv = document.getElementById("goleadoresContainer");
      goleadoresDiv.parentNode.insertBefore(container, goleadoresDiv.nextSibling);
    }
    container.innerHTML = `<h3>Mercado Tarjetas</h3>
      <div class="tarjetas-tabs" id="edit-tarjetas-tabs"></div>
      <div class="tarjetas-subtabs" id="edit-tarjetas-subtabs"></div>
      <div id="edit-tarjetas-table"></div>
    `;

    // Inicializa seleccionadas
    if (!window.editTarjetasTabSel) window.editTarjetasTabSel = 'primera';
    if (!window.editTarjetasSubtabSel) window.editTarjetasSubtabSel = 'equipo1';

    // Tabs segmento
    const $tabs = document.getElementById("edit-tarjetas-tabs");
    $tabs.innerHTML = TARJETAS_SEGMENTOS.map(seg =>
      `<button type="button" class="${window.editTarjetasTabSel === seg.id ? "active" : ""}" data-tab="${seg.id}">${seg.label}</button>`
    ).join('');
    // Subtabs equipo
    const $subtabs = document.getElementById("edit-tarjetas-subtabs");
    $subtabs.innerHTML = TARJETAS_EQUIPOS.map(eq =>
      `<button type="button" class="${window.editTarjetasSubtabSel === eq.id ? "active" : ""}" data-subtab="${eq.id}">${eq.label}</button>`
    ).join('');

    // Inicializa estructura si no existe
    if (!tarjetasOpciones[window.editTarjetasTabSel]) tarjetasOpciones[window.editTarjetasTabSel] = {};
    if (!tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel]) {
      tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel] = {};
      TARJETAS_FILAS.forEach(n => {
        tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
      });
    }
    const datos = tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel];

    // Tabla
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

    document.getElementById("edit-tarjetas-table").innerHTML = html;

    // Eventos para tabs
    $tabs.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        window.editTarjetasTabSel = btn.dataset.tab;
        renderTarjetasEditor();
      };
    });
    $subtabs.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        window.editTarjetasSubtabSel = btn.dataset.subtab;
        renderTarjetasEditor();
      };
    });

    // Evento para inputs
    document.getElementById("edit-tarjetas-table").querySelectorAll("input[type=number]").forEach(input => {
      input.addEventListener("input", () => {
        const n = input.getAttribute("data-n");
        const col = input.getAttribute("data-col");
        let v = input.value;
        if (!tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel][n])
          tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
        tarjetasOpciones[window.editTarjetasTabSel][window.editTarjetasSubtabSel][n][col] = v;
      });
    });
  }

  // ================== CORNERS (EDICIÓN DE MERCADO) ==================
  function renderCornersEditor() {
    const containerId = "cornersAdminContainer";
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.style.marginTop = "20px";
      // lo insertamos después de tarjetasAdminContainer
      const tarjetasDiv = document.getElementById("tarjetasAdminContainer");
      tarjetasDiv.parentNode.insertBefore(container, tarjetasDiv.nextSibling);
    }
    container.innerHTML = `<h3>Mercado Corners</h3>
      <div class="corners-tabs" id="edit-corners-tabs"></div>
      <div class="corners-subtabs" id="edit-corners-subtabs"></div>
      <div id="edit-corners-table"></div>
    `;

    if (!window.editCornersTabSel) window.editCornersTabSel = 'primera';
    if (!window.editCornersSubtabSel) window.editCornersSubtabSel = 'equipo1';

    // Tabs segmento
    const $tabs = document.getElementById("edit-corners-tabs");
    $tabs.innerHTML = CORNERS_SEGMENTOS.map(seg =>
      `<button type="button" class="${window.editCornersTabSel === seg.id ? "active" : ""}" data-tab="${seg.id}">${seg.label}</button>`
    ).join('');
    // Subtabs equipo
    const $subtabs = document.getElementById("edit-corners-subtabs");
    $subtabs.innerHTML = CORNERS_EQUIPOS.map(eq =>
      `<button type="button" class="${window.editCornersSubtabSel === eq.id ? "active" : ""}" data-subtab="${eq.id}">${eq.label}</button>`
    ).join('');

    // Inicializa estructura si no existe
    if (!cornersOpciones[window.editCornersTabSel]) cornersOpciones[window.editCornersTabSel] = {};
    if (!cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel]) {
      cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel] = {};
      CORNERS_FILAS.forEach(n => {
        cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
      });
    }
    const datos = cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel];

    // Tabla
    let html = `<table class="corners-table"><thead><tr><th></th>`;
    CORNERS_COLUMNAS.forEach(col => html += `<th>${col.label}</th>`);
    html += `</tr></thead><tbody>`;
    CORNERS_FILAS.forEach(n => {
      html += `<tr><td>${n} corner${n>1?'s':''}</td>`;
      CORNERS_COLUMNAS.forEach(col => {
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

    document.getElementById("edit-corners-table").innerHTML = html;

    // Eventos para tabs
    $tabs.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        window.editCornersTabSel = btn.dataset.tab;
        renderCornersEditor();
      };
    });
    $subtabs.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        window.editCornersSubtabSel = btn.dataset.subtab;
        renderCornersEditor();
      };
    });

    // Evento para inputs
    document.getElementById("edit-corners-table").querySelectorAll("input[type=number]").forEach(input => {
      input.addEventListener("input", () => {
        const n = input.getAttribute("data-n");
        const col = input.getAttribute("data-col");
        let v = input.value;
        if (!cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel][n])
          cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
        cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel][n][col] = v;
      });
    });
  }

  function mostrarCornersSiFutbol() {
    const deporte = deporteSelect.value;
    const containerId = "cornersAdminContainer";
    let container = document.getElementById(containerId);
    if (deporte === "futbol") {
      renderCornersEditor();
      if (container) container.style.display = "block";
    } else if (container) {
      container.style.display = "none";
    }
  }

  // Mostrar/ocultar ambos bloques según deporte
  function mostrarMercadosAvanzados() {
    mostrarTarjetasSiFutbol();
    mostrarCornersSiFutbol();
  }

  // Al cargar el partido seleccionado, cargar también las tarjetas y los corners
  selectPartido.addEventListener("change", async function () {
    const partidoId = this.value;
    if (!editForm) return;
    if (!partidoId) {
      editForm.style.display = "none";
      showMessage("");
      renderGoleadoresList([]);
      tarjetasOpciones = {};
      cornersOpciones = {};
      mostrarMercadosAvanzados();
      return;
    }
    try {
      const doc = await db.collection("partidos").doc(partidoId).get();
      if (!doc.exists) throw new Error("Partido no encontrado");
      const data = doc.data();
      deporteSelect.value = data.deporte || "";
      actualizarLigasDatalist(deporteSelect.value);
      ligaInput.value = data.liga || "";
      actualizarEquiposDatalist(ligaInput.value);
      equipo1Input.value = data.equipo1 ?? data.homeTeam ?? "";
      equipo2Input.value = data.equipo2 ?? data.awayTeam ?? "";
      actualizarJugadoresDatalist();
      if (data.deporte === "tenis") {
        nacionalidadesWrapper.style.display = "flex";
        nacionalidad1Input.value = data.nacionalidad1 || "";
        nacionalidad2Input.value = data.nacionalidad2 || "";
      } else {
        nacionalidadesWrapper.style.display = "none";
        nacionalidad1Input.value = "";
        nacionalidad2Input.value = "";
      }
      document.getElementById("fecha").value = data.fecha ?? "";
      document.getElementById("hora").value = data.hora ?? "";
      const opciones = data.mercados?.resultado?.opciones || [];
      renderCuotasMercado(opciones);
      const goleadoresOpciones = data.mercados?.goleadores?.opciones || [];
      renderGoleadoresList(goleadoresOpciones);
      // TARJETAS: cargar estructura si existe
      if (data.deporte === "futbol" && data.mercados?.tarjetas?.opciones) {
        tarjetasOpciones = JSON.parse(JSON.stringify(data.mercados.tarjetas.opciones));
      } else {
        tarjetasOpciones = {};
      }
      // CORNERS: cargar estructura si existe
      if (data.deporte === "futbol" && data.mercados?.corners?.opciones) {
        cornersOpciones = JSON.parse(JSON.stringify(data.mercados.corners.opciones));
      } else {
        cornersOpciones = {};
      }
      mostrarMercadosAvanzados();
      editForm.style.display = "block";
      showMessage("");
    } catch (err) {
      showMessage("Error cargando partido: " + err.message, true);
      editForm.style.display = "none";
      renderGoleadoresList([]);
      tarjetasOpciones = {};
      cornersOpciones = {};
      mostrarMercadosAvanzados();
    }
  });

  if (editForm) {
    editForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const partidoId = selectPartido.value;
      if (!partidoId) {
        showMessage("Selecciona un partido", true);
        return;
      }
      const opciones = [];
      const cuotaInputs = mercadoCuotasContainer.querySelectorAll("input[type='number']");
      cuotaInputs.forEach((input, i) => {
        const cuota = +(input.value || 0);
        const label = input.previousSibling;
        let valor = label && label.innerText.includes('Cuota ') ? label.innerText.split('Cuota ')[1].replace(':','') : (i+1).toString();
        opciones.push({ cuota, valor });
      });
      const partidoDoc = await db.collection("partidos").doc(partidoId).get();
      const data = partidoDoc.data();
      const oldOpciones = data?.mercados?.resultado?.opciones || [];
      opciones.forEach((op, i) => {
        if (oldOpciones[i]) {
          op.nombre = oldOpciones[i].nombre || '';
          op.valor = oldOpciones[i].valor || op.valor;
        }
      });
      const goleadoresListDiv = document.getElementById("goleadoresList");
      const filas = goleadoresListDiv.querySelectorAll(".goleador-row");
      const nuevasOpcionesGoleadores = [];
      for (const fila of filas) {
        const nombre = fila.querySelector(".goleador-nombre")?.value.trim();
        if (!nombre) continue;
        const valor = slugify(nombre);
        const cuota = parseFloat(fila.querySelector(".goleador-cuota")?.value) || 1;
        nuevasOpcionesGoleadores.push({nombre, valor, cuota});
      }

      // --------- TARJETAS guardar solo si alguna rellenada
      let tarjetasObj = {};
      let algunaTarjeta = false;
      if (deporteSelect.value === "futbol" && tarjetasOpciones) {
        for (const segmento of TARJETAS_SEGMENTOS) {
          tarjetasObj[segmento.id] = {};
          for (const equipo of TARJETAS_EQUIPOS) {
            tarjetasObj[segmento.id][equipo.id] = {};
            for (const n of TARJETAS_FILAS) {
              tarjetasObj[segmento.id][equipo.id][n] = {};
              for (const col of TARJETAS_COLUMNAS) {
                const v = (((tarjetasOpciones?.[segmento.id]?.[equipo.id]?.[n]?.[col.id]) || '') + '').trim();
                if (v !== "") algunaTarjeta = true;
                tarjetasObj[segmento.id][equipo.id][n][col.id] = v === "" ? null : parseFloat(v);
              }
            }
          }
        }
      }

      // --------- CORNERS guardar solo si alguna rellenada
      let cornersObj = {};
      let algunCorner = false;
      if (deporteSelect.value === "futbol" && cornersOpciones) {
        for (const segmento of CORNERS_SEGMENTOS) {
          cornersObj[segmento.id] = {};
          for (const equipo of CORNERS_EQUIPOS) {
            cornersObj[segmento.id][equipo.id] = {};
            for (const n of CORNERS_FILAS) {
              cornersObj[segmento.id][equipo.id][n] = {};
              for (const col of CORNERS_COLUMNAS) {
                const v = (((cornersOpciones?.[segmento.id]?.[equipo.id]?.[n]?.[col.id]) || '') + '').trim();
                if (v !== "") algunCorner = true;
                cornersObj[segmento.id][equipo.id][n][col.id] = v === "" ? null : parseFloat(v);
              }
            }
          }
        }
      }

      const formData = {
        deporte: deporteSelect.value,
        liga: ligaInput.value,
        equipo1: equipo1Input.value,
        equipo2: equipo2Input.value,
        fecha: document.getElementById("fecha").value,
        hora: document.getElementById("hora").value,
        homeTeam: equipo1Input.value,
        awayTeam: equipo2Input.value,
        mercados: {
          resultado: {
            nombre: "Resultado final",
            opciones: opciones
          },
          goleadores: {
            nombre: "Goleadores",
            opciones: nuevasOpcionesGoleadores
          }
        }
      };
      if (deporteSelect.value === "tenis") {
        formData.nacionalidad1 = nacionalidad1Input.value;
        formData.nacionalidad2 = nacionalidad2Input.value;
      }
      // Añadir tarjetas si hay alguna rellena
      if (deporteSelect.value === "futbol" && algunaTarjeta) {
        formData.mercados.tarjetas = {
          nombre: "Tarjetas",
          opciones: tarjetasObj
        };
      }
      // Añadir corners si hay alguna rellena
      if (deporteSelect.value === "futbol" && algunCorner) {
        formData.mercados.corners = {
          nombre: "Corners",
          opciones: cornersObj
        };
      }
      try {
        await db.collection("partidos").doc(partidoId).update(formData);
        showMessage("Partido editado correctamente");
      } catch (err) {
        showMessage("Error guardando cambios: " + err.message, true);
      }
    });
  }

  cargarPartidos();
});
