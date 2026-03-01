// admin_cuotas.js
// Cuotas via The Odds API únicamente.
// API-Football eliminado — no aportaba cuotas en plan gratuito para temporada actual.

const ODDS_API_KEY = "79f8c8d31df2ecf1e88a2a1ef32bbb92";
const ODDS_BASE    = "https://api.the-odds-api.com/v4";

const ODDS_API_KEYS = {
  // IDs de Football-Data.org (fuente única de IDs en Firestore)
  // ── Top 5 ligas ─────────────────────────────────────────────
  2021: "soccer_epl",
  2014: "soccer_spain_la_liga",
  2002: "soccer_germany_bundesliga",
  2019: "soccer_italy_serie_a",
  2015: "soccer_france_ligue_one",
  // ── Ligas secundarias ────────────────────────────────────────
  2001: "soccer_uefa_champs_league",
  2003: "soccer_netherlands_eredivisie",
  2016: "soccer_efl_champ",
  2017: "soccer_portugal_primeira_liga",
}

const MARKETS = "h2h,totals";

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Aliases para equipos con nombres distintos entre APIs ───────────────────
const TEAM_ALIASES = {
  // Bundesliga
  "fcbayernmunchen":           ["bayernmunich", "fcbayern", "bayernmunchen", "bayernmünchen"],
  "borussiadortmund":          ["dortmund", "bvb"],
  "tsg1899hoffenheim":         ["hoffenheim", "tsg1899hoffenheim"],
  "fcstpauli1910":             ["stpauli", "fcstpauli"],
  "1fsvmainz05":               ["mainz", "mainz05", "fsvmainz"],
  "vfbstuttgart":              ["stuttgart"],
  "eintrachfrankfurt":         ["eintracht", "frankfurt"],
  "scfreiburg":                ["freiburg"],
  "bayer04leverkusen":         ["leverkusen", "bayer04", "bayerleverkusen"],
  "rbLeipzig":                 ["leipzig", "rbleipzig"],
  "hamburgsv":                 ["hamburg", "hsv"],
  "vflwolfsburg":              ["wolfsburg"],
  "1fcunionberlin":            ["unionberlin", "union"],
  "svwerderbremen":            ["werder", "werderbremen"],
  "1fcheidenheim1846":         ["heidenheim"],
  "borussiamonchengladbach":   ["mgladbach", "gladbach", "monchengladbach", "mönchengladbach"],

  // Serie A
  "acpisa1909":                ["pisa", "acpisa"],
  "fcinternazionalemilano":    ["intermilan", "inter", "internazionale", "fcinter"],
  "como1907":                  ["como"],
  "bolognafootballclub1909":   ["bologna", "bolognafc"],
  "ussassuolocalcio":          ["sassuolo"],
  "uscreMonese":               ["cremonese"],
  "udinese calcio":            ["udinese"],
  "acffiorentina":             ["fiorentina"],
  "hellasVeronafc":            ["hellas", "verona", "hellasverona"],
  "torinofc":                  ["torino"],
  "sslazio":                   ["lazio"],
  "asroma":                    ["roma"],
  "juventusfc":                ["juventus", "juve"],
  "sscnapoli":                 ["napoli"],
  "acmilan":                   ["milan", "acmilan"],
  "genoaCfc":                  ["genoa"],
  "atalantabc":                ["atalanta"],
  "uslecce":                   ["lecce"],

  // Ligue 1
  "staderennaisfc1901":        ["rennes", "staderennais", "staderennaisfc"],
  "olympiquedemarseille":      ["marseille", "om"],
  "olympiquelyonnais":         ["lyon", "ol"],
  "parisfc":                   ["parisfc"],
  "ogcnice":                   ["nice"],
  "parissaintgermainfc":       ["psg", "parissaintgermain"],
  "asmonacofc":                ["monaco", "asmonaco"],
  "lilleOsc":                  ["lille"],
  "fcnantes":                  ["nantes"],
  "toulousefc":                ["toulouse"],
  "fcmetz":                    ["metz"],
  "stadeBrestois29":           ["brest", "stadebresto"],
  "fclorient":                 ["lorient"],
  "ajAuxerre":                 ["auxerre"],
  "angerssco":                 ["angers"],
  "lehavreac":                 ["lehavre", "havre"],

  // La Liga — nombres exactos confirmados desde The Odds API
  // norm("Girona FC") = "gironafc", API devuelve "Girona" → norm = "girona" ✓ alias
  "gironafc":                  ["girona"],
  // norm("RC Celta de Vigo") = "rcceltadevigo", API devuelve "Celta Vigo" → norm = "celtavigo" ✓
  // FIX: clave corregida de "rceltadevigo" a "rcceltadevigo"
  "rcceltadevigo":             ["celtavigo", "celta", "rcelta"],
  // norm("Real Madrid CF") = "realmadridcf", API devuelve "Real Madrid" → norm = "realmadrid" ✓
  "realmadridcf":              ["realmadrid", "madrid"],           // FIX: typo 'realmadrIdcf' corregido
  // norm("FC Barcelona") = "fcbarcelona", API devuelve "Barcelona" → norm = "barcelona" ✓
  "fcbarcelona":               ["barcelona", "barca"],
  // norm("Club Atlético de Madrid") = "clubatleticodemadrid", API → "Atletico Madrid" → norm = "atleticomadrid" ✓
  "clubatleticodemadrid":      ["atleticomadrid", "atletico", "atleticomadrid"],
  // norm("Athletic Club") = "athleticclub", API → "Athletic Club" ✓ (coincidencia directa)
  "athleticclub":              ["athleticbilbao", "athletic", "athleticclububilbao"],
  // norm("Real Sociedad de Fútbol") = "realsociedaddefutbol", API → "Real Sociedad" → norm = "realsociedad" ✓
  "realsociedaddefutbol":      ["realsociedad", "sociedad"],
  // norm("Real Betis Balompié") = "realbetisbalompie", API → "Real Betis" → norm = "realbetis" ✓
  "realbetisbalompie":         ["realbetis", "betis"],
  // norm("Sevilla FC") = "sevillafc", API → "Sevilla" → norm = "sevilla" ✓
  "sevillafc":                 ["sevilla"],
  // norm("Villarreal CF") = "villarrealcf", API → "Villarreal" → norm = "villarreal" ✓
  "villarrealcf":              ["villarreal"],
  // norm("Rayo Vallecano de Madrid") = "rayovallecanodemadrid", API → "Rayo Vallecano" → norm = "rayovallecano" ✓
  "rayovallecanodemadrid":     ["rayovallecano", "rayo"],
  // norm("RCD Espanyol de Barcelona") = "rcdespanyoldebarcelona", API → "Espanyol" → norm = "espanyol" ✓
  "rcdespanyoldebarcelona":    ["espanyol", "rcdespanyol"],        // FIX: typo 'rcdespaynol' corregido
  // norm("Real Oviedo") = "realoviedo", API → "Real Oviedo" ✓ (coincidencia directa)
  "realoviedo":                ["oviedo"],
  // norm("Valencia CF") = "valenciacf", API → "Valencia" → norm = "valencia" ✓
  "valenciacf":                ["valencia"],
  // norm("Getafe CF") = "getafecf", API → "Getafe" → norm = "getafe" ✓
  "getafecf":                  ["getafe"],
  // norm("CA Osasuna") = "caosasuna", API → "Osasuna" → norm = "osasuna" ✓
  "caosasuna":                 ["osasuna"],
  // norm("Elche CF") = "elchecf", API → "Elche" → norm = "elche" ✓
  "elchecf":                   ["elche"],
  // norm("Levante UD") = "levanteud", API → "Levante" → norm = "levante" ✓
  "levanteud":                 ["levante"],
  // norm("RCD Mallorca") = "rcdmallorca", API → "Mallorca" → norm = "mallorca" ✓
  "rcdmallorca":               ["mallorca"],

  // Premier League
  // norm("Brighton & Hove Albion FC") = "brightonhovealbion", API → "Brighton" → norm = "brighton" ✓
  "brightonhovealbion":        ["brighton", "brightonandhove"],    // FIX: typo 'brightonhoVealbion' corregido
  // norm("Nottingham Forest FC") = "nottinghamforest", API → "Nottingham Forest" → coincidencia directa ✓
  "nottinghamforest":          ["nottmforest", "forest"],
  // norm("Arsenal FC") = "arsenal", API → "Arsenal" → coincidencia directa ✓
  "arsenal":                   ["arsenalfc"],
  "manchestercity":            ["mancity", "mancityfc"],
  "manchesterunited":          ["manunited", "manutd"],
  "newcastleunited":           ["newcastle", "newcastlefc"],
  "westhamunited":             ["westham", "westhamfc"],
  "tottenhamhotspur":          ["tottenham", "spurs"],
  "chelseafc":                 ["chelsea"],
  "liverpoolfc":               ["liverpool"],
  "astonvilla":                ["astonvillafc"],
  "evertonfc":                 ["everton"],
  "fulhamfc":                  ["fulham"],
  "wolverhamptonwanderers":    ["wolves", "wolverhampton"],
  "crystalpalace":             ["crystalpalacefc"],
  "bournemouth":               ["afcbournemouth", "bournemoouthfc"],
  "brentfordfc":               ["brentford"],
  "leedsunited":               ["leeds"],
  "burnleyfc":                 ["burnley"],
  "sheffieldunited":           ["sheffield", "sheffieldutd"],     // FIX: typo 'sheffieldUnited'
  "lutontown":                 ["luton"],
  "ipswich":                   ["ipswichtown"],
  "leicestercity":             ["leicester"],
  "southamptonfc":             ["southampton", "saints"],

  // Eredivisie — norm() de Firestore → alias con nombres cortos que usa The Odds API
  // norm("FC Utrecht") = "fcutrecht", API → "Utrecht" → norm = "utrecht" ✓
  "fcutrecht":                 ["utrecht"],
  // norm("AZ") = "az", API → "AZ Alkmaar" → norm = "azalkmaar" — necesita alias
  "az":                        ["azalkmaar", "alkmaar"],
  // norm("Heracles Almelo") = "heraclesalmelo", API → "Heracles" → norm = "heracles" ✓
  "heraclesalmelo":            ["heracles"],
  // norm("PSV") = "psv", API → "PSV Eindhoven" → norm = "psveindhoven" — necesita alias
  "psv":                       ["psveindhoven", "eindhoven"],
  // norm("NEC") = "nec", API → "NEC Nijmegen" → norm = "necnijmegen" — necesita alias
  "nec":                       ["necnijmegen", "nijmegen"],
  // norm("Fortuna Sittard") = "fortunasittard", API → "Fortuna Sittard" → coincidencia directa ✓
  "fortunasittard":            ["fortuna"],
  // norm("FC Twente '65") = "fctwente65", API → "Twente" → norm = "twente" — necesita alias
  "fctwente65":                ["twente", "fctwente"],
  // norm("Feyenoord Rotterdam") = "feyenoordrotterdam", API → "Feyenoord" → norm = "feyenoord" ✓
  "feyenoordrotterdam":        ["feyenoord"],
  // Otros equipos Eredivisie habituales
  "ajaxamsterdam":             ["ajax"],
  "ajaxfc":                    ["ajax"],
  "goaheadeagles":             ["goahead"],
  "scheracles":                ["heracles"],
  "rkcwaalwijk":               ["waalwijk", "rkc"],
  "sbvexcelsior":              ["excelsior"],
  "fcgroningen":               ["groningen"],
  "sparthaalkmaar":            ["sparthaalkmaar"],
  "nacacbreda":                ["nac", "nacbreda"],
  "pec zwolle":                ["peczwolle", "zwolle"],
  "fcemmen":                   ["emmen"],

  // Primeira Liga — norm() de Firestore → alias con nombres que usa The Odds API
  // norm("AVS") = "avs", API → "AVS" → coincidencia directa ✓ (pero por si acaso)
  "avs":                       ["avsfutebol", "avsfc"],
  // norm("CF Estrela da Amadora") = "cfestreladaamadora", API → "Estrela da Amadora" → norm = "estreladaamadora"
  "cfestreladaamadora":        ["estreladaamadora", "estrela", "amadora"],
  // Otros equipos Primeira Liga habituales
  "slbenfica":                 ["benfica", "slbenficafc"],
  "sportingcp":                ["sporting", "sportinglisboa"],
  "fcporto":                   ["porto"],
  "scbraga":                   ["braga"],
  "vitoriascguimaraes":        ["guimaraes", "vitoria"],
  "boavistafc":                ["boavista"],
  "cdnacional":                ["nacional"],
  "fcfarense":                 ["farense"],
  "gd chaves":                 ["chaves"],
  "moreirense":                ["moreirensefc"],
  "fcviseu":                   ["viseu"],
  "gilvicentefc":              ["gilvicente"],
};

