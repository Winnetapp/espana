// assets/js/admin_rescatar.js
// Fuerza la recuperación de partidos pasados que siguen con estado NS/1H/HT
// Usa Football-Data.org via proxy con rango de fechas (sin gastar RapidAPI)

const PROXY_URL = "https://winnet-proxy.winnetaplicacion.workers.dev";

const LIGAS = [
  { codigo: "PL",  id: 39   },
  { codigo: "PD",  id: 140  },
  { codigo: "BL1", id: 78   },
  { codigo: "SA",  id: 135  },
  { codigo: "FL1", id: 61   },
  { codigo: "CL",  id: 2001 },
  { codigo: "DED", id: 88   },
  { codigo: "ELC", id: 40   },
  { codigo: "PPL", id: 94   },
  { codigo: "BSA", id: 71   },
  { codigo: "WC",  id: 2000 },
  { codigo: "EC",  id: 2016 },
];

function mapearEstado(status) {
  const map = {
    "SCHEDULED": "NS",   "TIMED":    "NS",
    "IN_PLAY":   "1H",   "PAUSED":   "HT",
    "FINISHED":  "FT",   "POSTPONED":"PST",
    "CANCELLED": "CANC", "SUSPENDED":"SUSP",
  };
  return map[status] || "NS";
}

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function rescatar_partidos(db, onProgress) {
  const log = (msg, tipo = "info") => onProgress?.(msg, tipo);

  log("🔍 Buscando partidos con estado NS/1H/HT cuya fecha ya pasó...");

  const estadosSinResolver = ["NS", "1H", "HT", "2H", "ET", "P", "PST"];
  const snapshot = await db.collection("partidos")
    .where("estado", "in", estadosSinResolver)
    .get();

  if (snapshot.empty) {
    log("✅ No hay partidos sin resolver en Firestore.", "ok");
    return { rescatados: 0, actualizados: 0, sinDatos: 0 };
  }

  const ahora = new Date();
  // Filtramos los que ya deberían haber terminado (fecha + 3h de margen)
  const pendientes = snapshot.docs.filter(doc => {
    const d = doc.data();
    if (!d.fecha) return false;
    const fechaPartido = new Date(d.fecha);
    return fechaPartido < new Date(ahora - 3 * 3600000);
  });

  if (!pendientes.length) {
    log("✅ No hay partidos pasados sin resultado. Los partidos pendientes son futuros.", "ok");
    return { rescatados: 0, actualizados: 0, sinDatos: 0 };
  }

  log(`⚠️ ${pendientes.length} partido(s) pasado(s) con estado incorrecto:`, "warn");
  pendientes.forEach(doc => {
    const d = doc.data();
    log(`  · [${d.ligaId}] ${d.local} vs ${d.visitante} — ${d.fecha} — estado: ${d.estado}`, "warn");
  });

  // Agrupar por liga
  const porLiga = new Map();
  for (const doc of pendientes) {
    const d = doc.data();
    if (!porLiga.has(d.ligaId)) porLiga.set(d.ligaId, []);
    porLiga.get(d.ligaId).push({ id: doc.id, ref: doc.ref, ...d });
  }

  const hace14d = new Date(ahora - 14 * 86400000).toISOString().split("T")[0];
  const hoy     = new Date(ahora - 3600000).toISOString().split("T")[0]; // hasta hace 1h

  let rescatados = 0, actualizados = 0, sinDatos = 0;

  for (const [ligaId, partidos] of porLiga) {
    const liga = LIGAS.find(l => l.id === ligaId);
    if (!liga) {
      log(`⚠️ Liga ${ligaId} no está en el array LIGAS`, "warn");
      sinDatos += partidos.length;
      continue;
    }

    log(`📡 Consultando Football-Data: ${liga.codigo} (${partidos.length} partidos)...`);
    await esperar(6000); // respetar rate limit 10 req/min

    try {
      const url = `${PROXY_URL}/competitions/${liga.codigo}/matches?dateFrom=${hace14d}&dateTo=${hoy}`;
      const res = await fetch(url);

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        log(`❌ Error ${res.status} para ${liga.codigo}: ${txt.slice(0, 80)}`, "error");
        sinDatos += partidos.length;
        continue;
      }

      const data    = await res.json();
      const matches = data.matches || [];
      log(`📋 ${matches.length} partidos recibidos de Football-Data para ${liga.codigo}`);

      for (const partido of partidos) {
        // Buscar por fixtureId primero
        let match = matches.find(m => String(m.id) === String(partido.fixtureId));

        // Si no encuentra por ID, buscar por nombre de equipos
        if (!match) {
          const normStr = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
          match = matches.find(m =>
            normStr(m.homeTeam?.name).includes(normStr(partido.local).slice(0,5)) ||
            normStr(partido.local).includes(normStr(m.homeTeam?.name).slice(0,5))
          );
        }

        if (!match) {
          log(`⚠️ No encontrado en API: ${partido.local} vs ${partido.visitante} (ID: ${partido.fixtureId})`, "warn");
          sinDatos++;
          continue;
        }

        const estado      = mapearEstado(match.status);
        const golesLocal  = match.score?.fullTime?.home ?? null;
        const golesVisit  = match.score?.fullTime?.away ?? null;

        log(`🔄 ${partido.local} vs ${partido.visitante}: ${partido.estado} → ${estado} (${golesLocal ?? "?"}–${golesVisit ?? "?"})`);

        if (estado === "FT" && golesLocal !== null && golesVisit !== null) {
          // Partido terminado con resultado → actualizar en Firestore
          await partido.ref.update({
            estado: "FT",
            golesLocal,
            golesVisitante: golesVisit,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          log(`✅ ${partido.local} ${golesLocal}–${golesVisit} ${partido.visitante} → FT guardado`, "ok");
          rescatados++;
        } else if (estado !== "NS" && estado !== partido.estado) {
          // Estado actualizado aunque no sea FT
          await partido.ref.update({
            estado,
            golesLocal:     golesLocal,
            golesVisitante: golesVisit,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          log(`🔄 Estado actualizado: ${partido.estado} → ${estado}`, "info");
          actualizados++;
        } else {
          log(`⏳ ${partido.local} vs ${partido.visitante} — estado API: ${estado}, sin cambios`, "info");
          sinDatos++;
        }
      }

    } catch (err) {
      log(`❌ Error liga ${liga.codigo}: ${err.message}`, "error");
      sinDatos += partidos.length;
    }
  }

  log(`📊 Rescate completado: ${rescatados} rescatados con FT · ${actualizados} actualizados · ${sinDatos} sin datos`, rescatados > 0 ? "ok" : "warn");
  log(`💡 Ahora ejecuta "Resolver apuestas" para liquidar las apuestas pendientes.`, "info");

  return { rescatados, actualizados, sinDatos };
}