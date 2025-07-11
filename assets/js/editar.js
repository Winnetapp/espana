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

const nacionalidades = [
  "España","Argentina","Brasil","Francia","Alemania","Italia","Portugal","Inglaterra",
  "México","Colombia","Uruguay","Chile","Estados Unidos","Canadá","Australia","Japón","Corea del Sur"
];

document.addEventListener("DOMContentLoaded", function () {
  // Firebase
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
  });

  // Cambiar liga: actualizar lista de equipos
  ligaInput.addEventListener("input", function() {
    actualizarEquiposDatalist(this.value);
    equipo1Input.value = "";
    equipo2Input.value = "";
  });

  // Invertir equipos
  if (invertirBtn && equipo1Input && equipo2Input) {
    invertirBtn.addEventListener("click", function(e) {
      e.preventDefault();
      [equipo1Input.value, equipo2Input.value] = [equipo2Input.value, equipo1Input.value];
    });
  }

  // Renderizar SOLO cuotas de mercado (editable)
  function renderCuotasMercado(opciones = []) {
    mercadoCuotasContainer.innerHTML = "";
    if (!Array.isArray(opciones)) return;

    opciones.forEach((op, i) => {
      const div = document.createElement("div");
      div.className = "opcion-mercado";

      // Cuota (editable)
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

  // Al seleccionar partido, rellenar formulario y autocompletar ligas/equipos
  selectPartido.addEventListener("change", async function () {
    const partidoId = this.value;
    if (!editForm) return;
    if (!partidoId) {
      editForm.style.display = "none";
      showMessage("");
      return;
    }
    try {
      const doc = await db.collection("partidos").doc(partidoId).get();
      if (!doc.exists) throw new Error("Partido no encontrado");
      const data = doc.data();

      // Deporte y autocompletar ligas
      deporteSelect.value = data.deporte || "";
      actualizarLigasDatalist(deporteSelect.value);

      // Liga y autocompletar equipos
      ligaInput.value = data.liga || "";
      actualizarEquiposDatalist(ligaInput.value);

      // Equipos
      equipo1Input.value = data.equipo1 ?? data.homeTeam ?? "";
      equipo2Input.value = data.equipo2 ?? data.awayTeam ?? "";

      // Nacionalidades solo si es tenis
      if (data.deporte === "tenis") {
        nacionalidadesWrapper.style.display = "flex";
        nacionalidad1Input.value = data.nacionalidad1 || "";
        nacionalidad2Input.value = data.nacionalidad2 || "";
      } else {
        nacionalidadesWrapper.style.display = "none";
        nacionalidad1Input.value = "";
        nacionalidad2Input.value = "";
      }

      // Otros campos
      document.getElementById("fecha").value = data.fecha ?? "";
      document.getElementById("hora").value = data.hora ?? "";

      // Mercado: resultado.opciones SOLO cuotas
      const opciones = data.mercados?.resultado?.opciones || [];
      renderCuotasMercado(opciones);

      editForm.style.display = "block";
      showMessage("");
    } catch (err) {
      showMessage("Error cargando partido: " + err.message, true);
      editForm.style.display = "none";
    }
  });

  // Guardar cambios
  if (editForm) {
    editForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const partidoId = selectPartido.value;
      if (!partidoId) {
        showMessage("Selecciona un partido", true);
        return;
      }
      // Recoger SOLO cuotas del mercado
      const opciones = [];
      const cuotaInputs = mercadoCuotasContainer.querySelectorAll("input[type='number']");
      cuotaInputs.forEach((input, i) => {
        const cuota = +(input.value || 0);
        // Mantener el nombre/valor original si existe
        const label = input.previousSibling;
        let valor = label && label.innerText.includes('Cuota ') ? label.innerText.split('Cuota ')[1].replace(':','') : (i+1).toString();
        opciones.push({ cuota, valor });
      });

      // Recuperar nombre y valor originales si existen
      const partidoDoc = await db.collection("partidos").doc(partidoId).get();
      const data = partidoDoc.data();
      const oldOpciones = data?.mercados?.resultado?.opciones || [];
      opciones.forEach((op, i) => {
        if (oldOpciones[i]) {
          op.nombre = oldOpciones[i].nombre || '';
          op.valor = oldOpciones[i].valor || op.valor;
        }
      });

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
          }
        }
      };

      // Añadir nacionalidad1/nacionalidad2 solo si es tenis
      if (deporteSelect.value === "tenis") {
        formData.nacionalidad1 = nacionalidad1Input.value;
        formData.nacionalidad2 = nacionalidad2Input.value;
      }

      try {
        await db.collection("partidos").doc(partidoId).update(formData);
        showMessage("Partido editado correctamente");
      } catch (err) {
        showMessage("Error guardando cambios: " + err.message, true);
      }
    });
  }

  // Inicialización
  cargarPartidos();
});
