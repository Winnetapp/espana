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

// --- Mostrar/ocultar nacionalidades y cuotas según deporte ---
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
    // Limpiar selects de nacionalidad si oculto
    const sel1 = $("nacionalidad1");
    const sel2 = $("nacionalidad2");
    if (sel1) sel1.value = "";
    if (sel2) sel2.value = "";
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
  });
}

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

  // Validar nacionalidades solo si están visibles
  const nac1 = $("nacionalidad1")?.value;
  const nac2 = $("nacionalidad2")?.value;
  if (wrapperNac1 && wrapperNac1.style.display !== "none" && !nac1) errores.push("La nacionalidad del equipo/jugador 1 es obligatoria.");
  if (wrapperNac2 && wrapperNac2.style.display !== "none" && !nac2) errores.push("La nacionalidad del equipo/jugador 2 es obligatoria.");

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

  return {
    deporte: dep,
    liga,
    equipo1: eq1,
    nacionalidad1,
    equipo2: eq2,
    nacionalidad2,
    fecha,
    hora,
    mercados:{ resultado:{ nombre:"Resultado final", opciones } }
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
  // Comprobar autenticación antes de permitir crear el partido
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
    // Primero creamos el partido y obtenemos el id del documento
    const docRef = await addDoc(collection(db, "partidos"), partido);
    // Luego actualizamos ese documento para añadir el campo partidoId = docRef.id
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

  } catch (error) {
    mostrarSpinner(false);
    msg.style.color = "red";
    msg.textContent = "Error guardando partido: " + error.message;
  }
}

/*  🔟  Evento submit ----------------------------------------------------- */
const form = $("formCrearPartido");

// Proteger el panel: solo accesible para usuarios autenticados
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // No autenticado, redirigir al login
    window.location.href = "login.html";
    return;
  }

  // (Opcional: Si quieres comprobar admin, obtén los claims aquí)
  // const token = await user.getIdTokenResult();
  // if (!token.claims.admin) {
  //   window.location.href = "no-admin.html";
  //   return;
  // }

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      guardarPartido();
    });
  }
});
