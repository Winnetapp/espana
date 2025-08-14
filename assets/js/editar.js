// === TODO el código dentro de DOMContentLoaded ===
document.addEventListener("DOMContentLoaded", function () {
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
  // --- CONFIGURACIÓN TARJETAS Y CORNERS ---
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
  let tarjetasOpciones = {};

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
  const CORNERS_FILAS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
  let cornersOpciones = {};

  // --- DOM ---
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

  // --- FIREBASE ---
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

  // --- UTILS ---
  function slugify(text) {
    return text
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function renderTarjetasEditor() {
    const containerId = "tarjetasAdminContainer";
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.style.marginTop = "20px";
      const goleadoresDiv = document.getElementById("goleadoresContainer");
      goleadoresDiv.parentNode.insertBefore(container, goleadoresDiv.nextSibling);
    }
    container.innerHTML = `<h3>Mercado Tarjetas</h3>
      <div class="tarjetas-tabs" id="edit-tarjetas-tabs"></div>
      <div class="tarjetas-subtabs" id="edit-tarjetas-subtabs"></div>
      <div id="edit-tarjetas-table"></div>
    `;

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

    // Normaliza antes de mostrar
    if (typeof normalizarCornersOpciones === 'function') normalizarCornersOpciones();

    const datos = cornersOpciones[window.editCornersTabSel][window.editCornersSubtabSel];

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

    // Eventos para tabs y subtabs
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
        if (!datos[n]) datos[n] = { mas: '', exactamente: '', menos: '' };
        datos[n][col] = v;
      });
    });
  }

  // --- NORMALIZADOR CORNERS ---
  function normalizarCornersOpciones() {
    if (!cornersOpciones) cornersOpciones = {};
    CORNERS_SEGMENTOS.forEach(seg => {
      const segId = seg.id;
      if (!cornersOpciones[segId]) cornersOpciones[segId] = {};
      CORNERS_EQUIPOS.forEach(eq => {
        const eqId = eq.id;
        if (!cornersOpciones[segId][eqId]) cornersOpciones[segId][eqId] = {};
        CORNERS_FILAS.forEach(n => {
          if (!cornersOpciones[segId][eqId][n] || typeof cornersOpciones[segId][eqId][n] !== "object")
            cornersOpciones[segId][eqId][n] = {};
          CORNERS_COLUMNAS.forEach(col => {
            if (typeof cornersOpciones[segId][eqId][n][col.id] === "undefined")
              cornersOpciones[segId][eqId][n][col.id] = '';
          });
        });
      });
    });
  }

  // --- JUGADORES DATALIST ---
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

  // --- NACIONALIDADES DATALIST ---
  if (nacionalidadesList && nacionalidadesList.children.length === 0) {
    nacionalidades.forEach(nac => {
      const option = document.createElement("option");
      option.value = nac;
      nacionalidadesList.appendChild(option);
    });
  }

  // --- MENSAJES ---
  function showMessage(msg, isError = false) {
    if (messageDiv) {
      messageDiv.textContent = msg;
      messageDiv.style.color = isError ? "red" : "green";
    }
  }

  // --- CARGAR PARTIDOS EN SELECT ---
  async function cargarPartidos() {
    try {
      selectPartido.innerHTML = '<option value="">-- Selecciona --</option>';
      const snapshot = await db.collection("partidos").get();
      // 1. Obtén todos los partidos en un array
      let partidos = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        partidos.push({
          id: doc.id,
          equipo1: data.equipo1 || data.homeTeam || "Equipo 1",
          equipo2: data.equipo2 || data.awayTeam || "Equipo 2",
          fecha: data.fecha || "",
          hora: data.hora || ""
        });
      });

      // 2. Ordena por fecha y hora (más recientes primero)
      partidos.sort((a, b) => {
        // Combina fecha y hora para comparar
        const aDate = new Date(`${a.fecha}T${a.hora || "00:00"}`);
        const bDate = new Date(`${b.fecha}T${b.hora || "00:00"}`);
        return bDate - aDate;
      });

      // 3. Llena el select con los partidos ordenados
      partidos.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.text = `${p.equipo1} vs ${p.equipo2} | ${p.fecha} ${p.hora}`;
        selectPartido.add(option);
      });
    } catch (err) {
      showMessage("Error cargando partidos: " + err.message, true);
    }
  }

  // --- DATALIST LIGAS Y EQUIPOS ---
  function actualizarLigasDatalist(deporte) {
    ligaDatalist.innerHTML = "";
    (ligasPorDeporte[deporte] || []).forEach(l => {
      const opt = document.createElement("option");
      opt.value = l;
      ligaDatalist.appendChild(opt);
    });
  }
  function actualizarEquiposDatalist(liga) {
    equiposDatalist.innerHTML = "";
    (equiposPorLiga[liga] || []).forEach(eq => {
      const opt = document.createElement("option");
      opt.value = eq;
      equiposDatalist.appendChild(opt);
    });
  }

  // --- NACIONALIDADES TENIS ---
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

  // --- MERCADO CUOTAS ---
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

  // --- GOLEADORES EDICIÓN ---
  let currentGoleadoresOpciones = [];
  function renderGoleadoresList(opciones = []) {
    currentGoleadoresOpciones = opciones;
    const listDiv = document.getElementById("goleadoresList");
    listDiv.innerHTML = "";

    opciones.forEach((op, i) => {
      const row = document.createElement("div");
      row.className = "goleador-row";
      const nombreIn = document.createElement("input");
      nombreIn.type = "text";
      nombreIn.value = op.nombre || "";
      nombreIn.placeholder = "Nombre jugador";
      nombreIn.className = "goleador-nombre";
      nombreIn.required = true;
      nombreIn.setAttribute("list", "jugadores-list");
      nombreIn.style.marginRight = "0.6em";
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
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.innerHTML = '<i class="fa fa-trash"></i>';
      delBtn.title = "Eliminar goleador";
      delBtn.className = "btn-del-goleador";
      delBtn.onclick = () => {
        currentGoleadoresOpciones.splice(i, 1);
        renderGoleadoresList(currentGoleadoresOpciones);
      };
      nombreIn.addEventListener("input", function() {
        op.nombre = nombreIn.value;
        op.valor = slugify(nombreIn.value);
      });
      op.valor = slugify(nombreIn.value);
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

  // --- RENDER TARJETAS Y CORNERS ---
  function mostrarTarjetasSiFutbol() {
    const deporte = deporteSelect.value;
    const containerId = "tarjetasAdminContainer";
    let container = document.getElementById(containerId);
    if (deporte === "futbol") {
      renderTarjetasEditor();
      if (container) container.style.display = "block";
    } else if (container) {
      container.style.display = "none";
    }
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
  function mostrarMercadosAvanzados() {
    mostrarTarjetasSiFutbol();
    mostrarCornersSiFutbol();
  }

  // --- CARGA DE PARTIDO EN FORMULARIO (y mercados avanzados) ---
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

  // --- GUARDAR PARTIDO ---
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
