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

  if (goleadoresSection) {
    goleadoresSection.style.display = (dep === "futbol") ? "block" : "none";
    if (dep !== "futbol") {
      goleadores.length = 0;
      renderGoleadores();
    }
  }

  // --- Tarjetas ---
  const tarjetasSection = document.getElementById('tarjetas-section');
  if (tarjetasSection) {
    tarjetasSection.style.display = (dep === "futbol" ? "block" : "none");
    if (dep !== "futbol") {
      window.tarjetasCuotas = {};
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

  // --- Corners ---
  const cornersSection = document.getElementById('corners-section');
  if (cornersSection) {
    cornersSection.style.display = (dep === "futbol" ? "block" : "none");
    if (dep !== "futbol") {
      window.cornersCuotas = {};
      const tabs = document.getElementById("corners-tabs");
      const subtabs = document.getElementById("corners-subtabs");
      const tables = document.getElementById("corners-tables");
      if (tabs) tabs.innerHTML = "";
      if (subtabs) subtabs.innerHTML = "";
      if (tables) tables.innerHTML = "";
    } else {
      renderCornersTabs();
    }
  }

  // --- Doble Oportunidad ---
  renderDobleOportunidadSection();
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

// ---------- DOBLE OPORTUNIDAD -------------
const DOBLE_OPORTUNIDAD_OPCIONES = [
  { id: "1X", label: "1X (Gana equipo 1 o Empate)" },
  { id: "12", label: "12 (Gana equipo 1 o equipo 2)" },
  { id: "X2", label: "X2 (Empate o gana equipo 2)" }
];

window.dobleOportunidadCuotas = { "1X": "", "12": "", "X2": "" };

// Renderizar bloque HTML para Doble Oportunidad
function renderDobleOportunidadSection() {
  let section = document.getElementById("doble-oportunidad-section");
  if (!section) {
    section = document.createElement("div");
    section.id = "doble-oportunidad-section";
    section.style.marginTop = "20px";
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
    // Inserta justo debajo de las cuotas principales
    const cuotasPrincipal = document.getElementById("cuotaX")?.parentNode;
    if (cuotasPrincipal) cuotasPrincipal.parentNode.insertBefore(section, cuotasPrincipal.nextSibling);
    else document.body.appendChild(section);
  }

  // Actualizar el valor global al cambiar input
  DOBLE_OPORTUNIDAD_OPCIONES.forEach(opt => {
    const input = document.getElementById(`cuota-doble-${opt.id}`);
    if (input) {
      input.oninput = () => {
        window.dobleOportunidadCuotas[opt.id] = input.value;
      };
    }
  });

  // Mostrar/ocultar según el deporte
  const dep = campos.deporte.value;
  section.style.display = (dep === "futbol") ? "block" : "none";
}

// Llama a renderDobleOportunidadSection cuando cambie el deporte
campos.deporte.addEventListener("change", renderDobleOportunidadSection);

// También al cargar la página
document.addEventListener("DOMContentLoaded", renderDobleOportunidadSection);

function validarDobleOportunidad() {
  if (campos.deporte.value === "futbol") {
    for (const opt of DOBLE_OPORTUNIDAD_OPCIONES) {
      const v = (window.dobleOportunidadCuotas[opt.id] || "").trim();
      if (v !== "" && (isNaN(parseFloat(v)) || parseFloat(v) <= 1)) {
        return `Cuota de Doble Oportunidad inválida para "${opt.label}": debe ser > 1.`;
      }
    }
  }
  return null;
}

// ---------- TARJETAS -------------
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
      // Bloquear el input si es fila 0 y columna "menos"
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

// ---------- CORNERS AVANZADO -------------
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
// Filas de 4 a 17 corners
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

// Al cargar la página, añade el bloque HTML para corners después de tarjetas (si no existe)
document.addEventListener("DOMContentLoaded", function() {
  const tarjetasSection = document.getElementById('tarjetas-section');
  if (tarjetasSection && !document.getElementById('corners-section')) {
    const cornersSection = document.createElement('div');
    cornersSection.id = 'corners-section';
    cornersSection.style.marginTop = "20px";
    cornersSection.innerHTML = `
      <h3>Cuotas Corners</h3>
      <div id="corners-tabs" class="tarjetas-tabs"></div>
      <div id="corners-subtabs" class="tarjetas-subtabs"></div>
      <div id="corners-tables"></div>
    `;
    tarjetasSection.parentNode.insertBefore(cornersSection, tarjetasSection.nextSibling);
    cornersSection.style.display = "none";
  }
});

/* --- Validar datos (igual que antes, puedes añadir validaciones para corners si quieres) --- */

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

  // ----> Añadir mercado de Doble Oportunidad si alguna cuota está rellena
  let algunaCuotaDoble = false;
  const opcionesDoble = [];
  DOBLE_OPORTUNIDAD_OPCIONES.forEach(opt => {
    const v = (window.dobleOportunidadCuotas[opt.id] || "").trim();
    if (v !== "") {
      algunaCuotaDoble = true;
      opcionesDoble.push({
        nombre: opt.label,
        valor: opt.id,
        cuota: parseFloat(v)
      });
    }
  });
  if (algunaCuotaDoble) {
    mercados.dobleOportunidad = {
      nombre: "Doble Oportunidad",
      opciones: opcionesDoble
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

  // ----> Añadir mercado de corners avanzado solo si alguna cuota está rellena
  let cornersObj = {};
  let algunCorner = false;
  if (dep === "futbol" && window.cornersCuotas) {
    for (const segmento of CORNERS_SEGMENTOS) {
      cornersObj[segmento.id] = {};
      for (const equipo of CORNERS_EQUIPOS) {
        cornersObj[segmento.id][equipo.id] = {};
        for (const n of CORNERS_FILAS) {
          cornersObj[segmento.id][equipo.id][n] = {};
          for (const col of CORNERS_COLUMNAS) {
            const v = (((window.cornersCuotas?.[segmento.id]?.[equipo.id]?.[n]?.[col.id]) || '') + '').trim();
            if (v !== "") algunCorner = true;
            cornersObj[segmento.id][equipo.id][n][col.id] = v === "" ? null : parseFloat(v);
          }
        }
      }
    }
    if (algunCorner) {
      mercados.corners = {
        nombre: "Corners",
        opciones: cornersObj
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
    // Reset tarjetas/corners avanzadas
    if (window.tarjetasCuotas) window.tarjetasCuotas = {};
    if (window.cornersCuotas) window.cornersCuotas = {};
    if (typeof renderTarjetasTabs === "function") renderTarjetasTabs();
    if (typeof renderCornersTabs === "function") renderCornersTabs();

    // Reset Doble Oportunidad
    window.dobleOportunidadCuotas = { "1X": "", "12": "", "X2": "" };
    DOBLE_OPORTUNIDAD_OPCIONES.forEach(opt => {
      const input = document.getElementById(`cuota-doble-${opt.id}`);
      if (input) input.value = "";
    });

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

  // Validar Doble Oportunidad
  const errDoble = validarDobleOportunidad();
  if (errDoble) errores.push(errDoble);

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

  // Validar corners avanzadas (tablas)
  if (dep === "futbol" && window.cornersCuotas) {
    for (const segmento of CORNERS_SEGMENTOS) {
      for (const equipo of CORNERS_EQUIPOS) {
        for (const n of CORNERS_FILAS) {
          for (const col of CORNERS_COLUMNAS) {
            const v = (((window.cornersCuotas?.[segmento.id]?.[equipo.id]?.[n]?.[col.id]) || '') + '').trim();
            if (v !== "" && (isNaN(parseFloat(v)) || parseFloat(v) <= 1)) {
              errores.push(`Cuota de corners inválida en ${segmento.label} - ${equipo.label} - ${n} córner(s) - ${col.label}: debe ser > 1`);
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
