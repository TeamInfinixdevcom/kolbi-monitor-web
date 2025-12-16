import React, { useState, useEffect } from "react";
import "./App.css";
import Login from "./components/Login";
import SupervisorDashboard from "./components/SupervisorDashboard";
import EjecutivoDashboard from "./components/EjecutivoDashboard";
import SplashScreen from "./components/SplashScreen";
import { auth } from "./firebase";


function App() {
  const [user, setUser] = useState(null);
  const [detectedUser, setDetectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // ===============================
    // 🔧 LIMPIAR CACHE AL CARGAR
    // ===============================
    // Limpiar localStorage completamente solo si es necesario
    // localStorage.clear();
    
    // ===============================
    // 🔧 CONFIGURACIÓN DE PRUEBAS
    // ===============================
    const FORCE_LOGOUT = false; // 👈 FALSE = Mantener sesión tras refresh

    if (FORCE_LOGOUT) {
      // 🔹 Siempre cerrar sesión para pruebas
      auth.signOut().catch(() => {});
      setUser(null);
      setDetectedUser(null);
      setLoading(false);
      console.log("[App] 🧹 Cache limpiado. Login manual requerido");
      return;
    }

    // ===============================
    // 🔐 MODO NORMAL (AUTO LOGIN)
    // ===============================
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        // Solo detectable, pero NO hace setUser automáticamente
        // Obliga al usuario a confirmar en el modal de Login
        setDetectedUser({ ...firebaseUser, correo: firebaseUser.email });
        console.log(`[App] Sesión detectada pero NO cargada automáticamente: ${firebaseUser.email}`);
      } else {
        setDetectedUser(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div>Cargando aplicación...</div>;

  // Mostrar splash screen primero
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="App window">
      {!user ? (
        <Login
          user={user}
          setUser={setUser}
          detectedUser={detectedUser}
          setDetectedUser={setDetectedUser}
        />
      ) : user.rol === "ejecutivo" ? (
        <EjecutivoDashboard user={user} />
      ) : (
        <SupervisorDashboard user={user} />
      )}
    </div>
  );
}

export default App;
