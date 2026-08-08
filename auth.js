/* ============================================================
   ACCESO RESTRINGIDO CON GOOGLE SIGN-IN
   ------------------------------------------------------------
   1) Reemplaza CLIENT_ID por el tuyo (termina en .apps.googleusercontent.com).
   2) Agrega los correos que quieres permitir en ALLOWED_EMAILS.
   3) Esos mismos correos deben estar como "Usuarios de prueba"
      en la pantalla de consentimiento OAuth de Google Cloud
      (mientras tu app esté en estado "Testing").

   Nota: esta validación ocurre en el navegador (GitHub Pages no
   tiene servidor). Es suficiente para controlar el acceso casual
   a un horario personal, pero no es una barrera de seguridad
   fuerte para datos sensibles.
   ============================================================ */

const AUTH_CONFIG = {
  clientId: '19010579320-2ssnlh7g51q5m9nndksnihqje1rbjiol.apps.googleusercontent.com',
  allowedEmails: [
    'alexandro.santoyo.b@uni.pe',
    'lexont01@gmail.com',
    'lexont02@gmail.com',
    'nayeli.robles.q@uni.pe',
    'paola.ruiz.g@uni.pe',
    'xalexito945@gmail.com'
  ],
  sessionHours: 24 // cuánto tiempo se recuerda la sesión en este navegador
};

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

function isAllowedEmail(email) {
  if (!email) return false;
  const allowed = AUTH_CONFIG.allowedEmails.map(e => e.trim().toLowerCase());
  return allowed.includes(email.trim().toLowerCase());
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem('uni_auth_session');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.email || !data.expires) return null;
    if (Date.now() > data.expires) {
      localStorage.removeItem('uni_auth_session');
      return null;
    }
    if (!isAllowedEmail(data.email)) return null;
    return data;
  } catch {
    return null;
  }
}

function storeSession(email, name, picture) {
  const expires = Date.now() + AUTH_CONFIG.sessionHours * 3600 * 1000;
  localStorage.setItem('uni_auth_session', JSON.stringify({ email, name, picture, expires }));
}

function removeOverlay() {
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.remove();
  document.body.classList.add('authenticated');
}

function renderUserBadge(name, picture, email) {
  const el = document.getElementById('userBadge');
  if (!el) return;
  const initials = (name || email || '?').trim().charAt(0).toUpperCase();
  el.innerHTML = picture
    ? `<img src="${picture}" alt="" referrerpolicy="no-referrer" /><span>${name || email}</span><button id="logoutBtn" title="Cerrar sesión">Salir</button>`
    : `<span class="user-badge-fallback">${initials}</span><span>${name || email}</span><button id="logoutBtn" title="Cerrar sesión">Salir</button>`;
  el.classList.remove('hidden');
  document.getElementById('logoutBtn').addEventListener('click', logout);
}

function grantAccess(email, name, picture) {
  storeSession(email, name, picture);
  removeOverlay();
  renderUserBadge(name, picture, email);
}

function logout() {
  localStorage.removeItem('uni_auth_session');
  location.reload();
}

function showDenied(email) {
  const status = document.getElementById('authStatus');
  if (!status) return;
  status.innerHTML = `
    <p class="auth-denied">La cuenta <strong>${email || 'seleccionada'}</strong> no tiene acceso a este horario.</p>
    <button id="retryBtn" class="ghost">Probar con otra cuenta</button>
  `;
  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
      status.innerHTML = '';
    });
  }
}

function handleCredentialResponse(response) {
  try {
    const payload = parseJwt(response.credential);
    if (payload.email_verified && isAllowedEmail(payload.email)) {
      grantAccess(payload.email, payload.name, payload.picture);
    } else {
      showDenied(payload.email);
    }
  } catch (err) {
    console.error('Error validando el inicio de sesión:', err);
    const status = document.getElementById('authStatus');
    if (status) status.innerHTML = '<p class="auth-denied">Ocurrió un error al iniciar sesión. Intenta nuevamente.</p>';
  }
}

function initAuth() {
  const existing = getStoredSession();
  if (existing) {
    removeOverlay();
    renderUserBadge(existing.name, existing.picture, existing.email);
    return;
  }

  waitForGoogleIdentity();
}

function waitForGoogleIdentity(attempts = 0) {
  if (window.google && google.accounts && google.accounts.id) {
    setupGoogleSignIn();
    return;
  }
  if (window.__gsiLoadFailed) {
    const status = document.getElementById('authStatus');
    if (status) status.innerHTML = '<p class="auth-denied">No se pudo cargar el inicio de sesión de Google (bloqueado por la red o un bloqueador de anuncios). Desactívalo o revisa tu conexión y recarga la página.</p>';
    return;
  }
  // Reintenta cada 150ms hasta ~9 segundos antes de mostrar error real
  if (attempts > 60) {
    const status = document.getElementById('authStatus');
    if (status) status.innerHTML = '<p class="auth-denied">No se pudo cargar el inicio de sesión de Google. Revisa tu conexión y recarga la página.</p>';
    return;
  }
  setTimeout(() => waitForGoogleIdentity(attempts + 1), 150);
}

function setupGoogleSignIn() {
  google.accounts.id.initialize({
    client_id: AUTH_CONFIG.clientId,
    callback: handleCredentialResponse
  });

  const btnSlot = document.getElementById('googleSignInBtn');
  if (btnSlot) {
    google.accounts.id.renderButton(btnSlot, {
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      width: 280
    });
  }

  google.accounts.id.prompt(); // intenta One Tap si el navegador lo permite
}

document.addEventListener('DOMContentLoaded', initAuth);
