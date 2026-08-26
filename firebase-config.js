/* ============================================================
   CONFIGURACIÓN DE FIREBASE
   ------------------------------------------------------------
   Reemplaza los valores de abajo por los de TU proyecto:
   Firebase Console → ⚙️ Configuración del proyecto → General
   → "Tus apps" → tu app web → SDK setup and configuration.
   ============================================================ */

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.warn('No se pudo inicializar Firebase (revisa firebase-config.js). El horario seguirá funcionando solo en este navegador:', e);
  }
} else {
  console.warn('El SDK de Firebase no se cargó. La sincronización en la nube no estará disponible.');
}
