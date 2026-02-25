// actualizador_automatico.js
// Actualiza automáticamente partidos, cuotas y resultados usando Bzzoiro + Firebase

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
  } catch (err) {
    console.error("Error actualizando resultados:", err);
  }
}, 2 * 60 * 1000); // 2 minutos

console.log("🟢 Actualizador automático iniciado");