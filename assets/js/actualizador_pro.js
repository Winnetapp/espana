// actualizador_pro.js
// Actualizador automático PRO con posibilidad de activar mercados adicionales

import { importar_partidos_api, actualizar_cuotas_api, actualizar_resultados_api } from "./integracion_api_firebase.js";

// =======================
// 1️⃣ Importar próximos partidos al iniciar
// =======================
(async () => {
  await importar_partidos_api();
  console.log("✅ Partidos importados al iniciar");
})();

// =======================
// 2️⃣ Timer para actualizar cuotas pre-partido cada 15 minutos
// =======================
setInterval(async () => {
  try {
    await actualizar_cuotas_api();
    console.log("🔹 Cuotas actualizadas (API)");
  } catch (err) {
    console.error("Error actualizando cuotas:", err);
  }
}, 15 * 60 * 1000); // 15 minutos

// =======================
// 3️⃣ Timer para actualizar resultados en vivo cada 2 minutos
// =======================
setInterval(async () => {
  try {
    await actualizar_resultados_api();
    console.log("🔹 Resultados actualizados (API)");
  } catch (err) {
    console.error("Error actualizando resultados:", err);
  }
}, 2 * 60 * 1000); // 2 minutos

// =======================
// 4️⃣ Timer para calcular mercados PRO cada 5 min (opcional)
// =======================
setInterval(async () => {
  try {
    // ⚠️ Para activar los mercados PRO, descomenta la línea dentro de esta función
    // await calcular_mercados_pro(); 

    console.log("🔹 Mercados PRO calculados (si están activos)");
  } catch (err) {
    console.error("Error calculando mercados PRO:", err);
  }
}, 5 * 60 * 1000); // 5 minutos

console.log("🟢 Actualizador PRO iniciado");