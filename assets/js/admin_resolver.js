// assets/js/admin_resolver.js
//
// Resuelve apuestas pendientes basándose en los resultados finales (FT)
// guardados en Firestore (colecciones: partidos + historial).
//
// Mercados soportados (detectados dinámicamente desde el campo 'mercado' de cada bet):
//   resultado        → 1X2 (local / Empate / visitante)
//   dobleoportunidad → DC (1X, X2, 12)
//   dnb              → Draw No Bet
//   ambosmarcan      → BTTS (Sí / No)
//   totalgoles       → Over/Under (X.Y goles)
//   descanso         → Resultado 1ª mitad (htLocal / htEmpate / htVisitante en Firestore)
//   segunda          → Resultado 2ª mitad
//
// Flujo recomendado:
//   1. Actualizar en vivo        (btn-vivo)
//   2. Resolver apuestas         (btn-resolver) ← este módulo
//   3. Archivar partidos FT      (btn-archivar)

/* ═══════════════════════════════════════════════════════════════
   HELPERS DE EVALUACIÓN
   Cada función recibe los datos del partido (Firestore)
   y la apuesta individual (bet), y devuelve true/false/null.
   null = no se puede evaluar (datos insuficientes).
═══════════════════════════════════════════════════════════════ */

function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** ¿El texto 'a' coincide con el nombre del equipo 'b'? */
function coincideEquipo(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Extrae el número de una cadena tipo "Más de 2.5 goles" → 2.5
 */
function extraerLinea(tipo) {
  const m = (tipo || '').match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

/**
 * Evalúa si una apuesta individual es ganadora.
 * @param {object} bet    - { tipo, mercado, cuota, partidoId }
 * @param {object} datos  - datos del partido desde Firestore
 * @returns {boolean|null}
 */
function evaluarBet(bet, datos) {
  const mercado = (bet.mercado || '').toLowerCase().replace(/[\s-]/g, '');
  const tipo    = (bet.tipo    || '');
  const tipoL   = tipo.toLowerCase();

  const gl = datos.golesLocal     ?? null;
  const gv = datos.golesVisitante ?? null;
  const totalGoles = (gl !== null && gv !== null) ? gl + gv : null;

  // ── 1X2 ────────────────────────────────────────────────────
  if (mercado === 'resultado') {
    if (gl === null || gv === null) return null;
    if (tipoL === 'empate') return gl === gv;
    if (coincideEquipo(tipo, datos.local))     return gl > gv;
    if (coincideEquipo(tipo, datos.visitante)) return gv > gl;
    return null;
  }

  // ── Doble oportunidad ──────────────────────────────────────
  if (mercado === 'dobleoportunidad') {
    if (gl === null || gv === null) return null;
    const local     = datos.local     || '';
    const visitante = datos.visitante || '';

    // El tipo guardado en el bet es: "<Local> o Empate", "<Local> o <Visitante>", "Empate o <Visitante>"
    const esLocalEmpate    = tipoL.includes('empate') && !tipoL.includes(norm(visitante)) && (tipoL.includes(norm(local))     || tipoL.startsWith('1x') || tipoL.includes('o empate'));
    const esLocalVisitante = tipoL.includes('12')     || (tipoL.includes(norm(local)) && tipoL.includes(norm(visitante)));
    const esEmpateVisitante= tipoL.includes('x2')     || (tipoL.includes('empate') && tipoL.includes(norm(visitante)));

    if (esLocalEmpate)     return gl >= gv;          // local gana o empate
    if (esLocalVisitante)  return gl !== gv;          // no hay empate
    if (esEmpateVisitante) return gv >= gl;           // visitante gana o empate
    return null;
  }

  // ── Draw No Bet ────────────────────────────────────────────
  if (mercado === 'dnb') {
    if (gl === null || gv === null) return null;
    if (gl === gv) return null; // empate → devolver stake (se trata en resolver)
    if (coincideEquipo(tipo.replace(/^dnb:\s*/i, ''), datos.local))     return gl > gv;
    if (coincideEquipo(tipo.replace(/^dnb:\s*/i, ''), datos.visitante)) return gv > gl;
    return null;
  }

  // ── Ambos marcan (BTTS) ────────────────────────────────────
  if (mercado === 'ambosmarcan') {
    if (gl === null || gv === null) return null;
    const ambosMarcan = gl > 0 && gv > 0;
    if (tipoL === 'sí' || tipoL === 'si') return ambosMarcan;
    if (tipoL === 'no')                   return !ambosMarcan;
    return null;
  }

  // ── Total goles ────────────────────────────────────────────
  if (mercado === 'totalgoles') {
    if (totalGoles === null) return null;
    const linea = extraerLinea(tipo);
    if (linea === null) return null;
    if (tipoL.includes('más de') || tipoL.includes('mas de') || tipoL.startsWith('over')) {
      return totalGoles > linea;
    }
    if (tipoL.includes('menos de') || tipoL.startsWith('under')) {
      return totalGoles < linea;
    }
    return null;
  }

  // ── Resultado 1ª mitad ─────────────────────────────────────
  if (mercado === 'descanso') {
    // Los goles de descanso se guardan como golesLocalHT / golesVisitanteHT
    // (o en cuotas.htGoles... según lo que tengas en Firestore)
    // Usamos golesLocalHT + golesVisitanteHT si existen
    const htL = datos.golesLocalHT     ?? datos.htGolesLocal     ?? null;
    const htV = datos.golesVisitanteHT ?? datos.htGolesVisitante ?? null;
    if (htL === null || htV === null) return null;

    const tipoLimpio = tipo.replace(/^ht1?:\s*/i, '').trim();
    if (tipoLimpio.toLowerCase() === 'empate') return htL === htV;
    if (coincideEquipo(tipoLimpio, datos.local))     return htL > htV;
    if (coincideEquipo(tipoLimpio, datos.visitante)) return htV > htL;
    return null;
  }

  // ── Resultado 2ª mitad ─────────────────────────────────────
  if (mercado === 'segunda') {
    const h2L = datos.golesLocalH2     ?? datos.h2GolesLocal     ?? null;
    const h2V = datos.golesVisitanteH2 ?? datos.h2GolesVisitante ?? null;
    if (h2L === null || h2V === null) return null;

    const tipoLimpio = tipo.replace(/^ht2?:\s*/i, '').trim();
    if (tipoLimpio.toLowerCase() === 'empate') return h2L === h2V;
    if (coincideEquipo(tipoLimpio, datos.local))     return h2L > h2V;
    if (coincideEquipo(tipoLimpio, datos.visitante)) return h2V > h2L;
    return null;
  }

  // Mercado desconocido
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   RESOLUCIÓN DE UNA APUESTA COMPLETA
═══════════════════════════════════════════════════════════════ */

/**
 * @param {object} apuesta    - documento completo de Firestore (apuestas)
 * @param {Map}    partidosMap - Map<partidoId(string), datosPartido>
 * @returns {{ estado, ganancia, motivo }}
 *   estado: 'ganada' | 'perdida' | 'devuelta' | 'pendiente'
 *   ganancia: cantidad a SUMAR al saldo (0 si pierde, stake si devuelta)
 *   motivo: string legible
 */
function resolverApuesta(apuesta, partidosMap) {
  const { tipo, stake, totalOdds, potentialWin, bets, sistema } = apuesta;

  // ── SIMPLE o COMBINADA ──────────────────────────────────────
  if (tipo === 'simple' || tipo === 'combinada') {
    const resultados = bets.map(bet => {
      const datos = partidosMap.get(String(bet.partidoId));
      if (!datos) return { bet, resultado: null, razon: 'Partido no encontrado o no finalizado' };

      // Draw No Bet con empate → devolver
      const mercado = (bet.mercado || '').toLowerCase().replace(/[\s-]/g, '');
      if (mercado === 'dnb') {
        const gl = datos.golesLocal ?? null, gv = datos.golesVisitante ?? null;
        if (gl !== null && gv !== null && gl === gv) {
          return { bet, resultado: 'devuelta', razon: 'Draw No Bet: empate → devuelto' };
        }
      }

      const ganada = evaluarBet(bet, datos);
      return {
        bet,
        resultado: ganada === null ? null : ganada ? 'ganada' : 'perdida',
        razon: ganada === null ? 'Datos insuficientes' : '',
      };
    });

    // Si alguna apuesta no tiene datos finales → sigue pendiente
    if (resultados.some(r => r.resultado === null)) {
      return { estado: 'pendiente', ganancia: 0, motivo: 'Algún partido aún no tiene resultado final.' };
    }

    // Sistema de devolución en combinadas con DNB empate
    const devueltas = resultados.filter(r => r.resultado === 'devuelta');
    const perdidas  = resultados.filter(r => r.resultado === 'perdida');
    const ganadas   = resultados.filter(r => r.resultado === 'ganada');

    if (perdidas.length > 0) {
      return {
        estado:   'perdida',
        ganancia: 0,
        motivo:   `Perdida. Fallo(s): ${perdidas.map(r => r.bet.tipo).join(', ')}`,
      };
    }

    // Todas ganadas o devueltas
    if (devueltas.length === bets.length) {
      // Todas DNB con empate → devolver stake completo
      return { estado: 'devuelta', ganancia: stake, motivo: 'Todas las selecciones DNB terminaron en empate.' };
    }

    // Cuota combinada recalculada sin las devueltas (factor 1 en esas)
    const betsActivos = bets.filter((_, i) => resultados[i].resultado !== 'devuelta');
    const cuotaFinal  = betsActivos.reduce((acc, b) => acc * parseFloat(b.cuota), 1);
    const ganancia    = Math.round(stake * cuotaFinal * 100) / 100;

    return {
      estado:   'ganada',
      ganancia,
      motivo:   `Ganada. Cuota final: ${cuotaFinal.toFixed(2)} | Ganancia: ${ganancia.toFixed(2)} €`,
    };
  }

  // ── SISTEMA ─────────────────────────────────────────────────
  if (tipo === 'sistema') {
    const { k, n, combos } = sistema || {};
    if (!k || !n || !bets?.length) {
      return { estado: 'pendiente', ganancia: 0, motivo: 'Datos de sistema incompletos.' };
    }

    const resultadosBets = bets.map(bet => {
      const datos  = partidosMap.get(String(bet.partidoId));
      if (!datos)  return null;
      return evaluarBet(bet, datos);
    });

    if (resultadosBets.some(r => r === null)) {
      return { estado: 'pendiente', ganancia: 0, motivo: 'Algún partido del sistema aún no ha finalizado.' };
    }

    // Generar todas las combinaciones de tamaño k
    function combinaciones(arr, k) {
      if (k === 1) return arr.map((x, i) => [i]);
      const result = [];
      for (let i = 0; i <= arr.length - k; i++) {
        combinaciones(arr.slice(i + 1), k - 1).forEach(c => result.push([i, ...c.map(j => j + i + 1)]));
      }
      return result;
    }

    const stakeCombo = stake; // stake por combinación
    const combosArr  = combinaciones(bets, k);
    let gananciaTotal = 0;
    let combosGanados = 0;

    for (const indices of combosArr) {
      const ganaCombinacion = indices.every(i => resultadosBets[i] === true);
      if (ganaCombinacion) {
        const cuotaCombo = indices.reduce((acc, i) => acc * parseFloat(bets[i].cuota), 1);
        gananciaTotal += Math.round(stakeCombo * cuotaCombo * 100) / 100;
        combosGanados++;
      }
    }

    const estadoFinal = gananciaTotal > 0 ? 'ganada' : 'perdida';
    return {
      estado:   estadoFinal,
      ganancia: Math.round(gananciaTotal * 100) / 100,
      motivo:   `Sistema ${k}/${n}: ${combosGanados}/${combosArr.length} combos ganados. Retorno: ${gananciaTotal.toFixed(2)} €`,
    };
  }

  return { estado: 'pendiente', ganancia: 0, motivo: 'Tipo de apuesta desconocido.' };
}

/* ═══════════════════════════════════════════════════════════════
   FUNCIÓN PRINCIPAL EXPORTADA
═══════════════════════════════════════════════════════════════ */

/**
 * resolver_apuestas(db, onProgress)
 *
 * 1. Carga todos los partidos FT (de 'partidos' e 'historial')
 * 2. Carga todas las apuestas 'pendiente'
 * 3. Por cada apuesta, intenta resolverla
 * 4. Actualiza saldo del usuario y marca la apuesta como ganada/perdida/devuelta
 *
 * @param {FirebaseFirestore} db
 * @param {function}          onProgress(msg, tipo) - callback para log
 * @returns {{ resueltas, ganadas, perdidas, devueltas, pendientes, errores }}
 */
export async function resolver_apuestas(db, onProgress) {
  const log = (msg, tipo = 'info') => onProgress?.(msg, tipo);

  const stats = { resueltas: 0, ganadas: 0, perdidas: 0, devueltas: 0, pendientes: 0, errores: 0 };

  // ── 1. Cargar partidos finalizados (FT) ──────────────────────
  log('📂 Cargando partidos finalizados...');

  const [snapPartidosFT, snapHistorial] = await Promise.all([
    db.collection('partidos').where('estado', '==', 'FT').get(),
    db.collection('historial').get(),
  ]);

  // Construimos un Map<partidoId(string) → datos>
  const partidosMap = new Map();
  snapPartidosFT.docs.forEach(d => partidosMap.set(d.id, d.data()));
  snapHistorial.docs.forEach(d => {
    if (!partidosMap.has(d.id)) partidosMap.set(d.id, d.data());
  });

  log(`📋 ${partidosMap.size} partidos finalizados disponibles para resolver.`);

  if (!partidosMap.size) {
    log('⚠ No hay partidos FT. Ejecuta primero "Actualizar en vivo".', 'warn');
    return stats;
  }

  // ── 2. Cargar apuestas pendientes ────────────────────────────
  log('🔍 Buscando apuestas pendientes...');
  const snapApuestas = await db.collection('apuestas').where('estado', '==', 'pendiente').get();

  if (snapApuestas.empty) {
    log('ℹ No hay apuestas pendientes.', 'info');
    return stats;
  }

  log(`🎯 ${snapApuestas.size} apuesta(s) pendiente(s) encontradas.`);

  // ── 3. Resolver cada apuesta ─────────────────────────────────
  for (const docApuesta of snapApuestas.docs) {
    const apuesta = docApuesta.data();

    // Verificamos si TODOS los partidos de esta apuesta tienen resultado
    const todosLosPartidos = [...new Set((apuesta.bets || []).map(b => String(b.partidoId)))];
    const todosFinalizados = todosLosPartidos.every(pid => partidosMap.has(pid));

    if (!todosFinalizados) {
      stats.pendientes++;
      continue; // No tocar, aún faltan resultados
    }

    try {
      const { estado, ganancia, motivo } = resolverApuesta(apuesta, partidosMap);

      if (estado === 'pendiente') {
        stats.pendientes++;
        log(`⏳ Apuesta ${docApuesta.id} sigue pendiente: ${motivo}`, 'info');
        continue;
      }

      // ── Batch: actualizar apuesta + saldo usuario ────────────
      const batch = db.batch();

      batch.update(docApuesta.ref, {
        estado,
        ganancia,
        motivo,
        resueltaEn: firebase.firestore.FieldValue.serverTimestamp(),
      });

      if (ganancia > 0) {
        const userRef = db.collection('usuarios').doc(apuesta.usuarioId);
        batch.update(userRef, {
          saldo: firebase.firestore.FieldValue.increment(ganancia),
        });
      }

      await batch.commit();

      stats.resueltas++;
      if      (estado === 'ganada')   { stats.ganadas++;   log(`✅ [${estado.toUpperCase()}] ${motivo}`, 'ok'); }
      else if (estado === 'perdida')  { stats.perdidas++;  log(`❌ [${estado.toUpperCase()}] ${motivo}`, 'error'); }
      else if (estado === 'devuelta') { stats.devueltas++; log(`↩ [${estado.toUpperCase()}] ${motivo}`, 'warn'); }

    } catch (err) {
      stats.errores++;
      log(`❌ Error procesando apuesta ${docApuesta.id}: ${err.message}`, 'error');
    }
  }

  // ── 4. Resumen ───────────────────────────────────────────────
  log(
    `📊 Resumen: ${stats.resueltas} resueltas ` +
    `(${stats.ganadas} ganadas · ${stats.perdidas} perdidas · ${stats.devueltas} devueltas) · ` +
    `${stats.pendientes} aún pendientes · ${stats.errores} errores`,
    stats.errores > 0 ? 'warn' : 'ok'
  );

  return stats;
}