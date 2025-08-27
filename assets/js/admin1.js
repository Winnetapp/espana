import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

// 1️⃣  Firebase ------------------------------------------------------------------
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
const estadoGuardado = document.getElementById("estadoGuardado");

let partidoSeleccionadoData = null;
let partidoSeleccionadoId = null;

// ...resto del código igual hasta cargarPartidos...

// Carga partidos para el select
async function cargarPartidos() {
  try {
    const querySnapshot = await getDocs(collection(db, "partidos"));
    matchSelect.innerHTML = `<option value="" disabled selected>— Elige uno —</option>`;

    if (querySnapshot.empty) {
      const option = document.createElement("option");
      option.textContent = "No hay partidos disponibles";
      option.disabled = true;
      matchSelect.appendChild(option);
      return;
    }

    // Recolectar partidos en array para ordenar
    const partidosArr = [];
    querySnapshot.forEach((docu) => {
      const data = docu.data();
      partidosArr.push({
        id: docu.id,
        ...data
      });
    });

    // Ordenar DESCENDENTE por fecha y hora (más reciente arriba)
    partidosArr.sort((a, b) => {
      try {
        const fechaA = new Date(`${a.fecha}T${a.hora || "00:00"}`);
        const fechaB = new Date(`${b.fecha}T${b.hora || "00:00"}`);
        return fechaB - fechaA; // invertido para descendente
      } catch {
        return 0;
      }
    });

    // Render partidos ordenados en el select (más reciente primero)
    partidosArr.forEach((partido) => {
      const option = document.createElement("option");
      option.value = partido.id;
      option.textContent = `${partido.equipo1} vs ${partido.equipo2} - ${partido.fecha} ${partido.hora}`;
      matchSelect.appendChild(option);
    });
  } catch (error) {
    const option = document.createElement("option");
    option.textContent = "Error cargando partidos";
    option.disabled = true;
    matchSelect.appendChild(option);
  }
}

// ...resto del código igual...

// ... resto del código igual ...
// Construye el formulario dinámico desde JS y mercados del partido
function construirFormularioDesdeMercados(partidoSeleccionadoData) {
  preguntasWrap.innerHTML = "";

  const mercados = partidoSeleccionadoData.mercados || {};

  // 1. Pregunta resultado del partido
  const resultadoMercado = mercados.resultado || partidoSeleccionadoData.resultado;
  if (resultadoMercado && Array.isArray(resultadoMercado.opciones)) {
    const div = document.createElement("div");
    div.className = "pregunta-item";
    let optionsHtml = resultadoMercado.opciones
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
  }

  // 2. Pregunta goleadores (checkboxes)
  if (
    mercados.goleadores &&
    Array.isArray(mercados.goleadores.opciones)
  ) {
    const goleadoresDiv = document.createElement("div");
    goleadoresDiv.className = "pregunta-item";
    goleadoresDiv.innerHTML = `<label>¿Quiénes marcaron?</label>`;
    const lista = document.createElement("div");
    lista.className = "goleadores-checkbox-list";
    mercados.goleadores.opciones.forEach((jug) => {
      const id = `goleador_${jug.valor}`;
      const label = document.createElement("label");
      label.className = "goleador-checkbox-label";
      label.setAttribute("for", id);

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "goleador-checkbox";
      input.id = id;
      input.value = jug.valor;

      label.appendChild(input);
      label.appendChild(document.createTextNode(jug.nombre));
      lista.appendChild(label);
    });
    goleadoresDiv.appendChild(lista);
    preguntasWrap.appendChild(goleadoresDiv);
  }

  // 3. Pregunta tarjetas (si hay mercado de tarjetas)
  if (mercados.tarjetas) {
    // Segmentos y equipos básicos
    const segmentos = [
      { id: "encuentro", label: "Encuentro" },
      { id: "primera", label: "1ª Mitad" },
      { id: "segunda", label: "2ª Mitad" }
    ];
    const equipos = [
      { id: "ambos", label: "Ambos equipos" },
      { id: "equipo1", label: partidoSeleccionadoData.equipo1 },
      { id: "equipo2", label: partidoSeleccionadoData.equipo2 }
    ];

    const tarjetasDiv = document.createElement("div");
    tarjetasDiv.className = "pregunta-item";
    tarjetasDiv.innerHTML = `<label>¿Cuántas tarjetas?</label>`;

    // Bloque visual para cada segmento
    const tarjetasBloque = document.createElement("div");
    tarjetasBloque.className = "tarjetas-resultado-bloque";

    segmentos.forEach(seg => {
      const segBlock = document.createElement("div");
      segBlock.className = "tarjetas-resultado-segmento";
      segBlock.innerHTML = `<span class="tarjetas-segmento-label">${seg.label}</span>
        <div class="tarjetas-resultado-equipos"></div>`;
      const equiposWrap = segBlock.querySelector('.tarjetas-resultado-equipos');
      equipos.forEach(eq => {
        const label = document.createElement('label');
        label.innerHTML = `<span>${eq.label}</span>
          <input type="number" min="0" max="20" class="input-tarjetas" data-segmento="${seg.id}" data-equipo="${eq.id}" />`;
        equiposWrap.appendChild(label);
      });
      tarjetasBloque.appendChild(segBlock);
    });
    tarjetasDiv.appendChild(tarjetasBloque);
    preguntasWrap.appendChild(tarjetasDiv);
  }

  // ... después del bloque de tarjetas ...
  // 4. Pregunta corners (si hay mercado de corners)
  if (mercados.corners) {
    // Segmentos y equipos igual que tarjetas
    const segmentos = [
      { id: "encuentro", label: "Encuentro" },
      { id: "primera", label: "1ª Mitad" },
      { id: "segunda", label: "2ª Mitad" }
    ];
    const equipos = [
      { id: "ambos", label: "Ambos equipos" },
      { id: "equipo1", label: partidoSeleccionadoData.equipo1 },
      { id: "equipo2", label: partidoSeleccionadoData.equipo2 }
    ];

    const cornersDiv = document.createElement("div");
    cornersDiv.className = "pregunta-item";
    cornersDiv.innerHTML = `<label>¿Cuántos corners?</label>`;

    const cornersBloque = document.createElement("div");
    cornersBloque.className = "corners-resultado-bloque";

    segmentos.forEach(seg => {
      const segBlock = document.createElement("div");
      segBlock.className = "corners-resultado-segmento";
      segBlock.innerHTML = `<span class="corners-segmento-label">${seg.label}</span>
        <div class="corners-resultado-equipos"></div>`;
      const equiposWrap = segBlock.querySelector('.corners-resultado-equipos');
      equipos.forEach(eq => {
        const label = document.createElement('label');
        label.innerHTML = `<span>${eq.label}</span>
          <input type="number" min="0" max="30" class="input-corners" data-segmento="${seg.id}" data-equipo="${eq.id}" />`;
        equiposWrap.appendChild(label);
      });
      cornersBloque.appendChild(segBlock);
    });
    cornersDiv.appendChild(cornersBloque);
    preguntasWrap.appendChild(cornersDiv);
  }
}

