/* =====================================================
   assets/js/auth.js — Winnet
   · Registro y login con Firebase
   · Validación inline en tiempo real
   · El header lo maneja main.js
   ===================================================== */

const auth = firebase.auth();
const db   = firebase.firestore();

/* ════════════════════════════════════════════════════
   HELPERS UI
════════════════════════════════════════════════════ */
function setFieldError(inputId, errId, msg) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errId);
  if (!input || !err) return;
  if (msg) {
    input.classList.add('error');
    input.classList.remove('ok');
    err.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
  } else {
    input.classList.remove('error');
    input.classList.add('ok');
    err.textContent = '';
  }
}

function clearFieldError(inputId, errId) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errId);
  if (input) input.classList.remove('error', 'ok');
  if (err)   err.textContent = '';
}

function showGlobalError(errBoxId, textId, msg) {
  const box  = document.getElementById(errBoxId);
  const text = document.getElementById(textId);
  if (!box) return;
  if (msg) {
    if (text) text.textContent = msg;
    box.classList.add('visible');
  } else {
    box.classList.remove('visible');
  }
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

/* ════════════════════════════════════════════════════
   REGISTRO
════════════════════════════════════════════════════ */
const registerForm = document.getElementById('register-form');
if (registerForm) {

  document.getElementById('username')?.addEventListener('blur', () => {
    const val = document.getElementById('username').value.trim();
    if (!val) setFieldError('username', 'err-username', 'El nombre de usuario es obligatorio.');
    else if (val.length < 3) setFieldError('username', 'err-username', 'Mínimo 3 caracteres.');
    else setFieldError('username', 'err-username', null);
  });

  document.getElementById('email')?.addEventListener('blur', () => {
    const val = document.getElementById('email').value.trim();
    const re  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val) setFieldError('email', 'err-email', 'El correo es obligatorio.');
    else if (!re.test(val)) setFieldError('email', 'err-email', 'Introduce un correo válido.');
    else setFieldError('email', 'err-email', null);
  });

  document.getElementById('password')?.addEventListener('blur', () => {
    const val = document.getElementById('password').value;
    if (!val) setFieldError('password', 'err-password', 'La contraseña es obligatoria.');
    else if (val.length < 6) setFieldError('password', 'err-password', 'Mínimo 6 caracteres.');
    else setFieldError('password', 'err-password', null);
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showGlobalError('register-error', 'register-error-text', null);

    const username = document.getElementById('username')?.value.trim()  || '';
    const email    = document.getElementById('email')?.value.trim()     || '';
    const password = document.getElementById('password')?.value         || '';
    const terms    = document.getElementById('terms-row')?.classList.contains('checked');

    let hasError = false;

    if (!username || username.length < 3) {
      setFieldError('username', 'err-username', 'El nombre de usuario es obligatorio (mín. 3 caracteres).');
      hasError = true;
    }

    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !re.test(email)) {
      setFieldError('email', 'err-email', 'Introduce un correo electrónico válido.');
      hasError = true;
    }

    if (!password || password.length < 6) {
      setFieldError('password', 'err-password', 'La contraseña debe tener al menos 6 caracteres.');
      hasError = true;
    }

    if (!terms) {
      const errTerms = document.getElementById('err-terms');
      if (errTerms) errTerms.innerHTML = '<i class="fas fa-exclamation-circle"></i> Debes aceptar los términos para continuar.';
      hasError = true;
    }

    if (hasError) return;

    setLoading('btn-register', true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('usuarios').doc(cred.user.uid).set({
        username,
        email: cred.user.email,
        saldo: 5.0,
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
      window.location.href = 'index.html';
    } catch (err) {
      setLoading('btn-register', false);
      showGlobalError('register-error', 'register-error-text', traducirError(err.code));
    }
  });
}

/* ════════════════════════════════════════════════════
   LOGIN
════════════════════════════════════════════════════ */
const loginForm = document.getElementById('login-form');
if (loginForm) {

  document.getElementById('email')?.addEventListener('blur', () => {
    const val = document.getElementById('email').value.trim();
    const re  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val) setFieldError('email', 'err-email', 'El correo es obligatorio.');
    else if (!re.test(val)) setFieldError('email', 'err-email', 'Introduce un correo válido.');
    else setFieldError('email', 'err-email', null);
  });

  document.getElementById('password')?.addEventListener('input', () => {
    clearFieldError('password', 'err-password');
    showGlobalError('login-error', 'login-error-text', null);
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showGlobalError('login-error', 'login-error-text', null);

    const email    = document.getElementById('email')?.value.trim() || '';
    const password = document.getElementById('password')?.value     || '';

    let hasError = false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !re.test(email)) {
      setFieldError('email', 'err-email', 'Introduce un correo electrónico válido.');
      hasError = true;
    }
    if (!password) {
      setFieldError('password', 'err-password', 'Introduce tu contraseña.');
      hasError = true;
    }
    if (hasError) return;

    setLoading('btn-login', true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = 'index.html';
    } catch (err) {
      setLoading('btn-login', false);
      showGlobalError('login-error', 'login-error-text', 'Correo o contraseña incorrectos.');
      document.getElementById('password')?.classList.add('error');
    }
  });
}

/* ════════════════════════════════════════════════════
   TRADUCCIONES ERROR FIREBASE
════════════════════════════════════════════════════ */
function traducirError(code) {
  const errores = {
    'auth/email-already-in-use':   'Este correo ya está registrado. ¿Quieres iniciar sesión?',
    'auth/invalid-email':          'El formato del correo no es válido.',
    'auth/weak-password':          'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests':      'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/network-request-failed': 'Error de conexión. Comprueba tu red.',
  };
  return errores[code] || 'Ha ocurrido un error. Inténtalo de nuevo.';
}