// ─── Normalización ────────────────────────────────────────────────────────────
const SUFIJOS = [
  "football club","fc","cf","ac","sc","afc","bfc","ssc",
  "united","city","town","rovers","wanderers","athletic","atletico",
  "calcio","balompie",
];

function norm(s) {
  let n = (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const sufijo of SUFIJOS) {
    n = n.replace(new RegExp(`\\s+${sufijo}$`), "");
  }
  return n.replace(/\s+/g, "");
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}

function coinciden(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [menor, mayor] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (menor.length >= 4 && mayor.includes(menor)) return true;  // FIX: bajado de 5 a 4
  if (levenshtein(na, nb) <= 2) return true;
  // Comprobar aliases
  const aliasesA = TEAM_ALIASES[na] || [];
  const aliasesB = TEAM_ALIASES[nb] || [];
  if (aliasesA.some(al => al === nb || nb.includes(al) || al.includes(nb))) return true;
  if (aliasesB.some(al => al === na || na.includes(al) || al.includes(na))) return true;
  if (aliasesA.some(al => levenshtein(norm(al), nb) <= 2)) return true;
  if (aliasesB.some(al => levenshtein(norm(al), na) <= 2)) return true;  // FIX: bidireccional
  return false;
}

function limpiarNulos(obj) {
  for (const k of Object.keys(obj)) {
    if (obj[k] === null || obj[k] === undefined) delete obj[k];
  }
}

