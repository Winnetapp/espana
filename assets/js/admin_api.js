import { generar_cuotas } from "./generador_cuotas_api.js";

// Traer partidos desde Bzzoiro API
export async function importarPartidos(db, apiToken) {
  const res = await fetch("https://sports.bzzoiro.com/api/events/", {
    headers: { "Authorization": `Token ${apiToken}` }
  });
  const data = await res.json();
  const partidos = data.results;

  for (const p of partidos) {
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
}

// Actualizar cuotas usando predicciones API
export async function actualizarCuotas(db, apiToken) {
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
}