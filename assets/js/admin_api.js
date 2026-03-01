// assets/js/admin_api.js
// Usa Football-Data.org (gratis) via proxy Cloudflare
// Plan FREE (Tier 1): 10 req/min, pausa de 6s entre ligas
//
// ✅ Ligas sincronizadas con The Odds API:
//    Solo se importan ligas para las que hay cobertura de cuotas.
//    Brasil, Copa del Mundo y Eurocopa eliminadas (sin cobertura en Odds API).

const PROXY_URL = "https://winnet-proxy.winnetaplicacion.workers.dev";

// ─────────────────────────────────────────────────────────────
//  LIGAS — solo las que tienen cobertura en The Odds API
//  11 ligas × 6s = 66s de importación total
// ─────────────────────────────────────────────────────────────
// IDs de Football-Data.org (TIER_ONE) — confirmados desde /competitions
// Europa League y Copa del Rey NO están en el plan TIER_ONE → eliminadas
const LIGAS = [
  { codigo: "PL",  nombre: "Premier League",  id: 2021 },
  { codigo: "PD",  nombre: "La Liga",          id: 2014 },
  { codigo: "BL1", nombre: "Bundesliga",        id: 2002 },
  { codigo: "SA",  nombre: "Serie A",           id: 2019 },
  { codigo: "FL1", nombre: "Ligue 1",           id: 2015 },
  { codigo: "ELC", nombre: "Championship",      id: 2016 },
  { codigo: "DED", nombre: "Eredivisie",        id: 2003 },
  { codigo: "PPL", nombre: "Primeira Liga",     id: 2017 },
  { codigo: "CL",  nombre: "Champions League",  id: 2001 },
];

// IDs exportados para que adminpartidos.js pueda pintar los badges
export const LIGAS_IDS = LIGAS.map(l => l.id);

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

async function fetchPartidosLiga(codigo) {
  const hoy     = new Date().toISOString().split("T")[0];
  const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const url     = `${PROXY_URL}/competitions/${codigo}/matches?dateFrom=${hoy}&dateTo=${en7dias}`;
  const res     = await fetch(url);

  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    if (res.status === 403) return [];  // liga no disponible en este plan — no es error grave
    throw new Error(`Football-Data ${res.status}: ${texto.slice(0, 80)}`);
  }

  const data = await res.json();
  return data.matches || [];
}

function mapearEstado(status) {
  const map = {
    "SCHEDULED":  "NS",
    "TIMED":      "NS",
    "IN_PLAY":    "1H",
    "PAUSED":     "HT",
    "FINISHED":   "FT",
    "POSTPONED":  "PST",
    "CANCELLED":  "CANC",
    "SUSPENDED":  "SUSP",
  };
  return map[status] || "NS";
}

// ─────────────────────────────────────────────────────────────
//  IMPORTAR PARTIDOS
//  Solo Football-Data — 0 requests a Odds API
//  11 ligas × 6s de pausa = ~66s total
// ─────────────────────────────────────────────────────────────
export async function importar_partidos(db, onLigaProgress) {
  let total = 0;
  const errores = [];

  for (const liga of LIGAS) {
    onLigaProgress?.(liga.id, "En cola...", "pending");
  }

  for (let i = 0; i < LIGAS.length; i++) {
    const liga = LIGAS[i];
    onLigaProgress?.(liga.id, "Importando...", "loading");

    if (i > 0) await esperar(6000); // 6s entre ligas → máx 10 req/min

    try {
      const partidos = await fetchPartidosLiga(liga.codigo);

      if (!partidos.length) {
        onLigaProgress?.(liga.id, "Sin partidos próximos", "pending");
        continue;
      }

      let count = 0;
      for (const p of partidos) {
        const estado    = mapearEstado(p.status);
        const fechaDate = new Date(p.utcDate);

        await db.collection("partidos").doc(String(p.id)).set({
          fixtureId:      p.id,
          liga:           liga.nombre,
          ligaId:         liga.id,
          fecha:          p.utcDate,
          timestamp:      firebase.firestore.Timestamp.fromDate(fechaDate),
          estado:         estado,
          local:          p.homeTeam.name,
          localLogo:      p.homeTeam.crest || null,
          visitante:      p.awayTeam.name,
          visitanteLogo:  p.awayTeam.crest || null,
          golesLocal:     p.score?.fullTime?.home ?? null,
          golesVisitante: p.score?.fullTime?.away ?? null,
          jornada:        p.matchday ?? null,
          updatedAt:      firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        count++;
        total++;
      }

      onLigaProgress?.(liga.id, `✓ ${count} partidos`, "ok");
      console.log(`✅ ${liga.nombre}: ${count} partidos importados`);

    } catch (err) {
      console.error(`❌ ${liga.nombre}:`, err.message);
      errores.push(liga.nombre);
      onLigaProgress?.(liga.id, `Error: ${err.message.slice(0, 35)}`, "error");
    }
  }

  return { total, errores };
}

// ─────────────────────────────────────────────────────────────
//  ACTUALIZAR CUOTAS
//  Mantenida por compatibilidad — no hace nada.
//  Los botones de cuotas en adminpartidos.js apuntan a admin_cuotas.js
// ─────────────────────────────────────────────────────────────
export async function actualizar_cuotas() {
  console.warn("[actualizar_cuotas] No hace nada. Usa los botones de cuotas del panel.");
  return 0;
}

// ─────────────────────────────────────────────────────────────
//  ARCHIVAR PARTIDOS TERMINADOS (FT → historial)
// ─────────────────────────────────────────────────────────────
export async function archivar_partidos(db) {
  const snapshot = await db.collection("partidos").where("estado", "==", "FT").get();
  let archivados = 0;
  for (const doc of snapshot.docs) {
    await db.collection("historial").doc(doc.id).set({
      ...doc.data(),
      archivadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await doc.ref.delete();
    archivados++;
  }
  return archivados;
}

// ─────────────────────────────────────────────────────────────
//  ACTUALIZAR EN VIVO
//  Recorre las 11 ligas buscando partidos activos o terminados
//  en los últimos 3 días. 11 ligas × 6s = ~66s total.
// ─────────────────────────────────────────────────────────────
export async function actualizar_en_vivo(db) {
  let actualizados = 0;

  for (let i = 0; i < LIGAS.length; i++) {
    const liga = LIGAS[i];
    if (i > 0) await esperar(6000);

    try {
      const hoy    = new Date().toISOString().split("T")[0];
      const hace3d = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
      const url    = `${PROXY_URL}/competitions/${liga.codigo}/matches?dateFrom=${hace3d}&dateTo=${hoy}`;
      const res    = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      for (const p of (data.matches || [])) {
        const estado = mapearEstado(p.status);
        if (!["1H","HT","2H","ET","P","FT","AET","PEN"].includes(estado)) continue;

        const docRef = db.collection("partidos").doc(String(p.id));
        const doc    = await docRef.get();
        if (!doc.exists) continue;

        await docRef.update({
          estado,
          minuto:         p.minute ?? null,
          golesLocal:     p.score?.fullTime?.home ?? p.score?.halfTime?.home ?? null,
          golesVisitante: p.score?.fullTime?.away ?? p.score?.halfTime?.away ?? null,
          updatedAt:      firebase.firestore.FieldValue.serverTimestamp(),
        });
        actualizados++;
      }

    } catch (err) {
      console.error(`❌ En vivo ${liga.nombre}:`, err.message);
    }
  }

  return actualizados;
}