// Utilidad para parsear tipo de apuesta de tarjetas
function parseTarjetaBetTipo(tipo, equipo1 = '', equipo2 = '') {
  let main = "", cantidad = "", equipo = "ambos", periodo = "encuentro";
  const partes = tipo.split(" - ").map(s => s.trim());
  if (partes.length === 4) {
    main = partes[0];
    cantidad = partes[1];
    equipo = partes[2];
    periodo = partes[3];
  } else if (partes.length === 3) {
    let match = partes[0].match(/(Más de|Menos de|Exactamente)\s*(\d+)/i);
    if (match) {
      main = match[1];
      cantidad = match[2];
    } else {
      const mt = partes[0].match(/(Exactamente)\s*(\d+)/i);
      if (mt) {
        main = mt[1];
        cantidad = mt[2];
      } else {
        main = partes[0];
      }
    }
    let periodoTest = partes[1].toLowerCase();
    if (
      ["encuentro", "1ª mitad", "2ª mitad", "primera", "segunda"].includes(periodoTest)
    ) {
      periodo = periodoTest;
      equipo = partes[2].toLowerCase();
    } else {
      equipo = partes[1].toLowerCase();
      periodo = partes[2].toLowerCase();
    }
  }

  periodo = periodo
    .replace(/1ª mitad/i, "primera")
    .replace(/2ª mitad/i, "segunda")
    .trim();

  equipo = equipo.trim().toLowerCase();
  equipo1 = (equipo1 || "").trim().toLowerCase();
  equipo2 = (equipo2 || "").trim().toLowerCase();

  if (equipo === equipo1) equipo = "equipo1";
  else if (equipo === equipo2) equipo = "equipo2";
  else if (equipo === "ambos equipos" || equipo === "ambos") equipo = "ambos";

  return { main, cantidad: Number(cantidad), equipo, periodo };
}

