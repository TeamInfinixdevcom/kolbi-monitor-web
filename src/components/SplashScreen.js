import React, { useEffect, useState } from "react";
import "./SplashScreen.css";

function SplashScreen({ onComplete }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Mostrar splash por 3.5 segundos
    const timer = setTimeout(() => {
      setFadeOut(true);
      // Después de fade out (0.5s), ejecutar callback
      setTimeout(() => {
        onComplete();
      }, 500);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`splash-screen ${fadeOut ? "fade-out" : ""}`}>
      <div className="splash-container">
        {/* Logo */}
        <img
          src="/infinix-dev-logo.png"
          alt="Infinix Dev"
          className="splash-logo"
        />

        {/* Texto */}
        <div className="splash-text">
          <h1>Infinix Dev</h1>
          <p>Soluciones Tecnológicas</p>
        </div>

        {/* Detalles de licencia */}
        <div className="splash-license">
          <p>
            <strong>Desarrollado por:</strong> Ruben Madrigal
          </p>
          <p>
            <strong>Licencia:</strong> INFINIX-KMS-2025-001
          </p>
          <p className="year">© 2025 Infinix Dev. Todos los derechos reservados.</p>
        </div>

        {/* Loading dots */}
        <div className="splash-loader">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

export default SplashScreen;
