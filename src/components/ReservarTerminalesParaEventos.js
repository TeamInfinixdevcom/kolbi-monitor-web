import React, { useState, useEffect } from "react";
    import { db } from "../firebase";
    import {
        collection,
        getDocs,
        query,
        where,
        doc,
        updateDoc,
        Timestamp,
        getDoc,
        onSnapshot
    } from "firebase/firestore";
    import "./ReservarTerminales.css";

    export default function ReservarTerminalesParaEventos() {
        const [imeiInput, setImeiInput] = useState("");
        const [eventos, setEventos] = useState([]); // eventos activos
        const [loading, setLoading] = useState(false);
        const [msg, setMsg] = useState("");
        const [eventoSeleccionado, setEventoSeleccionado] = useState("");
        // Persistencia local de reservados
        const [reservados, setReservados] = useState(() => {
            try {
                const raw = localStorage.getItem("reservados_evento");
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        });
    // Guardar en localStorage cada vez que cambia la lista
    useEffect(() => {
        try {
            localStorage.setItem("reservados_evento", JSON.stringify(reservados));
        } catch {}
    }, [reservados]);
        const [inventario, setInventario] = useState([]); // inventario en tiempo real
        const [historialEventos, setHistorialEventos] = useState([]);
        const [filtroFecha, setFiltroFecha] = useState("");
        const [filtroImei, setFiltroImei] = useState("");
        const [filtroSerie, setFiltroSerie] = useState("");

        // Cargar eventos activos (fecha >= hoy)
        useEffect(() => {
            const fetchEventos = async () => {
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const eventosRef = collection(db, "marketing_events");
                const qEv = query(eventosRef, where("date", ">=", Timestamp.fromDate(hoy)));
                const snap = await getDocs(qEv);
                setEventos(
                    snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.seconds - b.date.seconds)
                );
            };
            fetchEventos();
        }, []);

        // Escuchar inventario en tiempo real
        useEffect(() => {
            const unsub = onSnapshot(collection(db, "inventario"), (snapshot) => {
                setInventario(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
            });
            return () => unsub();
        }, []);

        // Buscar y reservar IMEI usando inventario en tiempo real
        const handleBuscarYReservar = async () => {
            setMsg("");
            setLoading(true);
            try {
                const imeiTrim = imeiInput.trim();
                const found = inventario.find(item => String(item.imei) === imeiTrim);
                if (!found) {
                    setMsg("IMEI no encontrado ❌");
                } else if (String(found.estado || "").toLowerCase() !== "disponible") {
                    setMsg(`El IMEI no está disponible (estado: ${found.estado})`);
                } else if (reservados.some(r => r.imei === found.imei)) {
                    setMsg("Ya está en la lista de reservados");
                } else {
                    // Reservar en Firestore
                    await updateDoc(doc(db, "inventario", found.id), { estado: "reservado" });
                    setReservados(prev => [...prev, found]);
                    setMsg("IMEI reservado temporalmente");
                }
            } catch (err) {
                setMsg("Error buscando IMEI: " + err.message);
            } finally {
                setLoading(false);
                setImeiInput("");
            }
        };

        // Liberar IMEI (volver a disponible)
        const handleLiberar = async (item) => {
            try {
                await updateDoc(doc(db, "inventario", item.id), { estado: "disponible" });
                setReservados(prev => prev.filter(r => r.id !== item.id));
                setMsg(`IMEI ${item.imei} liberado`);
            } catch (err) {
                setMsg("Error liberando IMEI: " + err.message);
            }
        };

        // Asignar todos los reservados a un evento
    const handleAsignarGrupo = async (eventoId) => {
            if (!eventoId || reservados.length === 0) return;
            setMsg("");
            try {
                // --- VALIDACIÓN: IMEIs ya asignados a otros eventos ---
                const eventosSnap = await getDocs(collection(db, "marketing_events"));
                const imeisAsignadosOtros = new Set();
                eventosSnap.forEach(ev => {
                    if (ev.id !== eventoId) {
                        const data = ev.data();
                        (data.imeisAsignados || []).forEach(id => imeisAsignadosOtros.add(id));
                    }
                });
                const duplicados = reservados.map(r => r.id).filter(id => imeisAsignadosOtros.has(id));
                if (duplicados.length > 0) {
                    setMsg(`Los siguientes IMEIs ya están asignados a otro evento: ${duplicados.join(", ")}`);
                    return;
                }
                // 1. Actualizar inventario: asignado_evento
                for (const item of reservados) {
                    await updateDoc(doc(db, "inventario", item.id), { asignado_evento: eventoId });
                }
                // 2. Agregar todos los IDs al array imeisAsignados del evento
                const eventoRef = doc(db, "marketing_events", eventoId);
                const eventoSnap = await getDoc(eventoRef);
                let imeisAsignados = [];
                if (eventoSnap.exists()) {
                    const data = eventoSnap.data();
                    imeisAsignados = Array.isArray(data.imeisAsignados) ? data.imeisAsignados : [];
                }
                const nuevos = reservados.map(r => r.id).filter(id => !imeisAsignados.includes(id));
                if (nuevos.length > 0) {
                    await updateDoc(eventoRef, { imeisAsignados: [...imeisAsignados, ...nuevos] });
                }
                setMsg("IMEIs asignados al evento correctamente ✅");
                setReservados([]);
                setEventoSeleccionado(""); // Resetea el select
                setImeiInput(""); // Limpia el input de IMEI
                // Limpiar localStorage al asignar
                try { localStorage.removeItem("reservados_evento"); } catch {}
            } catch (err) {
                setMsg("Error al asignar: " + err.message);
            }
        };

        // Permitir liberar desde cualquier evento en el historial
        const handleLiberarAsignado = async (item, eventoId) => {
            try {
                // Quitar del evento
                const eventoRef = doc(db, "marketing_events", eventoId);
                const eventoSnap = await getDoc(eventoRef);
                if (eventoSnap.exists()) {
                    const data = eventoSnap.data();
                    const nuevos = (data.imeisAsignados || []).filter(id => id !== item.id);
                    await updateDoc(eventoRef, { imeisAsignados: nuevos });
                }
                // Poner disponible en inventario
                await updateDoc(doc(db, "inventario", item.id), { estado: "disponible", asignado_evento: "" });
                setMsg(`IMEI ${item.imei} liberado del evento`);
                // También eliminar de la lista de reservados local (sincronizar ambos cards)
                setReservados(prev => prev.filter(r => r.id !== item.id));
                try { localStorage.setItem("reservados_evento", JSON.stringify(reservados.filter(r => r.id !== item.id))); } catch {}
            } catch (err) {
                setMsg("Error liberando IMEI del evento: " + err.message);
            }
        };

        // Cargar historial de eventos con asignaciones
        useEffect(() => {
            const fetchHistorial = async () => {
                const eventosSnap = await getDocs(collection(db, "marketing_events"));
                const eventos = eventosSnap.docs.map(docu => ({ id: docu.id, ...docu.data() }));
                // Ordenar del más nuevo al más viejo
                eventos.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
                setHistorialEventos(eventos);
            };
            fetchHistorial();
        }, []);

        return (
            <div className="reservar-wrapper">
                <div className="reservar-card">
                    <h2 style={{ color: "#22bb33", marginBottom: 18 }}>
                        <span style={{ fontSize: 22, marginRight: 8 }}>🟩</span>Reservar terminales para eventos
                    </h2>
                    <div className="input-group">
                        <label>Buscar IMEI / Serie</label>
                        <div className="input-row">
                            <input
                                type="text"
                                placeholder="Digite o escanee el IMEI"
                                value={imeiInput}
                                onChange={e => setImeiInput(e.target.value)}
                                autoFocus
                                autoComplete="off"
                                onKeyDown={e => { if (e.key === "Enter") handleBuscarYReservar(); }}
                            />
                            <button onClick={handleBuscarYReservar} disabled={loading || !imeiInput.trim()}>
                                {loading ? "Buscando..." : "Reservar"}
                            </button>
                        </div>
                    </div>
                    {reservados.length > 0 && (
                        <div style={{ margin: "18px 0" }}>
                            <h4>Reservados:</h4>
                            <ul style={{ paddingLeft: 18 }}>
                                {reservados.filter(item => !item.asignado_evento).map(item => (
                                    <li key={item.id} style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                                        <span>{item.imei} <span style={{ color: '#888' }}>({item.marca} / {item.terminal})</span></span>
                                        <button style={{ marginLeft: 8, background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "2px 10px", cursor: "pointer" }} onClick={() => handleLiberar(item)}>Liberar</button>
                                    </li>
                                ))}
                            </ul>
                            <div style={{ marginTop: 12 }}>
                                <label><b>Asignar todos a evento:</b></label>
                                <select
                                    style={{ marginLeft: 8, padding: 6, borderRadius: 6 }}
                                    onChange={e => {
                                        setEventoSeleccionado(e.target.value);
                                        if (e.target.value) handleAsignarGrupo(e.target.value);
                                    }}
                                    value={eventoSeleccionado}
                                >
                                    <option value="">Seleccione evento</option>
                                    {eventos.map(ev => (
                                        <option key={ev.id} value={ev.id}>{ev.title} ({new Date(ev.date.seconds * 1000).toLocaleDateString()})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    {msg && <div className={`msg ${msg.includes("error") || msg.includes("no encontrado") ? "error" : "success"}`}>{msg}</div>}
                </div>
                {/* Card de historial de asignaciones */}
                <div style={{ margin: "18px 0", background: "#e9f5ff", borderRadius: 8, padding: 16 }}>
                    <h4>Historial de asignaciones de IMEIs y series a eventos</h4>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
                        <input placeholder="Filtrar por IMEI" value={filtroImei} onChange={e => setFiltroImei(e.target.value)} />
                        <input placeholder="Filtrar por Serie" value={filtroSerie} onChange={e => setFiltroSerie(e.target.value)} />
                    </div>
                    {historialEventos.filter(ev => {
                        // Filtro por fecha
                        if (filtroFecha && ev.date && ev.date.toDate) {
                            const fechaEv = ev.date.toDate().toISOString().slice(0, 10);
                            if (fechaEv !== filtroFecha) return false;
                        }
                        // Filtro por IMEI/serie
                        if (filtroImei || filtroSerie) {
                            const asignados = ev.imeisAsignados || [];
                            const inventarioAsignado = asignados.map(id => inventario.find(i => i.id === id)).filter(Boolean);
                            if (filtroImei && !inventarioAsignado.some(i => String(i.imei).includes(filtroImei))) return false;
                            if (filtroSerie && !inventarioAsignado.some(i => String(i.serie || "").includes(filtroSerie))) return false;
                        }
                        return true;
                    }).map(ev => (
                        <div key={ev.id} style={{ marginBottom: 12, background: '#fff', borderRadius: 6, padding: 10 }}>
                            <div><b>Evento:</b> {ev.title || '-'} <span style={{ color: '#2563eb', marginLeft: 8 }}>{ev.date && ev.date.toDate ? ev.date.toDate().toLocaleDateString() : ''}</span></div>
                            <div><b>Lugar:</b> {ev.lugar || '-'}</div>
                            <div><b>IMEIs/Series asignados:</b></div>
                            <ul style={{ paddingLeft: 18 }}>
                                {(ev.imeisAsignados || []).map(id => {
                                    const item = inventario.find(i => i.id === id);
                                    if (!item) return null;
                                    return (
                                        <li key={id} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span>{item.imei} <span style={{ color: '#888' }}>({item.marca} / {item.terminal}{item.serie ? ` / ${item.serie}` : ''})</span></span>
                                            <button style={{ marginLeft: 8, background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "2px 10px", cursor: "pointer" }} onClick={() => handleLiberarAsignado(item, ev.id)}>Liberar</button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                    {historialEventos.length === 0 && <div style={{ color: '#888' }}>No hay asignaciones registradas.</div>}
                </div>
            </div>
        );
    }
