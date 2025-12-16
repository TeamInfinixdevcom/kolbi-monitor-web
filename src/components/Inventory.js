import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, addDoc, onSnapshot } from "firebase/firestore";

function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, "inventario"), (querySnapshot) => {
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Simple form to add an item (for demo)
  const [imei, setImei] = useState("");
  const [marca, setMarca] = useState("");
  const [terminal, setTerminal] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "inventario"), {
      imei,
      marca,
      terminal,
      estado: "DISPONIBLE",
    });
    setImei("");
    setMarca("");
    setTerminal("");
    // No es necesario refrescar manualmente, onSnapshot lo hará automáticamente
  };

  return (
    <div>
      <h2>Inventario</h2>
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table border="1">
          <thead>
            <tr>
              <th>IMEI</th>
              <th>Marca</th>
              <th>Terminal</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.imei}</td>
                <td>{item.marca}</td>
                <td>{item.terminal}</td>
                <td style={{ color: item.estado && item.estado.toLowerCase() === "vendido" ? "purple" : undefined, fontWeight: item.estado && item.estado.toLowerCase() === "vendido" ? "bold" : undefined }}>
                  {item.estado}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Agregar nuevo IMEI</h3>
      <form onSubmit={handleAdd}>
        <input
          value={imei}
          onChange={(e) => setImei(e.target.value)}
          placeholder="IMEI"
          required
        />
        <input
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Marca"
          required
        />
        <input
          value={terminal}
          onChange={(e) => setTerminal(e.target.value)}
          placeholder="Terminal"
          required
        />
        <button type="submit">Agregar</button>
      </form>
    </div>
  );
}

export default Inventory;
