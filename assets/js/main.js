// Inicializar Firebase Auth y Firestore
const auth = firebase.auth();

// Scroll suave al principio al hacer clic en el logo
document.getElementById('logo-scroll').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Mostrar partidos
const partidosContainer = document.getElementById('partidos-container');

function mostrarPartidos() {
  partidosContainer.innerHTML = '<p>Cargando partidos...</p>';

  db.collection('partidos').get()
    .then(querySnapshot => {
      if (querySnapshot.empty) {
        partidosContainer.innerHTML = '<p>No hay partidos disponibles.</p>';
        return;
      }

      partidosContainer.innerHTML = '';
      querySnapshot.forEach(doc => {
        const partido = doc.data();
        const partidoDiv = document.createElement('div');
        partidoDiv.className = 'partido';
        partidoDiv.innerHTML = `
          <h3>${partido.equipo1} vs ${partido.equipo2}</h3>
          <p>Fecha: ${partido.fecha}</p>
          <p>Cuotas: Local ${partido.cuota1} - Empate ${partido.cuota2} - Visitante ${partido.cuota3}</p>
        `;
        partidosContainer.appendChild(partidoDiv);
      });
    })
    .catch(error => {
      console.error('Error al obtener partidos:', error);
      partidosContainer.innerHTML = '<p>Error cargando partidos.</p>';
    });
}

mostrarPartidos();

// Mostrar datos de usuario en header
const headerLeft = document.getElementById('header-left');
const headerRight = document.getElementById('header-right');

auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      const userData = userDoc.data();

      // Mostrar saldo a la izquierda
      headerLeft.innerHTML = userData
        ? `${parseFloat(userData.saldo).toFixed(2)} €`
        : '';

      // Mostrar nombre de usuario y menú desplegable a la derecha
      headerRight.innerHTML = `
        <div class="user-menu" style="position: relative;">
          <span class="username" style="cursor:pointer;">${userData.username || user.email}</span>
          <div class="dropdown-content" id="dropdown-menu" style="
              display: none;
              position: absolute;
              right: 0;
              top: 100%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              border-radius: 4px;
              padding: 10px;
              opacity: 0;
              transition: opacity 0.3s ease;
              z-index: 1000;
            ">
            <a href="#" id="logout-link">Cerrar sesión</a>
          </div>
        </div>
      `;

      // Mostrar menú al pasar el mouse o hacer clic
      const username = document.querySelector('.username');
      const dropdownMenu = document.getElementById('dropdown-menu');

      let isMenuVisible = false;

      username.addEventListener('mouseenter', () => {
        dropdownMenu.style.display = 'block';
        requestAnimationFrame(() => {
          dropdownMenu.style.opacity = '1';
        });
        isMenuVisible = true;
      });

      username.addEventListener('mouseleave', () => {
        setTimeout(() => {
          if (!isMenuVisible) return;
          dropdownMenu.style.opacity = '0';
          setTimeout(() => dropdownMenu.style.display = 'none', 300);
        }, 200);
      });

      dropdownMenu.addEventListener('mouseenter', () => {
        isMenuVisible = true;
        dropdownMenu.style.opacity = '1';
      });

      dropdownMenu.addEventListener('mouseleave', () => {
        isMenuVisible = false;
        dropdownMenu.style.opacity = '0';
        setTimeout(() => dropdownMenu.style.display = 'none', 300);
      });

      // Logout
      document.getElementById('logout-link').addEventListener('click', async (e) => {
        e.preventDefault();
        await auth.signOut();
        window.location.href = 'login.html';
      });

    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
    }

  } else {
    // Usuario no logueado
    headerLeft.innerHTML = `<a href="register.html">Registrarse</a>`;
    headerRight.innerHTML = `<a href="login.html">Iniciar sesión</a>`;
  }
});
