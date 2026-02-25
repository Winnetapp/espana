// admin_resultados_api.js
// Actualiza resultados reales usando Bzzoiro API y cierra apuestas automáticamente

export async function actualizarResultados(db, apiToken) {
  // 1️⃣ Traer todos los resultados finalizados de la API
  const res = await fetch("https://sports.bzzoiro.com/api/live/", {
    headers: { "Authorization": `Token ${apiToken}` }
  });
  const data = await res.json();
  
  for (const partidoApi of data.results) {
    const idPartido = partidoApi.event.id.toString();
    
    // 2️⃣ Obtener el partido en Firebase
    const docRef = db.collection("partidos").doc(idPartido);
    const doc = await docRef.get();
    if (!doc.exists) continue; // Saltar si no existe

    const partido = doc.data();

    // 3️⃣ Extraer resultados de la API
    const golesLocal = partidoApi.scores.home ?? 0;
    const golesVisit = partidoApi.scores.away ?? 0;
    const tarjetasLocal = partidoApi.stats?.cards?.home ?? 0;
    const tarjetasVisit = partidoApi.stats?.cards?.away ?? 0;
    const cornersLocal = partidoApi.stats?.corners?.home ?? 0;
    const cornersVisit = partidoApi.stats?.corners?.away ?? 0;

    // 4️⃣ Determinar ganador
    let resultado;
    if (golesLocal > golesVisit) resultado = "local";
    else if (golesLocal < golesVisit) resultado = "visitante";
    else resultado = "empate";

    // 5️⃣ Guardar en Firebase
    await docRef.update({
      estado: "finalizado",
      goles: { local: golesLocal, visitante: golesVisit },
      tarjetas: { local: tarjetasLocal, visitante: tarjetasVisit },
      corners: { local: cornersLocal, visitante: cornersVisit },
      resultado
    });

    // 6️⃣ Cerrar apuestas automáticas
    const apuestasRef = db.collection("apuestas").where("partidoId", "==", idPartido);
    const apuestasSnap = await apuestasRef.get();

    apuestasSnap.forEach(async (apuestaDoc) => {
      const apuesta = apuestaDoc.data();
      let ganada = false;

      // Ejemplo simple: apuesta 1X2
      if (apuesta.tipo === "1X2") {
        if (apuesta.opcion === resultado) ganada = true;
      }

      // Para mercados PRO como over/under, BTTS, tarjetas o corners
      else if (apuesta.tipo === "mas_menos_25") {
        const totalGoles = golesLocal + golesVisit;
        if ((apuesta.opcion === "mas" && totalGoles > 2.5) ||
            (apuesta.opcion === "menos" && totalGoles <= 2.5)) ganada = true;
      } else if (apuesta.tipo === "ambos_marcan") {
        const ambos = golesLocal > 0 && golesVisit > 0;
        if ((apuesta.opcion === "si" && ambos) || (apuesta.opcion === "no" && !ambos)) ganada = true;
      } else if (apuesta.tipo === "tarjetas") {
        const totalTarjetas = tarjetasLocal + tarjetasVisit;
        if ((apuesta.opcion === "mas" && totalTarjetas > apuesta.umbral) ||
            (apuesta.opcion === "menos" && totalTarjetas <= apuesta.umbral)) ganada = true;
      } else if (apuesta.tipo === "corners") {
        const totalCorners = cornersLocal + cornersVisit;
        if ((apuesta.opcion === "mas" && totalCorners > apuesta.umbral) ||
            (apuesta.opcion === "menos" && totalCorners <= apuesta.umbral)) ganada = true;
      }

      // Actualizar apuesta
      await apuestaDoc.ref.update({ estado: "cerrada", ganada });
    });
  }

  console.log("Resultados actualizados y apuestas cerradas correctamente.");
}