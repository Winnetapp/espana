const auth = firebase.auth();
const db = firebase.firestore();

/** REGISTRO DE USUARIO **/
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = registerForm['username'].value.trim();
    const email = registerForm['email'].value.trim();
    const password = registerForm['password'].value;

    if (!username) {
      alert('Por favor, introduce un nombre de usuario.');
      return;
    }

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const user = cred.user;

      // Crear documento en Firestore con nombre de usuario y saldo inicial
      await db.collection('usuarios').doc(user.uid).set({
        username: username,
        email: user.email,
        saldo: 5.0,
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert('Usuario registrado correctamente con 5 € de bienvenida.');
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Error al registrar:', err.message);
      alert(err.message);
    }
  });
}

/** LOGIN DE USUARIO **/
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginForm['email'].value;
    const password = loginForm['password'].value;

    try {
      await auth.signInWithEmailAndPassword(email, password);
      alert('Inicio de sesión exitoso');
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Error al iniciar sesión:', err.message);
      alert('Correo o contraseña incorrectos');
    }
  });
}

/** CERRAR SESIÓN (opcional si tienes un botón logout) **/
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await auth.signOut();
      alert('Sesión cerrada correctamente');
      window.location.href = 'login.html';
    } catch (err) {
      console.error('Error al cerrar sesión:', err.message);
    }
  });
}
