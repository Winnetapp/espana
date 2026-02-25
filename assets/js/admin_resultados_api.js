// admin_resultados_api.js
// Actualiza resultados usando datos reales de la API

export async function actualizar_resultados(db, apiToken) {
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

    // ⚠️ Mercados PRO (primer gol, goles por mitades, resultado exacto) se dejan comentados
    /*
    await cerrar_apuestas_pro(docRef, partidoApi);
    */
  }

  console.log("Resultados actualizados con datos reales de la API");
}