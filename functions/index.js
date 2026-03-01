// functions/index.js
// Firebase Scheduled Functions para Winnet
//
// Tareas automáticas:
//   1. importarPartidos     → cada 12 horas (0:00 y 12:00 UTC)
//   2. actualizarEnVivo     → cada 1 minuto, SOLO las ligas con partidos activos hoy
//   3. archivarTerminados   → cada 6 horas, mueve FT → historial
//
// Rate limits respetados:
//   - Football-Data.org: 10 req/min → pausa de 6s entre peticiones
//   - The Odds API: 500 créditos/mes → solo se usa en el botón manual del panel
//
// Lógica clave de actualizarEnVivo:
//   Antes de ir a Football-Data, consulta Firestore para saber exactamente
//   qué ligaIds tienen partidos activos HOY. Solo consulta esas ligas.
//   Ejemplo: si solo hay Premier y La Liga activas → 2 peticiones → 6s total
//   → puede ejecutarse cada minuto sin problema.
//   Si hay las 12 ligas activas a la vez (ej: jornada europea) → 72s → se ejecuta
//   cada minuto pero el ciclo completo tarda un poco más, lo cual es aceptable.

const { onSchedule }  = require("firebase-functions/v2/scheduler");
const { logger }      = require("firebase-functions");
const admin           = require("firebase-admin");
const fetch           = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────
const PROXY_URL = "https://winnet-proxy.winnetaplicacion.workers.dev";

const LIGAS = [
  { codigo: "PL",  nombre: "Premier League",   id: 39   },
  { codigo: "PD",  nombre: "La Liga",           id: 140  },
  { codigo: "BL1", nombre: "Bundesliga",         id: 78   },
  { codigo: "SA",  nombre: "Serie A",            id: 135  },
  { codigo: "FL1", nombre: "Ligue 1",            id: 61   },
  { codigo: "CL",  nombre: "Champions League",   id: 2001 },
  { codigo: "DED", nombre: "Eredivisie",         id: 88   },
  { codigo: "ELC", nombre: "Championship",       id: 40   },
  { codigo: "PPL", nombre: "Primeira Liga",      id: 94   },
  { codigo: "BSA", nombre: "Serie A Brasil",     id: 71   },
  { codigo: "WC",  nombre: "Copa del Mundo",     id: 2000 },
  { codigo: "EC",  nombre: "Eurocopa",           id: 2016 },
];

// Estados que indican partido en curso
const ESTADOS_VIVO = ["1H", "HT", "2H", "ET", "P", "BT"];

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

function mapearEstado(status) {
  const map = {
    SCHEDULED:  "NS",
    TIMED:      "NS",
    IN_PLAY:    "1H",
    PAUSED:     "HT",
    FINISHED:   "FT",
    POSTPONED:  "PST",
    CANCELLED:  "CANC",
    SUSPENDED:  "SUSP",
  };
  return map[status] || "NS";
}

