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

const wrapperNac1 = document.querySelector(".nacionalidad-1");
const wrapperNac2 = document.querySelector(".nacionalidad-2");

const goleadoresSection = document.getElementById("goleadores-section");

/* 3️⃣  Datos --------------------------------------------------------------------- */
const ligasPorDeporte = {
  futbol: ["La Liga","Premier League","Serie A","Bundesliga","Ligue 1","Champions League","Mundial de Clubes"],
  baloncesto: ["NBA","Euroliga"],
  tenis: ["ATP Madrid","Roland Garros"]
};

const equiposPorLiga = {
  "La Liga": [
    "Real Madrid","Barcelona","Atletico de Madrid","Sevilla","Valencia",
    "Real Sociedad","Villarreal","Real Betis","Athletic Club","Celta de Vigo",
    "Getafe","Espanyol","Osasuna","Alavés", "Rayo Vallecano",
    "Elche","Mallorca","Levante", "Girona", "Real Oviedo"
  ],
  "La Liga Hypermotion": [
    "Albacete","Almería","Andorra","Burgos","Cádiz","Castellón","Leganés","Ceuta","Córdoba","Cultural Leonesa",
    "Deportivo","Eibar","Granada","Huesca","Málaga","Mirandés","Racing Santander","Real Sociedad B","Zaragoza",
    "Sporting","Las Palmas","Valladolid"
  ],
  "Premier League": [
    "Manchester City","Liverpool","Manchester United","Arsenal","Chelsea",
    "Tottenham","Newcastle","Everton","Aston Villa","West Ham",
    "Brighton","Crystal Palace", "Wolves", "Leeds United", "Burnley",
    "Brentford","Fulham","Bournemouth","Nottingham Forest", "Sunderland"
  ],
  "Serie A": [
    "Juventus","Milan","Inter de Milan","Napoli","Roma",
    "Lazio","Atalanta","Fiorentina","Torino","Bolonia",
    "Como", "Udinense","Parma","Lecce","Genoa",
    "Cagliari","Verona", "Sassuolo","Pisa","Cremonese"
  ],
  "Bundesliga": [
    "Bayern Munich","Borussia Dortmund","RB Leipzig","Bayer Leverkusen",
    "Eintracht Frankfurt","Wolfsburg","Mönchengladbach","Freiburg","Union Berlin",
    "Werder Bremen", "Stuttgart","Hoffenheim","Mainz",
    "Augsburgo","San Pauli","Heidenheim","köln"
  ],
  "Ligue 1": [
    "PSG","Olympique Lyon","Mónaco","Lille", "Angers", 
    "Rennes","Lens","Nantes", "Auxerre","Havre",
    "Lorient", "Marsella", "Metz","Niza",
    "Paris", "Strasburg", "Toulouse", "Brest",
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

const jugadoresPorEquipo = {
  // LAliga
  "Real Madrid": [ "Vinícius Júnior", "Rodrygo Goes", "Jude Bellingham", "Brahim Díaz", "Thibaut Courtois", "Andriy Lunin", "Fran González", "Dean Huijsen", "Raúl Asencio", "Éder Militão", "Antonio Rüdiger", "David Alaba", "Fran García", "Ferland Mendy", "Trent Alexander-Arnold", "Dani Carvajal", "Aurélien Tchouaméni", "Mario Martín", "Federico Valverde", "Eduardo Camavinga", "Dani Ceballos", "Reinier Jesus", "Kylian Mbappé", "Endrick Felipe", "Gonzalo García", "Álvaro Rodríguez", "Álvaro Carreras", "Franco Mastantuono" ],
  "Atlético de Madrid": [ "Jan Oblak", "Juan Musso", "Robin Le Normand", "Dávid Hancko", "José Giménez", "Clément Lenglet", "Matteo Ruggeri", "César Azpilicueta", "Samuel Lino", "Koke Resurrección", "Thiago Almada", "Álex Baena", "Johnny Cardoso", "Antoine Griezmann", "Julián Álvarez" ],
  "Barcelona": [ "Iñaki Peña", "Wojciech Szczęsny", "Pau Cubarsí", "Ronald Araújo", "Alejandro Balde", "Jules Koundé", "Andreas Christensen", "Frenkie de Jong", "Pedri González", "Fermín López", "Gavi Páez", "Lamine Yamal", "Raphinha Belloli", "Robert Lewandowski" ],
  "Real Sociedad": [ "Álex Remiro", "Unai Marrero", "Igor Zubeldia", "Jon Martín", "Duje Caleta-Car", "Jon Pacheco", "Aritz Elustondo", "Aihen Muñoz", "Hamari Traoré", "Brais Méndez", "Beñat Turrientes", "Martín Zubimendi", "Mikel Merino", "Jon Ander Olasagasti", "Arsen Zakharyan", "Takefusa Kubo", "Mikel Oyarzabal", "Umar Sadiq", "Sheraldo Becker" ],
  "Athletic Club": [ "Unai Simón", "Julen Agirrezabala", "Dani Vivian", "Yeray Álvarez", "Aitor Paredes", "Yuri Berchiche", "Óscar de Marcos", "Iñigo Lekue", "Iker Muniain", "Oihan Sancet", "Unai Gómez", "Nico Williams", "Iñaki Williams", "Gorka Guruzeta", "Asier Villalibre" ],
  "Valencia": [ "Giorgi Mamardashvili", "Cristian Rivero", "Thierry Rendall", "Dimitri Foulquier", "Cristhian Mosquera", "Cenk Özkaçar", "José Gayà", "Hugo Guillamón", "Pepelu García", "Javi Guerra", "Fran Pérez", "Diego López", "Peter Federico", "Hugo Duro" ],
  "Villarreal": [ "Filip Jörgensen", "Pepe Reina", "Alfonso Pedraza", "Jorge Cuenca", "Yerson Mosquera", "Juan Foyth", "Kiko Femenía", "Étienne Capoue", "Dani Parejo", "Álex Baena", "Ilias Akhomach", "Yeremi Pino", "Alexander Sørloth", "Gerard Moreno", "José Morales" ],
  "Sevilla": [ "Marko Dmitrović", "Orjan Nyland", "Jesús Navas", "Adrià Pedrosa", "Loïc Badé", "Tanguy Nianzou", "Nemanja Gudelj", "Marcos Acuña", "Joan Jordán", "Boubakary Soumaré", "Óliver Torres", "Suso Fernández", "Lucas Ocampos", "Dodi Lukebakio", "Youssef En-Nesyri" ],
  "Real Betis": [ "Rui Silva", "Fran Vieites", "Héctor Bellerín", "Aitor Ruibal", "Germán Pezzella", "Marc Bartra", "Chadi Riad", "Juan Miranda", "Guido Rodríguez", "Marc Roca", "Johnny Cardoso", "Isco Alarcón", "Nabil Fekir", "Pablo Fornals", "Ayoze Pérez", "Willian José", "Borja Iglesias" ],
  "Celta de Vigo": [ "Vicente Guaita", "Iván Villar", "Joseph Aidoo", "Carl Starfelt", "Unai Núñez", "Manu Sánchez", "Óscar Mingueza", "Kevin Vázquez", "Fran Beltrán", "Luca de la Torre", "Jailson Marques", "Jonathan Bamba", "Carles Pérez", "Anastasios Douvikas", "Iago Aspas", "Jørgen Larsen" ],
  "Girona": [ "Paulo Gazzaniga", "Juan Carlos", "Miguel Gutiérrez", "Daley Blind", "David López", "Eric García", "Arnau Martínez", "Yan Couto", "Aleix García", "Yangel Herrera", "Iván Martín", "Sávio Moreira", "Viktor Tsygankov", "Artem Dovbyk", "Cristhian Stuani" ],
  "Getafe": [ "David Soria", "Kiko Casilla", "Djené Dakonam", "Stefan Mitrović", "Domingos Duarte", "Gastón Álvarez", "Juan Iglesias", "Diego Rico", "Mauro Arambarri", "Nemanja Maksimović", "Luis Milla", "Carles Aleñá", "Mason Greenwood", "Borja Mayoral", "Enes Ünal" ],
  "Osasuna": [ "Sergio Herrera", "Aitor Fernández", "Unai García", "David García", "Juan Cruz", "Rubén Peña", "Jesús Areso", "Moi Gómez", "Lucas Torró", "Jon Moncayola", "Aimar Oroz", "Rubén García", "Abde Ezzalzouli", "Ante Budimir", "Raúl García" ],
  "Rayo Vallecano": [ "Stole Dimitrievski", "Diego López", "Alfonso Espino", "Florian Lejeune", "Abdul Mumin", "Iván Balliu", "Pep Chavarría", "Óscar Valentín", "Unai López", "Pathé Ciss", "Isi Palazón", "Álvaro García", "Bebé Correia", "Raúl de Tomás", "Sergio Camello" ],
  "Alavés": [ "Antonio Sivera", "Owono Fedor", "Aleksandar Sedlar", "Abdel Abqar", "Rafa Marín", "Rubén Duarte", "Andoni Gorosabel", "Nahuel Tenaglia", "Antonio Blanco", "Ander Guevara", "Jon Guridi", "Luis Rioja", "Abde Rebbach", "Kike García", "Samu Omorodion" ],
  "Mallorca": [ "Predrag Rajković", "Dominik Greif", "Antonio Raíllo", "Martin Valjent", "Copete Andreu", "Giovanni González", "Pablo Maffeo", "Jaume Costa", "Samu Costa", "Antonio Sánchez", "Dani Rodríguez", "Sergi Darder", "Amath Ndiaye", "Abdón Prats", "Vedat Muriqi" ],
  "Espanyol": [ "Fernando Pacheco", "Joan García", "Óscar Gil", "Sergi Gómez", "Fernando Calero", "César Montes", "Leandro Cabrera", "Brian Oliván", "Edu Expósito", "Keidi Bare", "Nico Melamed", "Javi Puado", "Martin Braithwaite", "Joselu Mato" ],
  "Levante": [ "Andrés Fernández", "Joan Femenías", "Álex Muñoz", "Sergio Postigo", "Róber Pier", "Marc Pubill", "Son Hidalgo", "Pepelu Roca", "Pablo Martínez", "Jorge de Frutos", "Gonzalo Plata", "Mohamed Bouldini" ],
  "Elche": [ "Edgar Badia", "Axel Werner", "John Donald", "Enzo Roco", "Pedro Bigas", "Helibelton Palacios", "Carlos Clerc", "Gerard Gumbau", "Omar Mascarell", "Raúl Guti", "Fidel Chaves", "Josan Ferrández", "Lucas Boyé", "Pere Milla", "Ezequiel Ponce" ],
"Real Oviedo": [ "Leo Román", "Tomeu Nadal", "Dani Calvo", "Oier Luengo", "David Costas", "Viti Rozada", "Lucas Ahijado", "Jimmy Suárez", "Luismi Sánchez", "Santi Cazorla", "Masca Álvarez", "Borja Bastón" ],
  // ... añade todos los equipos y jugadores que quieras
};


/* 4️⃣  Autocompletado ------------------------------------------------------------ */
const ligaDatalist    = document.getElementById("ligas-list");
const equiposDatalist = document.getElementById("equipos-list");
const cuotaXInput     = document.getElementById("cuotaX");
const campos = ["deporte","liga","equipo1","equipo2","fecha","hora","cuota1","cuotaX","cuota2"]
  .reduce((o,k)=>{o[k]=document.getElementById(k);return o;}, {});

const msg = document.getElementById("msg");
const spinner = document.getElementById("spinner");
const modal = document.getElementById("modalConfirm");
const modalText = document.getElementById("modalText");
const btnConfirm = document.getElementById("btnConfirm");
const btnCancel = document.getElementById("btnCancel");
const previewContainer = document.getElementById("previewContainer");
const wrapperNac1 = document.querySelector(".nacionalidad-1");
const wrapperNac2 = document.querySelector(".nacionalidad-2");
const goleadoresSection = document.getElementById("goleadores-section");

/* --- Datalist para goleadores dinámico según equipos --- */
const datalistGoleadores = document.getElementById("goleadores-datalist");
function actualizarDatalistGoleadores() {
  const equipo1 = campos.equipo1.value.trim();
  const equipo2 = campos.equipo2.value.trim();
  let jugadores = [];
  if (window.jugadoresPorEquipo?.[equipo1]) jugadores = jugadores.concat(window.jugadoresPorEquipo[equipo1]);
  if (window.jugadoresPorEquipo?.[equipo2]) jugadores = jugadores.concat(window.jugadoresPorEquipo[equipo2]);
  jugadores = [...new Set(jugadores)];
  datalistGoleadores.innerHTML = jugadores.map(j => `<option value="${j}">`).join("");
}
campos.equipo1.addEventListener("input", actualizarDatalistGoleadores);
campos.equipo2.addEventListener("input", actualizarDatalistGoleadores);

/* ---------- BLOQUES DINÁMICOS PARA MERCADOS AVANZADOS (CREACIÓN AUTOMÁTICA SI NO EXISTEN) ---------- */
function ensureSection(id, html) {
  let section = document.getElementById(id);
  if (!section) {
    section = document.createElement("div");
    section.id = id;
    section.style.marginTop = "20px";
    section.style.display = "none";
    section.innerHTML = html || "";
    // Encuentra el último mercado para insertar después
    const btnCrear = document.getElementById("btnCrear");
    if (btnCrear && btnCrear.parentNode) {
      btnCrear.parentNode.insertBefore(section, btnCrear);
    } else {
      document.body.appendChild(section);
    }
  }
  return section;
}

/* ------ TARJETAS AVANZADO ------ */
ensureSection("tarjetas-section", `
  <h3>Cuotas Tarjetas</h3>
  <div id="tarjetas-tabs" class="tarjetas-tabs"></div>
  <div id="tarjetas-subtabs" class="tarjetas-subtabs"></div>
  <div id="tarjetas-tables"></div>
`);

/* ------ CORNERS AVANZADO ------ */
ensureSection("corners-section", `
  <h3>Cuotas Corners</h3>
  <div id="corners-tabs" class="tarjetas-tabs"></div>
  <div id="corners-subtabs" class="tarjetas-subtabs"></div>
  <div id="corners-tables"></div>
`);

/* ------ DOBLE OPORTUNIDAD ------ */
ensureSection("doble-oportunidad-section");

/* ------ AMBOS MARCAN ------ */
ensureSection("ambos-marcan-section");

/* ------ GOLES IMPAR/PAR ------ */
ensureSection("goles-imparpar-section");

/* ------ MANEJO DE MOSTRAR/OCULTAR LOS MERCADOS ------ */
function mostrarMercadosFutbol() {
  document.getElementById("tarjetas-section").style.display = "block";
  document.getElementById("corners-section").style.display = "block";
  document.getElementById("doble-oportunidad-section").style.display = "block";
  document.getElementById("ambos-marcan-section").style.display = "block";
  document.getElementById("goles-imparpar-section").style.display = "block";
}
function ocultarMercadosFutbol() {
  document.getElementById("tarjetas-section").style.display = "none";
  document.getElementById("corners-section").style.display = "none";
  document.getElementById("doble-oportunidad-section").style.display = "none";
  document.getElementById("ambos-marcan-section").style.display = "none";
  document.getElementById("goles-imparpar-section").style.display = "none";
}

/* --- CAMBIO DE DEPORTE: MOSTRAR/OCULTAR MERCADOS --- */
campos.deporte.addEventListener("change", () => {
  const dep = campos.deporte.value;

  Object.keys(campos).forEach(key => {
    if (key !== "deporte") campos[key].value = "";
  });

  if (ligaDatalist) {
    ligaDatalist.innerHTML = "";
    (window.ligasPorDeporte?.[dep] || []).forEach(l => {
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

  // Nacionalidades
  if (dep === "tenis") {
    if (wrapperNac1) wrapperNac1.style.display = "block";
    if (wrapperNac2) wrapperNac2.style.display = "block";
  } else {
    if (wrapperNac1) wrapperNac1.style.display = "none";
    if (wrapperNac2) wrapperNac2.style.display = "none";
    const sel1 = document.getElementById("nacionalidad1");
    const sel2 = document.getElementById("nacionalidad2");
    if (sel1) sel1.value = "";
    if (sel2) sel2.value = "";
  }

  if (goleadoresSection) {
    goleadoresSection.style.display = (dep === "futbol") ? "block" : "none";
    if (dep !== "futbol") {
      goleadores.length = 0;
      renderGoleadores();
    }
  }

  // Mostrar/ocultar mercados avanzados
  if (dep === "futbol") {
    mostrarMercadosFutbol();
    renderTarjetasTabs();
    renderCornersTabs();
    renderDobleOportunidadSection();
    renderAmbosMarcanSection();
    renderGolesImparParSection();
  } else {
    ocultarMercadosFutbol();
    window.tarjetasCuotas = {};
    window.cornersCuotas = {};
  }
});

/* 4.2  Al cambiar LIGA → llenar lista de equipos/jugadores */
if (campos.liga && equiposDatalist) {
  campos.liga.addEventListener("input", () => {
    const liga = campos.liga.value.trim();
    equiposDatalist.innerHTML = "";
    (window.equiposPorLiga?.[liga] || []).forEach(eq => {
      const opt = document.createElement("option");
      opt.value = eq;
      equiposDatalist.appendChild(opt);
    });
  });
}

/* 5️⃣  Invertir Equipos (botón ⮃) ------------------------------------------------ */
const btnInvertir = document.getElementById("invertirEquipos");
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

/* ---------- TARJETAS AVANZADO ------------- */
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
const TARJETAS_FILAS = [0,1,2,3,4,5,6,7,8,9,10];

window.tarjetasCuotas = {};

function renderTarjetasTabs() {
  const $tabs = document.getElementById("tarjetas-tabs");
  const $subtabs = document.getElementById("tarjetas-subtabs");
  const $tables = document.getElementById("tarjetas-tables");
  if (!$tabs || !$subtabs || !$tables) return;

  if (!window.tarjetasTabSel) window.tarjetasTabSel = 'primera';
  if (!window.tarjetasSubtabSel) window.tarjetasSubtabSel = 'equipo1';

  $tabs.innerHTML = TARJETAS_SEGMENTOS.map(seg =>
    `<button type="button" class="${window.tarjetasTabSel === seg.id ? "active" : ""}" data-tab="${seg.id}">${seg.label}</button>`
  ).join('');
  $subtabs.innerHTML = TARJETAS_EQUIPOS.map(eq =>
    `<button type="button" class="${window.tarjetasSubtabSel === eq.id ? "active" : ""}" data-subtab="${eq.id}">${eq.label}</button>`
  ).join('');

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
    html += `<tr><td>${n === 0 ? '0 tarjetas' : `${n} tarjeta${n>1?'s':''}`}</td>`;
    TARJETAS_COLUMNAS.forEach(col => {
      const valor = datos[n][col.id] ?? '';
      const disabled = (n === 0 && col.id === "menos") ? "disabled style='background:#eee;pointer-events:none;opacity:.6;'" : "";
      html += `<td>
        <input type="number" min="1.01" step="0.01" 
          data-n="${n}" data-col="${col.id}"
          value="${valor !== undefined ? valor : ''}" 
          placeholder="-" ${disabled} />
      </td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;

  $tables.innerHTML = html;

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

/* ---------- CORNERS AVANZADO ------------- */
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
const CORNERS_FILAS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];

window.cornersCuotas = {};

function renderCornersTabs() {
  const $tabs = document.getElementById("corners-tabs");
  const $subtabs = document.getElementById("corners-subtabs");
  const $tables = document.getElementById("corners-tables");
  if (!$tabs || !$subtabs || !$tables) return;

  if (!window.cornersTabSel) window.cornersTabSel = 'primera';
  if (!window.cornersSubtabSel) window.cornersSubtabSel = 'equipo1';

  $tabs.innerHTML = CORNERS_SEGMENTOS.map(seg =>
    `<button type="button" class="${window.cornersTabSel === seg.id ? "active" : ""}" data-tab="${seg.id}">${seg.label}</button>`
  ).join('');
  $subtabs.innerHTML = CORNERS_EQUIPOS.map(eq =>
    `<button type="button" class="${window.cornersSubtabSel === eq.id ? "active" : ""}" data-subtab="${eq.id}">${eq.label}</button>`
  ).join('');

  if (!window.cornersCuotas[window.cornersTabSel]) window.cornersCuotas[window.cornersTabSel] = {};
  if (!window.cornersCuotas[window.cornersTabSel][window.cornersSubtabSel]) {
    window.cornersCuotas[window.cornersTabSel][window.cornersSubtabSel] = {};
    CORNERS_FILAS.forEach(n => {
      window.cornersCuotas[window.cornersTabSel][window.cornersSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
    });
  }
  const datos = window.cornersCuotas[window.cornersTabSel][window.cornersSubtabSel];

  let html = `<table class="tarjetas-table"><thead><tr><th></th>`;
  CORNERS_COLUMNAS.forEach(col => html += `<th>${col.label}</th>`);
  html += `</tr></thead><tbody>`;
  CORNERS_FILAS.forEach(n => {
    html += `<tr><td>${n === 1 ? '1 córner' : `${n} córner${n>1?'s':''}`}</td>`;
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

  $tables.innerHTML = html;

  $tabs.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      window.cornersTabSel = btn.dataset.tab;
      renderCornersTabs();
    };
  });
  $subtabs.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      window.cornersSubtabSel = btn.dataset.subtab;
      renderCornersTabs();
    };
  });

  $tables.querySelectorAll("input[type=number]").forEach(input => {
    input.addEventListener("input", () => {
      const n = input.getAttribute("data-n");
      const col = input.getAttribute("data-col");
      let v = input.value;
      if (!window.cornersCuotas[window.cornersTabSel][window.cornersSubtabSel][n])
        window.cornersCuotas[window.cornersTabSel][window.cornersSubtabSel][n] = { mas:'', exactamente:'', menos:'' };
      window.cornersCuotas[window.cornersTabSel][window.cornersSubtabSel][n][col] = v;
    });
  });
}

/* ---------- DOBLE OPORTUNIDAD ------------- */
const DOBLE_OPORTUNIDAD_OPCIONES = [
  { id: "1X", label: "1X (Gana equipo 1 o Empate)" },
  { id: "12", label: "12 (Gana equipo 1 o equipo 2)" },
  { id: "X2", label: "X2 (Empate o gana equipo 2)" }
];

window.dobleOportunidadCuotas = { "1X": "", "12": "", "X2": "" };

function renderDobleOportunidadSection() {
  let section = document.getElementById("doble-oportunidad-section");
  if (!section) return; // Ya se creó arriba
  section.innerHTML = `
    <h3>Cuotas Doble Oportunidad</h3>
    <table class="doble-oportunidad-table">
      <thead>
        <tr>
          <th>Opción</th>
          <th>Cuota</th>
        </tr>
      </thead>
      <tbody>
        ${DOBLE_OPORTUNIDAD_OPCIONES.map(opt => `
          <tr>
            <td>${opt.label}</td>
            <td>
              <input type="number" min="1.01" step="0.01"
                id="cuota-doble-${opt.id}"
                data-opcion="${opt.id}"
                value="${window.dobleOportunidadCuotas[opt.id] || ''}"
                placeholder="-"
              />
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  DOBLE_OPORTUNIDAD_OPCIONES.forEach(opt => {
    const input = document.getElementById(`cuota-doble-${opt.id}`);
    if (input) {
      input.oninput = () => {
        window.dobleOportunidadCuotas[opt.id] = input.value;
      };
    }
  });
}

/* ---------- AMBOS MARCAN ------------- */
const AMBOS_MARCAN_FILAS = [
  { id: "encuentro", label: "Encuentro" },
  { id: "primera", label: "1ª Mitad" },
  { id: "segunda", label: "2ª Mitad" }
];
const AMBOS_MARCAN_COLUMNAS = [
  { id: "si", label: "Sí" },
  { id: "no", label: "No" }
];

window.ambosMarcanCuotas = {
  encuentro: { si: "", no: "" },
  primera: { si: "", no: "" },
  segunda: { si: "", no: "" }
};

function renderAmbosMarcanSection() {
  let section = document.getElementById("ambos-marcan-section");
  if (!section) return;
  let html = `
    <h3>Cuotas Ambos Marcan</h3>
    <table class="ambos-marcan-table">
      <thead>
        <tr>
          <th></th>
          ${AMBOS_MARCAN_COLUMNAS.map(col=>`<th>${col.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${AMBOS_MARCAN_FILAS.map(fila => `
          <tr>
            <td>${fila.label}</td>
            ${AMBOS_MARCAN_COLUMNAS.map(col => `
              <td>
                <input type="number" min="1.01" step="0.01"
                  id="cuota-ambos-${fila.id}-${col.id}"
                  data-fila="${fila.id}" data-col="${col.id}"
                  value="${window.ambosMarcanCuotas[fila.id][col.id] || ''}"
                  placeholder="-"
                />
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  section.innerHTML = html;
  AMBOS_MARCAN_FILAS.forEach(fila => {
    AMBOS_MARCAN_COLUMNAS.forEach(col => {
      const input = document.getElementById(`cuota-ambos-${fila.id}-${col.id}`);
      if (input) {
        input.oninput = () => {
          window.ambosMarcanCuotas[fila.id][col.id] = input.value;
        };
      }
    });
  });
}

/* ---------- GOLES IMPAR/PAR ------------- */
const GOLES_IMPARPAR_FILAS = [
  { id: "encuentro", label: "Encuentro" },
  { id: "primera", label: "1ª Mitad" },
  { id: "segunda", label: "2ª Mitad" }
];
const GOLES_IMPARPAR_COLUMNAS = [
  { id: "impar", label: "Impar" },
  { id: "par", label: "Par" }
];

window.golesImparParCuotas = {
  encuentro: { impar: "", par: "" },
  primera: { impar: "", par: "" },
  segunda: { impar: "", par: "" }
};

function renderGolesImparParSection() {
  let section = document.getElementById("goles-imparpar-section");
  if (!section) return;
  let html = `
    <h3>Cuotas Goles Impar/Par</h3>
    <table class="goles-imparpar-table">
      <thead>
        <tr>
          <th></th>
          ${GOLES_IMPARPAR_COLUMNAS.map(col=>`<th>${col.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${GOLES_IMPARPAR_FILAS.map(fila => `
          <tr>
            <td>${fila.label}</td>
            ${GOLES_IMPARPAR_COLUMNAS.map(col => `
              <td>
                <input type="number" min="1.01" step="0.01"
                  id="cuota-imparpar-${fila.id}-${col.id}"
                  data-fila="${fila.id}" data-col="${col.id}"
                  value="${window.golesImparParCuotas[fila.id][col.id] || ''}"
                  placeholder="-"
                />
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  section.innerHTML = html;
  GOLES_IMPARPAR_FILAS.forEach(fila => {
    GOLES_IMPARPAR_COLUMNAS.forEach(col => {
      const input = document.getElementById(`cuota-imparpar-${fila.id}-${col.id}`);
      if (input) {
        input.oninput = () => {
          window.golesImparParCuotas[fila.id][col.id] = input.value;
        };
      }
    });
  });
}