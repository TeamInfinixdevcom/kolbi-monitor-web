import React, { useState } from "react";
import "./Login.css";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

function Login({ user, setUser, detectedUser, setDetectedUser }) {
  // Recuperar email guardado en localStorage si existe
  const [email, setEmail] = useState(
    () => localStorage.getItem("loginEmail") || "",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      // Buscar el usuario en Firestore y obtener el rol
      const { getFirestore, collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );
      const db = getFirestore();
      const usuariosRef = collection(db, "usuarios");
      const q = query(usuariosRef, where("correo", "==", email));
      const querySnapshot = await getDocs(q);
      let rol = "ejecutivo"; // Default
      let usuarioFirestore = null;
      if (!querySnapshot.empty) {
        querySnapshot.forEach((doc) => {
          usuarioFirestore = doc.data();
          rol = usuarioFirestore.rol || "ejecutivo";
        });
      }
      // Normalizar rol a minúsculas para comparaciones consistentes
      rol = String(rol || 'ejecutivo').toLowerCase();
      
      console.log(`✅ Login exitoso: ${email} con rol: ${rol}`);
      
      // Crear objeto user extendido con rol y otros datos de Firestore
      const userWithRol = {
        ...result.user,
        rol,
        ...usuarioFirestore,
      };
      setUser(userWithRol);
      // Guardar email en localStorage
      localStorage.setItem("loginEmail", email);
    } catch (err) {
      setError("Credenciales incorrectas o usuario no existe.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setEmail("");
    setPassword("");
    // Opcional: puedes limpiar el email guardado si no quieres que se recuerde tras logout
    // localStorage.removeItem("loginEmail");
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetMessage("");
    
    if (!resetEmail.trim()) {
      setResetMessage("Por favor ingresa tu correo");
      return;
    }

    try {
      // Llamar a la CloudFunction para enviar email de reset
      const response = await fetch("https://us-central1-kolbimonitorsells-infinix.cloudfunctions.net/sendPasswordReset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: resetEmail }),
      });

      if (!response.ok) {
        throw new Error("Error al enviar el correo de restablecimiento");
      }

      setResetMessage("✅ Se envió un link de restablecimiento a tu correo. Por favor, revisa tu bandeja de entrada.");
      setResetEmail("");
      
      // Cerrar modal después de 3 segundos
      setTimeout(() => {
        setShowResetModal(false);
        setResetMessage("");
      }, 3000);
    } catch (err) {
      setResetMessage("❌ Error: " + (err.message || "No se pudo enviar el correo"));
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src="/logo192.png" alt="Logo" className="login-logo" />
        <div className="login-title">Iniciar sesión</div>
        <div className="login-subtitle">Ingresa a tu cuenta</div>
        {user ? (
          <div style={{ textAlign: "center" }}>
            <p>
              Bienvenido, <b>{user.email}</b>
            </p>
            <button className="login-btn" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        ) : detectedUser ? (
          <div style={{ textAlign: "center" }}>
            <p>
              Se detectó una sesión activa: <b>{detectedUser.email || detectedUser.correo}</b>
            </p>
            <p style={{ color: '#444' }}>¿Deseas continuar con esta cuenta o cerrar sesión?</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <button
                className="login-btn"
                onClick={async () => {
                  // Confirmar: rellenar rol desde Firestore (FRESCO, sin caché) y hacer setUser
                  try {
                    const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
                    const db = getFirestore();
                    const correoUsuario = detectedUser.email || detectedUser.correo;
                    const q = query(collection(db, 'usuarios'), where('correo', '==', correoUsuario));
                    const snap = await getDocs(q);
                    
                    let rol = "ejecutivo";
                    let usuarioFirestore = null;
                    
                    if (!snap.empty) {
                      usuarioFirestore = snap.docs[0].data();
                      rol = usuarioFirestore.rol || "ejecutivo";
                    }
                    
                    console.log(`Usuario ${correoUsuario} cargado con rol: ${rol}`);
                    const userWithRol = { ...detectedUser, rol, ...usuarioFirestore };
                    setUser(userWithRol);
                    setDetectedUser(null);
                  } catch (err) {
                    console.error('Error al validar la sesión detectada:', err);
                    setError('Error al validar la sesión detectada.');
                  }
                }}
              >
                Continuar
              </button>
              <button
                className="login-btn"
                onClick={async () => {
                  // Cerrar sesión detectada completamente
                  try {
                    const { signOut } = await import('firebase/auth');
                    const { auth } = await import('../firebase');
                    await signOut(auth);
                    setDetectedUser(null);
                    setUser(null);
                    setEmail("");
                    setPassword("");
                    localStorage.removeItem("loginEmail");
                    console.log("Sesión cerrada completamente");
                  } catch (e) {
                    console.error("Error al cerrar sesión:", e);
                  }
                }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : (
          <>
            <form className="login-form" onSubmit={handleLogin}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo institucional"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                required
              />
              <button className="login-btn" type="submit">
                Ingresar
              </button>
              {error && <p style={{ color: "#c00", marginTop: 8 }}>{error}</p>}
            </form>
            <button 
              type="button"
              onClick={() => setShowResetModal(true)}
              style={{
                marginTop: 12,
                background: "none",
                border: "none",
                color: "#2563eb",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "0.9em"
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        )}
        <div className="login-footer">© 2025 Kolbi Monitor Sells</div>
      </div>

      {/* Modal para resetear contraseña */}
      {showResetModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "#fff",
            padding: 24,
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: 320,
            maxWidth: 400
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: "#333" }}>Recuperar contraseña</h3>
            <form onSubmit={handlePasswordReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Ingresa tu correo registrado"
                required
                style={{
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  fontSize: "0.95em"
                }}
              />
              <button
                type="submit"
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  padding: "10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: "0.95em",
                  fontWeight: 500
                }}
              >
                Enviar link de restablecimiento
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetEmail("");
                  setResetMessage("");
                }}
                style={{
                  background: "#f0f0f0",
                  border: "none",
                  padding: "10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: "0.95em"
                }}
              >
                Cancelar
              </button>
              {resetMessage && (
                <p style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 4,
                  textAlign: "center",
                  color: resetMessage.includes("❌") ? "#c00" : "#0a7a0a",
                  background: resetMessage.includes("❌") ? "#ffe6e6" : "#e6ffe6",
                  fontSize: "0.9em"
                }}>
                  {resetMessage}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Footer profesional */}
      <div className="login-powered-by">
        <span>Powered by</span>
        <strong>Infinix Dev</strong>
      </div>
    </div>
  );
}

export default Login;
