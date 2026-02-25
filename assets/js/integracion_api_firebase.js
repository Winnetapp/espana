// integracion_api_firebase.js
// Importa partidos, genera cuotas y actualiza resultados reales usando Bzzoiro + Firebase

import { db } from "./firebase.js";  // Tu configuración de Firebase
import { generar_cuotas } from "./generador_cuotas_api.js";

const apiToken = "ac08aa7e86cf9623cea89f389200e8e51171cda4";

// ===========================
// 1️⃣ Importar próximos partidos
// ===========================
export async function importar_partidos_api() {
  const res = await fetch("https://sports.bzzoiro.com/api/events/", {
    headers: { "Authorization": `Token ${apiToken}` }
  });
  const data = await res.json();
  
  for (const p of data.results) {
    const id = p.id.toString();
    const docRef = db.collection("partidos").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      await docRef.set({
        local: p.home_team,
        visitante: p.away_team,
        fecha: p.event_date,
        liga: p.league.name,
        estado: "pendiente"
      });
    }
  }
  console.log("Partidos importados correctamente");
}

// ===========================
// 2️⃣ Actualizar cuotas desde la API
// ===========================
export async function actualizar_cuotas_api() {
  const res = await fetch("https://sports.bzzoiro.com/api/predictions/?upcoming=true", {
    headers: { "Authorization": `Token ${apiToken}` }
  });
  const data = await res.json();

  for (const predic of data.results) {
    const idPartido = predic.event.id.toString();
    const docRef = db.collection("partidos").doc(idPartido);
    const doc = await docRef.get();
    if (!doc.exists) continue;

    const partido = doc.data();
    const cuotas = generar_cuotas(partido, predic);
    await docRef.update({ cuotas });
  }
  console.log("Cuotas actualizadas desde la API");
}

// ===========================
// 3️⃣ Actualizar resultados reales
// ===========================
export async function actualizar_resultados_api() {
  const res = await fetch("https://sports.bzzoiro.com/api/live/", {
    headers: { "Authorization": `Token ${apiToken}` }
  });
  const data = await res.json();

  for (const partidoApi of data.results) {
    const idPartido = partidoApi.event.id.toString();
    const docRef = db.collection("partidos").doc(idPartido);
    const doc = await docRef.get();
    if (!doc.exists) continue;

    const golesLocal = partidoApi.scores.home ?? 0;
    const golesVisit = partidoApi.scores.away ?? 0;
    const tarjetasLocal = partidoApi.stats?.cards?.home ?? 0;
    const tarjetasVisit = partidoApi.stats?.cards?.away ?? 0;
    const cornersLocal = partidoApi.stats?.corners?.home ?? 0;
    const cornersVisit = partidoApi.stats?.corners?.away ?? 0;

    let resultado;
    if (golesLocal > golesVisit) resultado = "local";
    else if (golesLocal < golesVisit) resultado = "visitante";
    else resultado = "empate";

    await docRef.update({
      estado: "finalizado",
      goles: { local: golesLocal, visitante: golesVisit },
      tarjetas: { local: tarjetasLocal, visitante: tarjetasVisit },
      corners: { local: cornersLocal, visitante: cornersVisit },
      resultado
    });

    // ⚠️ Mercados PRO (primer gol, resultado exacto, etc.) se dejan comentados para activarlos después
    /*
    await cerrar_apuestas_pro(docRef, partidoApi);
    */
  }
  console.log("Resultados actualizados con datos reales de la API");
}

// ===========================
// 4️⃣ Ejecución completa
// ===========================
export async function ejecutar_todo() {
  await importar_partidos_api();
  await actualizar_cuotas_api();
  await actualizar_resultados_api();
  console.log("✅ Integración completa ejecutada");
}