// Importa las funciones necesarias de Firebase (asegúrate de que tu entorno soporte módulos)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

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

// Elementos DOM
const matchSelect = document.getElementById("matchSelect");
const resultadoForm = document.getElementById("resultadoForm");
const preguntasWrap = document.getElementById("preguntasDinamicas");
const homeScoreInput = document.getElementById("homeScore");
const awayScoreInput = document.getElementById("awayScore");
const estadoGuardado = document.getElementById("estadoGuardado");

let partidoSeleccionadoData = null;
let partidoSeleccionadoId = null;

// Carga partidos para el select
async function cargarPartidos() {
  try {
    const querySnapshot = await getDocs(collection(db, "partidos"));
    console.log("Partidos encontrados:", querySnapshot.size);

    matchSelect.innerHTML = `<option value="" disabled selected>— Elige uno —</option>`;

    if (querySnapshot.empty) {
      console.log("No hay partidos en Firestore.");
      const option = document.createElement("option");
      option.textContent = "No hay partidos disponibles";
      option.disabled = true;
      matchSelect.appendChild(option);
      return;
    }

    querySnapshot.forEach((docu) => {
      const data = docu.data();
      console.log("Partido:", data);

      const option = document.createElement("option");
      option.value = docu.id;
      option.textContent = `${data.equipo1} vs ${data.equipo2} - ${data.fecha} ${data.hora}`;
      matchSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error cargando partidos:", error);
    const option = document.createElement("option");
    option.textContent = "Error cargando partidos";
    option.disabled = true;
    matchSelect.appendChild(option);
  }
}


// Construye el formulario dinámico según mercados y deporte
function construirFormularioDesdeMercados(partidoSeleccionadoData) {
  preguntasWrap.innerHTML = "";

  console.log("Datos partido:", partidoSeleccionadoData);

  const mercados = partidoSeleccionadoData.mercados || {};
  const deporteRaw = partidoSeleccionadoData.deporte || "";
  const deporte = deporteRaw.toLowerCase();

  console.log("Deporte detectado:", deporte);
  console.log("Mercados detectados:", mercados);

  if (mercados.resultado) {
    const div = document.createElement("div");
    div.className = "pregunta-item";

    const opcionesOriginales = mercados.resultado.opciones || [];

    console.log("Opciones originales mercado resultado:", opcionesOriginales);

    let opcionesFiltradas = [];

    if (deporte === "tenis" || deporte === "baloncesto") {
      // Sin empate para tenis y baloncesto
      opcionesFiltradas = opcionesOriginales.filter(
        (op) => op.valor === "1" || op.valor === "2"
      );
    } else {
      opcionesFiltradas = opcionesOriginales;
    }

    console.log("Opciones filtradas:", opcionesFiltradas);

    if (opcionesFiltradas.length === 0) {
      preguntasWrap.innerHTML = "<p>No hay opciones disponibles para el mercado resultado.</p>";
      return;
    }

    let optionsHtml = opcionesFiltradas
      .map((op) => `<option value="${op.valor}">${op.nombre}</option>`)
      .join("");

    div.innerHTML = `
      <label for="resultadoSelect">¿Quién ganó el partido?</label>
      <select id="resultadoSelect" required>
        <option value="" disabled selected>Elige una opción</option>
        ${optionsHtml}
      </select>
    `;

    preguntasWrap.appendChild(div);
  } else {
    preguntasWrap.innerHTML = "<p>No hay mercado de resultado para este partido.</p>";
  }
}

// Evento al seleccionar partido
matchSelect.addEventListener("change", async (e) => {
  partidoSeleccionadoId = e.target.value;
  if (!partidoSeleccionadoId) {
    resultadoForm.classList.add("hidden");
    preguntasWrap.innerHTML = "";
    return;
  }

  try {
    const partidoDoc = await getDoc(doc(db, "partidos", partidoSeleccionadoId));
    if (!partidoDoc.exists()) {
      alert("Partido no encontrado");
      resultadoForm.classList.add("hidden");
      preguntasWrap.innerHTML = "";
      return;
    }

    partidoSeleccionadoData = partidoDoc.data();

    // Limpia inputs de goles al cambiar partido
    if (homeScoreInput) homeScoreInput.value = "";
    if (awayScoreInput) awayScoreInput.value = "";

    construirFormularioDesdeMercados(partidoSeleccionadoData);

    resultadoForm.classList.remove("hidden");
    if (estadoGuardado) estadoGuardado.textContent = "";
  } catch (error) {
    console.error("Error cargando partido seleccionado:", error);
    if (estadoGuardado) estadoGuardado.textContent = "Error cargando partido seleccionado.";
  }
});

// Guardar resultados al enviar formulario
resultadoForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!partidoSeleccionadoId || !partidoSeleccionadoData) {
    alert("Selecciona un partido válido primero.");
    return;
  }

  const homeScore = Number(homeScoreInput?.value);
  const awayScore = Number(awayScoreInput?.value);
  const resultadoSelect = document.getElementById("resultadoSelect");

  if (
    homeScore < 0 ||
    awayScore < 0 ||
    !resultadoSelect ||
    resultadoSelect.value === ""
  ) {
    alert("Rellena todos los campos correctamente.");
    return;
  }

  // Construir el resultado a guardar
  const resultadoGuardado = {
    goles_local: homeScore,
    goles_visitante: awayScore,
    ganador: resultadoSelect.value,
  };

  try {
    await updateDoc(doc(db, "partidos", partidoSeleccionadoId), {
      resultado: resultadoGuardado,
    });

    if (estadoGuardado) estadoGuardado.textContent = "Resultados guardados correctamente.";
  } catch (error) {
    console.error("Error guardando resultado:", error);
    if (estadoGuardado) estadoGuardado.textContent = "Error al guardar los resultados.";
  }
});

// Inicializar (cuando el DOM esté listo)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cargarPartidos);
} else {
  cargarPartidos();
}