function limpiaParentesisTarjetas(tipo) {
  return tipo.replace(/\s*\([^)]+\)\s*/g, " ").replace(/\s{2,}/g, " ").trim();
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
    construirFormularioDesdeMercados(partidoSeleccionadoData);
    resultadoForm.classList.remove("hidden");
    if (estadoGuardado) estadoGuardado.textContent = "";
  } catch (error) {
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

  // Obtener valores de los campos
  const resultadoSelect = document.getElementById("resultadoSelect");
  const goleadorCheckboxes = document.querySelectorAll(".goleador-checkbox");
  const goleadoresMarcados = [];
  goleadorCheckboxes.forEach(cb => {
    if (cb.checked) goleadoresMarcados.push(cb.value);
  });

  // ... Tarjetas
  const tarjetasInputs = document.querySelectorAll('.input-tarjetas');
  const tarjetasResultados = {};
  tarjetasInputs.forEach(input => {
    const seg = input.dataset.segmento;
    const eq = input.dataset.equipo;
    const val = parseInt(input.value, 10);
    if (!tarjetasResultados[seg]) tarjetasResultados[seg] = {};
    tarjetasResultados[seg][eq] = isNaN(val) ? null : val;
  });

  // Corners
  const cornersInputs = document.querySelectorAll('.input-corners');
  const cornersResultados = {};
  cornersInputs.forEach(input => {
    const seg = input.dataset.segmento;
    const eq = input.dataset.equipo;
    const val = parseInt(input.value, 10);
    if (!cornersResultados[seg]) cornersResultados[seg] = {};
    cornersResultados[seg][eq] = isNaN(val) ? null : val;
  });

  // Construir el resultado a guardar
  const resultadoGuardado = {
    ganador: resultadoSelect ? resultadoSelect.value : null,
    goleadores: goleadoresMarcados
  };
  if (Object.keys(tarjetasResultados).length > 0) {
    resultadoGuardado.tarjetas = tarjetasResultados;
  }
  if (Object.keys(cornersResultados).length > 0) {
    resultadoGuardado.corners = cornersResultados;
  }

  console.log("===> resultadoGuardado:", JSON.stringify(resultadoGuardado, null, 2));

  try {
    await updateDoc(doc(db, "partidos", partidoSeleccionadoId), {
      resultado: resultadoGuardado,
    });

    // Actualizar apuestas
    const apuestasRef = collection(db, "apuestas");
    const apuestasSnapshot = await getDocs(apuestasRef);

    for (const apuestaDoc of apuestasSnapshot.docs) {
      const apuestaData = apuestaDoc.data();

      // Solo actualizar si el estado es "pendiente"
      if (apuestaData.estado && apuestaData.estado !== "pendiente") {
        continue; // saltar esta apuesta
      }

      let bets = apuestaData.bets || [];
      let betsModificados = false;

      bets = bets.map((bet, betIndex) => {
        if (bet.partidoId === partidoSeleccionadoId) {
          let resultadoBet = "perdida";
          const tipo = bet.tipo;

          // Tarjetas
          let tarjetasPartido = null;
          if (tipo.toLowerCase().includes("tarjeta")) {
            const periodo = tipo.toLowerCase().includes("1ª mitad") ? "primera"
                          : tipo.toLowerCase().includes("2ª mitad") ? "segunda"
                          : "encuentro";

            const equipo = tipo.toLowerCase().includes("equipo1") ? "equipo1"
                        : tipo.toLowerCase().includes("equipo2") ? "equipo2"
                        : "ambos";

            if (resultadoGuardado.tarjetas?.[periodo]) {
              if (equipo === "ambos") {
                const eq1 = resultadoGuardado.tarjetas[periodo].equipo1 || 0;
                const eq2 = resultadoGuardado.tarjetas[periodo].equipo2 || 0;
                tarjetasPartido = eq1 + eq2;
              } else {
                tarjetasPartido = resultadoGuardado.tarjetas[periodo][equipo] ?? null;
              }
            }

            const numeroApostado = parseInt(tipo.match(/\d+/)?.[0] || 0, 10);

            console.log(`Tarjetas calculadas: ${tarjetasPartido}, número apostado: ${numeroApostado}, periodo: ${periodo}, equipo: ${equipo}`);

            if (tarjetasPartido !== null) {
              if (tipo.toLowerCase().includes("más de")) {
                resultadoBet = tarjetasPartido > numeroApostado ? "ganada" : "perdida";
              } else if (tipo.toLowerCase().includes("menos de")) {
                resultadoBet = tarjetasPartido < numeroApostado ? "ganada" : "perdida";
              } else if (tipo.toLowerCase().includes("exactamente")) {
                resultadoBet = tarjetasPartido === numeroApostado ? "ganada" : "perdida";
              }
            }
          }
          // Corners
          else if (bet.mercado === "corners" || tipo.toLowerCase().includes("corner")) {
            // Detectar periodo y equipo igual que en tarjetas
            const periodo = tipo.toLowerCase().includes("1ª mitad") ? "primera"
                          : tipo.toLowerCase().includes("2ª mitad") ? "segunda"
                          : "encuentro";
            const equipo = tipo.toLowerCase().includes("equipo1") ? "equipo1"
                        : tipo.toLowerCase().includes("equipo2") ? "equipo2"
                        : "ambos";
            let cornersPartido = null;
            if (resultadoGuardado.corners?.[periodo]) {
              if (equipo === "ambos") {
                const eq1 = resultadoGuardado.corners[periodo].equipo1 || 0;
                const eq2 = resultadoGuardado.corners[periodo].equipo2 || 0;
                cornersPartido = eq1 + eq2;
              } else {
                cornersPartido = resultadoGuardado.corners[periodo][equipo] ?? null;
              }
            }
            const numeroApostado = parseInt(tipo.match(/\d+/)?.[0] || 0, 10);

            if (cornersPartido !== null) {
              if (tipo.toLowerCase().includes("más de")) {
                resultadoBet = cornersPartido > numeroApostado ? "ganada" : "perdida";
              } else if (tipo.toLowerCase().includes("menos de")) {
                resultadoBet = cornersPartido < numeroApostado ? "ganada" : "perdida";
              } else if (tipo.toLowerCase().includes("exactamente")) {
                resultadoBet = cornersPartido === numeroApostado ? "ganada" : "perdida";
              }
            }
          }
          // Resultado simple 1/X/2
          else if (
            (bet.tipo === partidoSeleccionadoData.equipo1 && resultadoGuardado.ganador === "1") ||
            (bet.tipo === partidoSeleccionadoData.equipo2 && resultadoGuardado.ganador === "2") ||
            (bet.tipo === "Empate" && resultadoGuardado.ganador === "X")
          ) {
            resultadoBet = "ganada";
          }
          // Goleador
          else if (bet.tipoApuesta === "goleador" || ![partidoSeleccionadoData.equipo1, partidoSeleccionadoData.equipo2, "Empate"].includes(tipo)) {
            let valorGoleador = null;
            const marcaMatch = tipo.match(/Marca\s*\((.+)\)/i);
            const opcionesGoleadores = (partidoSeleccionadoData.mercados?.goleadores?.opciones || []);
            if (marcaMatch) {
              const nombreJugador = marcaMatch[1].trim();
              const opcion = opcionesGoleadores.find(j => j.nombre.toLowerCase() === nombreJugador.toLowerCase());
              if (opcion) valorGoleador = opcion.valor;
            } else {
              const opcion = opcionesGoleadores.find(j =>
                j.nombre.toLowerCase() === tipo.toLowerCase() ||
                j.valor.toLowerCase() === tipo.toLowerCase()
              );
              if (opcion) valorGoleador = opcion.valor;
            }
            if (valorGoleador && goleadoresMarcados.includes(valorGoleador)) {
              resultadoBet = "ganada";
            }
          }

          betsModificados = true;
          console.log("Resultado calculado para la apuesta:", resultadoBet);
          return { ...bet, resultado: resultadoBet };
        }
        return bet;
      });

      // Evaluar estado combinado
      let nuevoEstadoApuesta = apuestaData.estado || "pendiente";
      if (bets.length > 1) {
        if (bets.some(b => b.resultado === "perdida")) {
          nuevoEstadoApuesta = "perdida";
        } else if (bets.every(b => b.resultado === "ganada")) {
          nuevoEstadoApuesta = "ganada";
        } else {
          nuevoEstadoApuesta = "pendiente";
        }
      } else if (bets.length === 1) {
        nuevoEstadoApuesta = bets[0].resultado || "pendiente";
      }

      if (betsModificados) {
        await updateDoc(doc(db, "apuestas", apuestaDoc.id), {
          bets,
          estado: nuevoEstadoApuesta,
          resultado:
            nuevoEstadoApuesta === "ganada"
              ? "¡Enhorabuena, tu apuesta es ganadora!"
              : nuevoEstadoApuesta === "perdida"
              ? "Tu apuesta no ha resultado ganadora."
              : null,
        });
      }
    }

    if (estadoGuardado) estadoGuardado.textContent = "Resultados guardados y apuestas actualizadas correctamente.";
  } catch (error) {
    if (estadoGuardado) estadoGuardado.textContent = "Error al guardar los resultados.";
    console.error("Error al guardar los resultados:", error);
  }
});



// Inicializar (cuando el DOM esté listo)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cargarPartidos);
} else {
  cargarPartidos();
}