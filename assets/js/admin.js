import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

initializeApp(firebaseConfig);
const db = getFirestore();

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
const previewContainer = $("previewContainer"); // NUEVO: contenedor previsualización

/* 3️⃣  Datos --------------------------------------------------------------------- */
const ligasPorDeporte = {
  futbol: ["La Liga","Premier League","Serie A","Bundesliga","Ligue 1","Champions League"],
  baloncesto: ["NBA","Euroliga"],
  tenis: ["ATP Madrid","Roland Garros"]
};

const equiposPorLiga = {
  "La Liga": [
    "Real Madrid","Barcelona","Atletico Madrid","Sevilla","Valencia",
    "Real Sociedad","Villarreal","Real Betis","Athletic Bilbao","Celta"
  ],
  "Premier League": [
    "Manchester City","Liverpool","Manchester United","Arsenal","Chelsea",
    "Tottenham","Newcastle United","Everton","Aston Villa","West Ham"
  ],
  "Serie A": [
    "Juventus","AC Milan","Inter Milan","Napoli","Roma",
    "Lazio","Atalanta","Fiorentina","Torino","Bologna"
  ],
  "Bundesliga": [
    "Bayern Munich","Borussia Dortmund","RB Leipzig","Bayer Leverkusen",
    "Eintracht Frankfurt","Wolfsburg","Mönchengladbach","Freiburg","Union Berlin"
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

/* 4️⃣  Autocompletado ------------------------------------------------------------ */
const ligaDatalist    = $("ligas-list");
const equiposDatalist = $("equipos-list");
const cuotaXInput     = campos.cuotaX;

/* 4.1  Al cambiar DEPORTE → llenar lista de ligas */
campos.deporte.addEventListener("change", () => {
  const dep = campos.deporte.value;
  
  Object.keys(campos).forEach(key => {
    if (key !== "deporte") campos[key].value = "";
  });

  ligaDatalist.innerHTML = "";
  (ligasPorDeporte[dep] || []).forEach(l => {
    const opt = document.createElement("option");
    opt.value = l;
    ligaDatalist.appendChild(opt);
  });

  equiposDatalist.innerHTML = "";

  if (dep === "tenis" || dep === "baloncesto") {
    cuotaXInput.style.display = "none";
    cuotaXInput.value = "";
  } else {
    cuotaXInput.style.display = "inline-block";
  }
});

/* 4.2  Al cambiar LIGA → llenar lista de equipos/jugadores */
campos.liga.addEventListener("input", () => {
  const liga = campos.liga.value.trim();
  equiposDatalist.innerHTML = "";

  (equiposPorLiga[liga] || []).forEach(eq => {
    const opt = document.createElement("option");
    opt.value = eq;
    equiposDatalist.appendChild(opt);
  });
});

/* 5️⃣  Invertir Equipos (botón ⮃) ------------------------------------------------ */
$("invertirEquipos").addEventListener("click", () => {
  [campos.equipo1.value, campos.equipo2.value] =
    [campos.equipo2.value, campos.equipo1.value];
  [campos.cuota1.value , campos.cuota2.value ] =
    [campos.cuota2.value , campos.cuota1.value ];
});

/* Validar datos */
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

  return errores;
}

/* Construir objeto partido */
function construirPartido() {
  const dep   = campos.deporte.value.trim();
  const liga  = campos.liga.value.trim();
  const eq1   = campos.equipo1.value.trim();
  const eq2   = campos.equipo2.value.trim();
  const fecha = campos.fecha.value;
  const hora  = campos.hora.value;

  const cuota1 = parseFloat(campos.cuota1.value);
  const cuota2 = parseFloat(campos.cuota2.value);
  const cuotaX = parseFloat(campos.cuotaX.value);

  const opciones = [
    {nombre:`Gana ${eq1}`, valor:"1", cuota:cuota1},
    {nombre:`Gana ${eq2}`, valor:"2", cuota:cuota2}
  ];
  if (dep!=="tenis"&&dep!=="baloncesto")
    opciones.splice(1,0,{nombre:"Empate", valor:"X", cuota:cuotaX});

  return {
    deporte: dep,
    liga,
    equipo1: eq1,
    equipo2: eq2,
    fecha,
    hora,
    mercados:{ resultado:{ nombre:"Resultado final", opciones } }
  };
}

/* NUEVO: Mostrar previsualización en previewContainer */
function mostrarPrevisualizacion(partido) {
  const opts = partido.mercados.resultado.opciones;
  previewContainer.innerHTML = `
    <h3>Resumen del partido a crear</h3>
    <p><strong>Deporte:</strong> ${partido.deporte}</p>
    <p><strong>Liga:</strong> ${partido.liga}</p>
    <p><strong>Equipos/Jugadores:</strong> ${partido.equipo1} vs ${partido.equipo2}</p>
    <p><strong>Fecha y hora:</strong> ${partido.fecha} ${partido.hora}</p>
    <p><strong>Cuotas:</strong></p>
    <ul>
      ${opts.map(o => `<li>${o.nombre}: ${o.cuota}</li>`).join("")}
    </ul>
  `;
}

/* NUEVO: Limpiar previsualización */
function limpiarPrevisualizacion() {
  previewContainer.innerHTML = "";
}

/* 6️⃣  Confirmar antes de enviar -------------------------------------------------- */
function mostrarModalConfirmacion(partido) {
  modalText.textContent = "¿Confirmas crear este partido?";
  modal.style.display = "block";
  mostrarPrevisualizacion(partido); // Mostramos previsualización justo antes del modal
}

/* 7️⃣  Guardar en Firebase ------------------------------------------------------- */
async function guardarPartido(partido) {
  try {
    await addDoc(collection(db, "partidos"), partido);
    alert("Partido creado correctamente.");
    limpiarPrevisualizacion();
    modal.style.display = "none";
    Object.values(campos).forEach(c => c.value = "");
  } catch (error) {
    alert("Error al guardar el partido: " + error.message);
  }
}

/* 8️⃣  Eventos botones modal ----------------------------------------------------- */
btnConfirm.addEventListener("click", async () => {
  const partido = construirPartido();
  await guardarPartido(partido);
});

btnCancel.addEventListener("click", () => {
  modal.style.display = "none";
  limpiarPrevisualizacion();
});

/* 9️⃣  Enviar formulario --------------------------------------------------------- */
$("formCrearPartido").addEventListener("submit", e => {
  e.preventDefault();
  const errores = validarDatos();
  if (errores.length > 0) {
    msg.innerHTML = errores.map(e => `<p>${e}</p>`).join("");
    return;
  }
  msg.innerHTML = "";
  const partido = construirPartido();
  mostrarModalConfirmacion(partido);
});
