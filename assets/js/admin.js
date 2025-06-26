import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 1️⃣ Configura tu Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDgdI3UcnHuRlcynH-pCHcGORcGBAD3FSU",
  authDomain: "winnet-708db.firebaseapp.com",
  projectId: "winnet-708db",
  storageBucket: "winnet-708db.appspot.com",
  messagingSenderId: "869401097323",
  appId: "1:869401097323:web:fddb5e44af9d27a7cfed2e",
  measurementId: "G-12LH5QRVD0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2️⃣ Selección de elementos
const $ = id => document.getElementById(id);
const campos = ["deporte", "liga", "equipo1", "equipo2", "fecha", "hora", "cuota1", "cuotaX", "cuota2"]
  .reduce((o, c) => { o[c] = $(c); return o; }, {});
const msg = $("msg");

// 3️⃣ Evento para guardar partido
$("guardar").addEventListener("click", async () => {
  msg.textContent = "";

  for (const k of ["liga", "equipo1", "equipo2", "fecha", "hora", "cuota1", "cuotaX", "cuota2"]) {
    if (!campos[k].value.trim()) {
      msg.textContent = "Completa todos los campos.";
      return;
    }
  }

  const partido = {
    deporte: campos.deporte.value,
    liga: campos.liga.value.trim(),
    equipo1: campos.equipo1.value.trim(),
    equipo2: campos.equipo2.value.trim(),
    fecha: campos.fecha.value,
    hora: campos.hora.value,
    mercados: {
      resultado: {
        nombre: "Resultado final",
        opciones: [
          { nombre: `Gana ${campos.equipo1.value.trim()}`, valor: "1", cuota: parseFloat(campos.cuota1.value) },
          { nombre: "Empate", valor: "X", cuota: parseFloat(campos.cuotaX.value) },
          { nombre: `Gana ${campos.equipo2.value.trim()}`, valor: "2", cuota: parseFloat(campos.cuota2.value) }
        ]
      }
    }
  };

  try {
    await addDoc(collection(db, "partidos"), partido);
    msg.style.color = "lime";
    msg.textContent = "✅ Partido guardado";
    Object.values(campos).forEach(inp => inp.value = "");
  } catch (e) {
    console.error(e);
    msg.style.color = "tomato";
    msg.textContent = "⚠️ Error al guardar";
  }
});