// ═══════════════════════════════════════════════════════════════
//  THE ODDS API
// ═══════════════════════════════════════════════════════════════

async function fetchOddsAPI(sportKey) {
  const url = `${ODDS_BASE}/sports/${sportKey}/odds` +
    `?apiKey=${ODDS_API_KEY}&regions=eu&markets=${encodeURIComponent(MARKETS)}&oddsFormat=decimal`;
  const res = await fetch(url);
  const restantes = res.headers.get("x-requests-remaining");
  const usado     = res.headers.get("x-requests-used");
  console.log(`[OddsAPI] ${sportKey} → ${res.status} | usado: ${usado} | restantes: ${restantes}`);
  if (res.status === 404) return [];
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Odds API ${res.status}: ${txt.slice(0, 120)}`);
  }
  return await res.json();
}

function elegirBookmakerOddsAPI(evento) {
  const priority = ["bet365", "pinnacle", "unibet", "williamhill", "betfair", "bwin"];
  for (const key of priority) {
    const book = evento.bookmakers?.find(b => b.key === key);
    if (book) return book;
  }
  return evento.bookmakers?.[0] || null;
}

function extraerCuotasOddsAPI(evento) {
  const book = elegirBookmakerOddsAPI(evento);
  if (!book) return null;
  const cuotas = { bookmaker: book.title };
  for (const market of (book.markets || [])) {
    const outs = market.outcomes || [];
    switch (market.key) {
      case "h2h":
        cuotas.local     = outs.find(o => o.name === evento.home_team)?.price ?? null;
        cuotas.empate    = outs.find(o => o.name === "Draw")?.price            ?? null;
        cuotas.visitante = outs.find(o => o.name === evento.away_team)?.price  ?? null;
        break;
      case "totals":
        for (const o of outs) {
          const p = parseFloat(o.point);
          if (isNaN(p)) continue;
          const key = p.toFixed(1).replace(".", "");
          if (o.name === "Over")  cuotas[`over${key}`]  = o.price;
          if (o.name === "Under") cuotas[`under${key}`] = o.price;
        }
        break;
    }
  }
  limpiarNulos(cuotas);
  return Object.keys(cuotas).length > 1 ? cuotas : null;
}

// ═══════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL — solo The Odds API
// ═══════════════════════════════════════════════════════════════

export async function actualizar_cuotas_completas(db, onProgress, opciones = {}) {
  const { soloOddsAPI = false, debugNombres = false } = opciones;
  const log = (tipo, msg, ligaId) => onProgress?.(tipo, msg, ligaId);
  let totalActualizados = 0, totalSinCuotas = 0;
  const errores = [];

  let snapshot;
  try {
    snapshot = await db.collection("partidos").where("estado", "==", "NS").get();
  } catch (err) {
    log("error", `Error leyendo Firestore: ${err.message}`);
    throw err;
  }

  if (snapshot.empty) {
    log("warn", "No hay partidos con estado NS en Firestore.");
    return { totalActualizados, totalSinCuotas, errores };
  }

  const porLiga = {};
  snapshot.docs.forEach(doc => {
    const d = doc.data();
    if (!d.ligaId || !ODDS_API_KEYS[d.ligaId]) return;
    if (!porLiga[d.ligaId]) porLiga[d.ligaId] = [];
    porLiga[d.ligaId].push({ ref: doc.ref, data: d });
  });

  const ligasIds = Object.keys(porLiga);

  if (!ligasIds.length) {
    log("warn", "Ningún partido NS tiene liga con cuotas disponibles en The Odds API.");
    return { totalActualizados, totalSinCuotas, errores };
  }

  log("info", `📡 The Odds API: ${ligasIds.length} liga(s)`);

  async function guardarCuotas(ref, data, cuotasNuevas, ligaId) {
    const snap = await ref.get();
    const cuotasExistentes = snap.data()?.cuotas || {};
    const cuotasMerged = { ...cuotasExistentes, ...cuotasNuevas };
    await ref.update({
      cuotas:    cuotasMerged,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    const mercados = [];
    if (cuotasMerged.local)  mercados.push("1X2");
    if (cuotasMerged.over25) mercados.push("O/U 2.5");
    if (cuotasMerged.over35) mercados.push("O/U 3.5");
    log("ok", `✓ ${data.local} vs ${data.visitante} [${mercados.join(", ") || "OK"}]`, ligaId);
  }

  for (let i = 0; i < ligasIds.length; i++) {
    const ligaId   = parseInt(ligasIds[i]);
    const sportKey = ODDS_API_KEYS[ligaId];
    const partidos = porLiga[ligaId];

    log("info", `[OddsAPI ${i+1}/${ligasIds.length}] ${sportKey} — ${partidos.length} partidos`, ligaId);

    let oddsData;
    try {
      oddsData = await fetchOddsAPI(sportKey);
    } catch (err) {
      log("error", `Error OddsAPI ${sportKey}: ${err.message}`, ligaId);
      errores.push(ligaId);
      if (i < ligasIds.length - 1) await esperar(600);
      continue;
    }

    if (!Array.isArray(oddsData) || !oddsData.length) {
      log("warn", `Sin eventos en Odds API para ${sportKey} — puede que no haya partidos en los próximos días`, ligaId);
      totalSinCuotas += partidos.length;
      if (i < ligasIds.length - 1) await esperar(600);
      continue;
    }

    log("info", `${oddsData.length} eventos recibidos`, ligaId);

    // Debug: muestra los nombres exactos que devuelve la API (activar si hay "No encontrado")
    if (debugNombres) {
      const nombres = oddsData.map(e => `"${e.home_team}" vs "${e.away_team}"`).join(" | ");
      log("info", `[DEBUG nombres API] ${nombres}`, ligaId);
    }

    let actualizadosLiga = 0, sinCuotasLiga = 0;

    for (const { ref, data } of partidos) {
      const evento = oddsData.find(ev =>
        coinciden(ev.home_team, data.local) && coinciden(ev.away_team, data.visitante)
      );

      if (!evento) {
        log("warn", `No encontrado: "${data.local}" vs "${data.visitante}"`, ligaId);
        sinCuotasLiga++; totalSinCuotas++;
        continue;
      }

      const cuotasNuevas = extraerCuotasOddsAPI(evento);
      if (!cuotasNuevas) {
        log("warn", `Sin bookmakers: ${data.local} vs ${data.visitante}`, ligaId);
        sinCuotasLiga++; totalSinCuotas++;
        continue;
      }

      try {
        await guardarCuotas(ref, data, cuotasNuevas, ligaId);
        actualizadosLiga++; totalActualizados++;
      } catch (err) {
        log("error", `Error guardando ${data.local} vs ${data.visitante}: ${err.message}`, ligaId);
      }
    }

    log(actualizadosLiga > 0 ? "ok" : "warn", `Liga ${ligaId}: ✓${actualizadosLiga} · ✗${sinCuotasLiga}`, ligaId);
    if (i < ligasIds.length - 1) await esperar(600);
  }

  const hayErrores = errores.length > 0;
  log(
    totalActualizados > 0 ? "ok" : "warn",
    `✅ Total: ${totalActualizados} actualizados · ${totalSinCuotas} sin cuotas${hayErrores ? ` · ${errores.length} errores` : ""}`,
  );
  if (hayErrores) {
    log("error", `❌ Errores en ligas: ${errores.join(", ")}`);
  }

  return { totalActualizados, totalSinCuotas, errores };
}

// ═══════════════════════════════════════════════════════════════
//  EXPORTACIÓN LEGACY — mantenida para compatibilidad con
//  adminpartidos.js (btn-cuotas-afb). Ya no hace nada útil.
//  Si quieres puedes eliminar el botón "Cuotas ligas secundarias"
//  del HTML y esta función.
// ═══════════════════════════════════════════════════════════════
export async function actualizar_cuotas_apifootball(db, onProgress) {
  const log = (tipo, msg) => onProgress?.(tipo, msg);
  log("warn", "⚠ API-Football eliminado — no aportaba cuotas en plan gratuito.");
  log("info", "ℹ Para cubrir ligas secundarias, amplía el plan de The Odds API o añade sus claves en ODDS_API_KEYS.");
  return { totalActualizados: 0, totalSinCuotas: 0, errores: [] };
}