// ─────────────────────────────────────────────────────────────
//  HELPERS DE FETCH
// ─────────────────────────────────────────────────────────────
async function fetchPartidosLiga(codigo, dateFrom, dateTo) {
  const url = `${PROXY_URL}/competitions/${codigo}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetch(url);
  if (res.status === 403) return []; // liga fuera del plan, no es error
  if (!res.ok) throw new Error(`Football-Data ${res.status} en ${codigo}`);
  const data = await res.json();
  return data.matches || [];
}

async function fetchPartidosEnVivo(codigo) {
  const url = `${PROXY_URL}/competitions/${codigo}/matches?status=IN_PLAY`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.matches || [];
}

// ─────────────────────────────────────────────────────────────
//  1. IMPORTAR PARTIDOS — cada 12 horas
//     Cron: "0 0,12 * * *" → 00:00 y 12:00 UTC
// ─────────────────────────────────────────────────────────────
exports.importarPartidos = onSchedule(
  {
    schedule:  "0 0,12 * * *",
    timeZone:  "UTC",
    timeoutSeconds: 540, // 9 min máximo (12 ligas × ~6s pausa + escrituras Firestore)
    memory:    "256MiB",
  },
  async () => {
    const hoy     = new Date().toISOString().split("T")[0];
    const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    logger.info(`[importarPartidos] Iniciando. Rango: ${hoy} → ${en7dias}`);

    let totalImportados = 0;
    const errores = [];

    for (let i = 0; i < LIGAS.length; i++) {
      const liga = LIGAS[i];

      // Pausa de 6s entre ligas para no superar 10 req/min en Football-Data
      if (i > 0) await esperar(6000);

      try {
        const partidos = await fetchPartidosLiga(liga.codigo, hoy, en7dias);

        if (!partidos.length) {
          logger.info(`[importarPartidos] ${liga.nombre}: sin partidos en el rango`);
          continue;
        }

        // Escrituras en batch para eficiencia
        const batch = db.batch();
        for (const p of partidos) {
          const ref = db.collection("partidos").doc(String(p.id));
          batch.set(ref, {
            fixtureId:      p.id,
            liga:           liga.nombre,
            ligaId:         liga.id,
            fecha:          p.utcDate,
            timestamp:      admin.firestore.Timestamp.fromDate(new Date(p.utcDate)),
            estado:         mapearEstado(p.status),
            local:          p.homeTeam.name,
            localLogo:      p.homeTeam.crest || null,
            visitante:      p.awayTeam.name,
            visitanteLogo:  p.awayTeam.crest || null,
            golesLocal:     p.score?.fullTime?.home ?? null,
            golesVisitante: p.score?.fullTime?.away ?? null,
            jornada:        p.matchday ?? null,
            updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }); // merge:true → no machaca cuotas ya guardadas
        }
        await batch.commit();

        totalImportados += partidos.length;
        logger.info(`[importarPartidos] ${liga.nombre}: ✓ ${partidos.length} partidos`);

      } catch (err) {
        logger.error(`[importarPartidos] Error en ${liga.nombre}: ${err.message}`);
        errores.push(liga.nombre);
      }
    }

    logger.info(`[importarPartidos] Completado. Total: ${totalImportados}, errores: [${errores.join(", ")}]`);
  }
);

// ─────────────────────────────────────────────────────────────
//  2. ACTUALIZAR EN VIVO — cada 1 minuto
//     Cron: "* * * * *"
//
//     Estrategia para maximizar frecuencia dentro del límite de 10 req/min:
//
//     Paso 1 → Consulta Firestore (gratis, no cuenta) para saber exactamente
//              qué ligaIds tienen partidos NS o en curso HOY.
//     Paso 2 → Solo consulta Football-Data para esas ligas concretas.
//
//     Resultado:
//       - Día sin partidos        → 0 peticiones, sale en <1s
//       - 1-2 ligas activas       → 1-2 peticiones, termina en ~6-12s ✓ cada minuto
//       - 5 ligas activas         → 5 peticiones, termina en ~30s    ✓ cada minuto
//       - 12 ligas a la vez       → 12 peticiones, termina en ~72s   ≈ cada minuto
//         (caso extremo: jornada Champions + todas las ligas simultáneas,
//          prácticamente imposible en la realidad)
// ─────────────────────────────────────────────────────────────
exports.actualizarEnVivo = onSchedule(
  {
    schedule:       "* * * * *",  // cada minuto
    timeZone:       "UTC",
    timeoutSeconds: 300,          // 5 min por si coinciden muchas ligas
    memory:         "256MiB",
  },
  async () => {

    // ── Paso 1: qué ligas tienen actividad HOY (solo Firestore, sin coste API) ──
    const hoyInicio = new Date();
    hoyInicio.setUTCHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setUTCHours(23, 59, 59, 999);

    // Buscamos partidos en vivo ahora mismo
    const [vivoSnap, hoySnap] = await Promise.all([
      db.collection("partidos")
        .where("estado", "in", ESTADOS_VIVO)
        .get(),
      db.collection("partidos")
        .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(hoyInicio))
        .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(hoyFin))
        .where("estado", "==", "NS")
        .get(),
    ]);

    // Recogemos los ligaIds únicos que necesitan atención
    const ligaIdsActivas = new Set();
    vivoSnap.forEach(d => ligaIdsActivas.add(d.data().ligaId));
    hoySnap.forEach(d  => ligaIdsActivas.add(d.data().ligaId));

    if (ligaIdsActivas.size === 0) {
      logger.info("[actualizarEnVivo] Sin partidos hoy. Saltando (0 peticiones API).");
      return;
    }

    // Filtramos el array LIGAS para quedarnos solo con las activas
    const ligasActivas = LIGAS.filter(l => ligaIdsActivas.has(l.id));
    logger.info(`[actualizarEnVivo] Ligas activas hoy: ${ligasActivas.map(l => l.nombre).join(", ")} (${ligasActivas.length} peticiones)`);

    // ── Paso 2: consultamos Football-Data solo para esas ligas ──
    let actualizados = 0;
    let peticiones   = 0;

    for (let i = 0; i < ligasActivas.length; i++) {
      const liga = ligasActivas[i];

      // Pausa de 6s entre peticiones para respetar 10 req/min
      if (i > 0) await esperar(6000);
      peticiones++;

      try {
        const partidos = await fetchPartidosEnVivo(liga.codigo);
        if (!partidos.length) continue;

        const batch = db.batch();
        for (const p of partidos) {
          const ref = db.collection("partidos").doc(String(p.id));
          const doc = await ref.get();
          if (!doc.exists) continue;

          batch.update(ref, {
            estado:         mapearEstado(p.status),
            minuto:         p.minute ?? null,
            golesLocal:     p.score?.fullTime?.home ?? p.score?.halfTime?.home ?? null,
            golesVisitante: p.score?.fullTime?.away ?? p.score?.halfTime?.away ?? null,
            updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
          });
          actualizados++;
        }
        await batch.commit();

      } catch (err) {
        logger.error(`[actualizarEnVivo] Error en ${liga.nombre}: ${err.message}`);
      }
    }

    logger.info(`[actualizarEnVivo] ✓ ${actualizados} partidos actualizados en ${peticiones} peticiones`);
  }
);

// ─────────────────────────────────────────────────────────────
//  3. ARCHIVAR TERMINADOS — cada 6 horas
//     Cron: "0 */6 * * *" → 00:00, 06:00, 12:00, 18:00 UTC
//     Mueve partidos FT de 'partidos' → 'historial' y los borra
// ─────────────────────────────────────────────────────────────
exports.archivarTerminados = onSchedule(
  {
    schedule:  "0 */6 * * *",
    timeZone:  "UTC",
    timeoutSeconds: 120,
    memory:    "256MiB",
  },
  async () => {
    logger.info("[archivarTerminados] Iniciando...");

    const snapshot = await db.collection("partidos")
      .where("estado", "==", "FT")
      .get();

    if (snapshot.empty) {
      logger.info("[archivarTerminados] Sin partidos FT que archivar.");
      return;
    }

    // Procesamos en batches de 400 (límite Firestore: 500 ops por batch)
    const docs   = snapshot.docs;
    const chunks = [];
    for (let i = 0; i < docs.length; i += 400) {
      chunks.push(docs.slice(i, i + 400));
    }

    let archivados = 0;
    for (const chunk of chunks) {
      const batch = db.batch();
      for (const doc of chunk) {
        const histRef = db.collection("historial").doc(doc.id);
        batch.set(histRef, {
          ...doc.data(),
          archivadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
        batch.delete(doc.ref);
        archivados++;
      }
      await batch.commit();
    }

    logger.info(`[archivarTerminados] ✓ ${archivados} partidos archivados`);
  }
);