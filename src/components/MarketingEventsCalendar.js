    import React, { useState, useEffect } from "react";
    import Calendar from "react-calendar";
    import "react-calendar/dist/Calendar.css";
    import styles from "./MarketingEventsCalendar.module.css";
    import { db } from "../firebase";
    import {
        collection,
        addDoc,
        onSnapshot,
        Timestamp,
        doc,
        updateDoc,
        deleteDoc,
        getDocs,
    } from "firebase/firestore";

    /** Convierte a YYYY-MM-DD y ajusta a medianoche local */
    function dateToKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
    }

    function MarketingEventsCalendar({ ejecutivos = [], isSupervisor = false }) {
    // -----------------------
    // ESTADOS (declarados primero)
    // -----------------------
    // evento en edición
    const [editEvento, setEditEvento] = useState(null);

    // IMEIs (ejecutivo)
    const [imeisReservados, setImeisReservados] = useState([]);
    const [imeisAVender, setImeisAVender] = useState([]);
    const [msgVenta, setMsgVenta] = useState("");

    // IMEIs (supervisor)
    const [imeisDisponibles, setImeisDisponibles] = useState([]);
    const [imeisAsignados, setImeisAsignados] = useState([]);
    const [imeiBusqueda, setImeiBusqueda] = useState("");

    // formulario y UI
    const [date, setDate] = useState(new Date());
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [eventosPorDia, setEventosPorDia] = useState({});
    const [loadingEventos, setLoadingEventos] = useState(true);

    const [form, setForm] = useState({
        title: "",
        description: "",
        lugar: "",
        convocados: [],
        vehiculoICE: false,
        matriculaVehiculo: "",
    });

    const matriculas = ["103-005536", "103-009346"];

    // -----------------------
    // EFECTOS (listeners / carga)
    // -----------------------

    // Escucha en tiempo real los eventos desde Firestore
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "marketing_events"), (snapshot) => {
        const eventos = snapshot.docs.map((docu) => {
            const data = docu.data();
            let fechaKey = "";
            if (data.date && data.date.toDate) {
            fechaKey = dateToKey(data.date.toDate());
            } else if (data.date) {
            fechaKey = dateToKey(data.date);
            }
            return { id: docu.id, ...data, _fechaKey: fechaKey };
        });

        const agrupados = {};
        eventos.forEach((ev) => {
            if (!agrupados[ev._fechaKey]) agrupados[ev._fechaKey] = [];
            agrupados[ev._fechaKey].push(ev);
        });

        setEventosPorDia(agrupados);
        setLoadingEventos(false);
        });

        return () => unsubscribe();
    }, []);

    // Cargar IMEIs reservados para el evento en edición (solo ejecutivo)
    useEffect(() => {
        if (isSupervisor || !showForm || !editEvento) {
        setImeisReservados([]); // limpiar si no aplica
        return;
        }

        if (Array.isArray(editEvento.imeisAsignados) && editEvento.imeisAsignados.length > 0) {
        const unsub = onSnapshot(collection(db, "inventario"), (snapshot) => {
            const reservados = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter(
                (item) =>
                editEvento.imeisAsignados.includes(item.id) &&
                (String(item.estado).toLowerCase() === "reservado" ||
                    String(item.estado).toLowerCase() === "reservada")
            );
            setImeisReservados(reservados);
        });
        return () => unsub();
        } else {
        setImeisReservados([]);
        }
    }, [editEvento, isSupervisor, showForm]);

    // Cargar IMEIs disponibles (solo supervisor y cuando se abre el form)
    useEffect(() => {
        if (!isSupervisor || !showForm) {
        setImeisDisponibles([]);
        return;
        }
        const unsub = onSnapshot(collection(db, "inventario"), (snapshot) => {
        const disponibles = snapshot.docs
            .map((docu) => ({ id: docu.id, ...docu.data() }))
            .filter((item) => (String(item.estado || "").toLowerCase() === "disponible"));
        setImeisDisponibles(disponibles);
        });
        return () => unsub();
    }, [isSupervisor, showForm]);

    // Cargar IMEIs ya asignados al evento en edición (para supervisor)
    useEffect(() => {
        if (!isSupervisor || !showForm) {
        // no hacer nada
        return;
        }
        if (editEvento && Array.isArray(editEvento.imeisAsignados)) {
        setImeisAsignados(editEvento.imeisAsignados);
        } else {
        setImeisAsignados([]);
        }
    }, [editEvento, isSupervisor, showForm]);

    // -----------------------
    // HANDLERS
    // -----------------------

    const handleVenderImeis = async () => {
        setMsgVenta("");
        if (imeisAVender.length === 0) {
        setMsgVenta("Selecciona al menos un IMEI para vender.");
        return;
        }
        try {
        for (const imei of imeisAVender) {
            const ref = doc(db, "inventario", imei);
            await updateDoc(ref, { estado: "vendido" });
        }
        setMsgVenta("Venta registrada correctamente.");
        setImeisAVender([]);
        } catch (err) {
        console.error("Error vender IMEIs:", err);
        setMsgVenta("Error al vender: " + (err?.message || err));
        }
    };

    const handleDescargarReporteVentas = () => {
        // placeholder: implementar export a PDF / CSV
        alert("Descarga de reporte de ventas del evento del día (pendiente de implementar)");
    };

    const handleOpenForm = (selectedDate) => {
        console.log('handleOpenForm: isSupervisor =', isSupervisor);
        if (!isSupervisor) return; // Solo supervisor puede abrir el form
        setDate(selectedDate || new Date());
        setShowForm(true);
        setEditEvento(null);
        setForm({
            title: "",
            description: "",
            lugar: "",
            convocados: [],
            vehiculoICE: false,
            matriculaVehiculo: "",
        });
        setMsg("");
        // limpiar asignaciones temporales
        setImeisAsignados([]);
        setImeiBusqueda("");
    };

    const handleEditEvento = (evento) => {
        setEditEvento(evento);
        setShowForm(true);
        setForm({
        title: evento.title || "",
        description: evento.description || "",
        lugar: evento.lugar || "",
        convocados: Array.isArray(evento.convocados) ? evento.convocados : [],
        vehiculoICE: !!evento.vehiculoICE,
        matriculaVehiculo: evento.matriculaVehiculo || "",
        });
        setDate(evento.date && evento.date.toDate ? evento.date.toDate() : new Date(evento.date));
        setMsg("");
        setImeisAsignados(Array.isArray(evento.imeisAsignados) ? evento.imeisAsignados : []);
    };

    const handleDeleteEvento = async (evento) => {
        if (!window.confirm("¿Seguro que deseas eliminar este evento?")) return;
        try {
        await deleteDoc(doc(db, "marketing_events", evento.id));
        setMsg("Evento eliminado correctamente");
        } catch (err) {
        console.error("Error eliminar evento:", err);
        setMsg("Error al eliminar: " + (err?.message || err));
        }
    };

    // Manejo de inputs en formulario local handled inline where needed

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!Array.isArray(form.convocados) || form.convocados.length === 0) {
        setMsg("Debes seleccionar al menos un ejecutivo.");
        return;
        }
        // --- VALIDACIÓN: IMEIs ya asignados a otros eventos ---
        try {
            const eventosSnap = await getDocs(collection(db, "marketing_events"));
            const imeisAsignadosOtros = new Set();
            eventosSnap.forEach(ev => {
                if (!editEvento || ev.id !== editEvento.id) {
                    const data = ev.data();
                    (data.imeisAsignados || []).forEach(id => imeisAsignadosOtros.add(id));
                }
            });
            const duplicados = imeisAsignados.filter(id => imeisAsignadosOtros.has(id));
            if (duplicados.length > 0) {
                setMsg(`Los siguientes IMEIs ya están asignados a otro evento: ${duplicados.join(", ")}`);
                return;
            }
        } catch (err) {
            setMsg("Error validando IMEIs: " + (err?.message || err));
            return;
        }

        setSaving(true);
        setMsg("");

        try {
        const payload = {
            title: form.title,
            description: form.description,
            lugar: form.lugar,
            convocados: form.convocados,
            vehiculoICE: form.vehiculoICE,
            matriculaVehiculo: form.vehiculoICE ? form.matriculaVehiculo : "",
            date: Timestamp.fromDate(date),
            imeisAsignados: imeisAsignados,
        };

        if (editEvento) {
            await updateDoc(doc(db, "marketing_events", editEvento.id), payload);
            setMsg("Evento actualizado correctamente");
        } else {
            await addDoc(collection(db, "marketing_events"), {
            ...payload,
            createdAt: new Date(),
            });
            setMsg("Evento guardado correctamente");
        }

        // Actualizar estado de los IMEIs asignados a 'reservado' y asignado_evento
        for (const imei of imeisAsignados) {
            try {
            const ref = doc(db, "inventario", imei);
            await updateDoc(ref, { estado: "reservado", asignado_evento: form.title });
            } catch (err) {
            console.warn("No se pudo actualizar IMEI:", imei, err);
            }
        }

        setShowForm(false);
        setEditEvento(null);
        setImeisAsignados([]);
        } catch (err) {
        console.error("Error guardar evento:", err);
        setMsg("Error al guardar: " + (err?.message || err));
        } finally {
        setSaving(false);
        }
    };

    // -----------------------
    // DERIVADOS PARA RENDER
    // -----------------------
    const eventosHoy = eventosPorDia[dateToKey(date)] || [];
    const allEvents = Object.values(eventosPorDia)
        .flat()
        .sort((a, b) => {
        const da = a.date && a.date.toDate ? a.date.toDate() : new Date(a.date);
        const db = b.date && b.date.toDate ? b.date.toDate() : new Date(b.date);
        return db - da;
        });

    function tileContent({ date: tileDate, view }) {
        if (view === "month") {
        const key = dateToKey(tileDate);
        if (eventosPorDia[key] && eventosPorDia[key].length > 0) {
            return <span style={{ color: "#2563eb", fontWeight: "bold" }}>•</span>;
        }
        }
        return null;
    }

    // -----------------------
    // RENDER
    // -----------------------
    return (
        <div className={styles.root}>
        <h2 className={styles.heading}>Eventos de Comercialización</h2>

        {/* Botón para descargar reporte de ventas del evento del día (solo ejecutivos) */}
        {!isSupervisor && (
            <button
            style={{
                margin: "12px 0 24px 0",
                padding: "8px 18px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
            }}
            onClick={handleDescargarReporteVentas}
            >
            Descargar informe de ventas del evento del día
            </button>
        )}

        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* === CALENDARIO Y EVENTOS DEL DÍA === */}
            <div style={{ flex: "1 1 340px", minWidth: 320, maxWidth: 420 }}>
            <div className={styles.calendar}>
                <Calendar onChange={setDate} value={date} onClickDay={handleOpenForm} tileContent={tileContent} />
            </div>
            <div className={styles.selectedDate}>
                <strong>Fecha seleccionada:</strong> {date.toLocaleDateString()}
            </div>

            <div className={styles.eventList}>
                <h4 style={{ marginBottom: 8 }}>Eventos para este día:</h4>
                {loadingEventos ? (
                <div style={{ color: "#888" }}>Cargando eventos...</div>
                ) : eventosHoy.length === 0 ? (
                <div style={{ color: "#888" }}>No hay eventos para este día.</div>
                ) : (
                <ul className={styles.eventList}>
                    {eventosHoy.map((ev) => (
                    <li key={ev.id} className={styles.eventItem}>
                        <span className={styles.eventTitle}>{ev.title}</span>{" "}
                        <span className={styles.eventPlace}>({ev.lugar})</span>
                        <br />
                        <span className={styles.eventDesc}>{ev.description}</span>
                        <br />
                        <span className={styles.eventMeta}>
                        Ejecutivos: {Array.isArray(ev.convocados) ? ev.convocados.join(", ") : ""}
                        </span>
                        <br />
                        {ev.vehiculoICE && (
                        <span className={styles.eventMeta}>Vehículo ICE: {ev.matriculaVehiculo}</span>
                        )}
                                                {/* Botón visible para asignar IMEIs/Series (solo supervisor) */}
                                                {isSupervisor && (
                                                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditEvento(ev)}
                                                            style={{
                                                                fontSize: 13,
                                                                padding: "3px 10px",
                                                                borderRadius: 6,
                                                                border: "1px solid #2563eb",
                                                                background: "#e0edff",
                                                                color: "#2563eb",
                                                                cursor: "pointer",
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            Asignar IMEIs/Series
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteEvento(ev)}
                                                            style={{
                                                                fontSize: 13,
                                                                padding: "3px 10px",
                                                                borderRadius: 6,
                                                                border: "1px solid #c00",
                                                                background: "#fff6f6",
                                                                color: "#c00",
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                )}
                    </li>
                    ))}
                </ul>
                )}
            </div>
            </div>

            {/* === FORMULARIO === */}
            {showForm && isSupervisor && (
            <div className={styles.formCard} style={{ minWidth: 320, maxWidth: 500, flex: "1 1 340px" }}>
                <h3 style={{ marginBottom: 12 }}>{editEvento ? "Editar Evento" : "Crear Evento"}</h3>
                <form onSubmit={handleSubmit}>
                <label className={styles.formLabel}>
                    Título:
                    <input
                    name="title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                    className={styles.formInput}
                    autoComplete="off"
                    />
                </label>

                <label className={styles.formLabel}>
                    Descripción:
                    <textarea
                    name="description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className={styles.formTextarea}
                    autoComplete="off"
                    />
                </label>

                <label className={styles.formLabel}>
                    Lugar:
                    <input
                    name="lugar"
                    value={form.lugar}
                    onChange={(e) => setForm((f) => ({ ...f, lugar: e.target.value }))}
                    required
                    className={styles.formInput}
                    autoComplete="off"
                    />
                </label>

                <label className={styles.formLabel}>Convocar ejecutivos:</label>
                <div className={styles.formCheckboxList}>
                    {ejecutivos.length === 0 && <div style={{ color: "#888" }}>No hay ejecutivos disponibles.</div>}
                    {ejecutivos.map((ej) => (
                    <div key={ej.id || ej.correo} className={styles.formCheckboxItem}>
                        <label>
                        <input
                            type="checkbox"
                            value={ej.correo}
                            checked={form.convocados.includes(ej.correo)}
                            onChange={(e) => {
                            const checked = e.target.checked;
                            setForm((f) => {
                                const nuevos = checked ? [...f.convocados, ej.correo] : f.convocados.filter((c) => c !== ej.correo);
                                return { ...f, convocados: nuevos };
                            });
                            }}
                            autoComplete="off"
                        />
                        &nbsp;{ej.nombre} ({ej.correo})
                        </label>
                    </div>
                    ))}
                </div>

                <div style={{ marginTop: 10 }}>
                    <label className={styles.formLabel}>
                    <input type="checkbox" name="vehiculoICE" checked={form.vehiculoICE} onChange={(e) => setForm((f) => ({ ...f, vehiculoICE: e.target.checked }))} autoComplete="off" />
                    &nbsp;Vehículo ICE
                    </label>
                </div>

                {form.vehiculoICE && (
                    <div style={{ marginTop: 8 }}>
                    <label className={styles.formLabel}>
                        Matrícula:
                        <select
                        name="matriculaVehiculo"
                        value={form.matriculaVehiculo}
                        onChange={(e) => setForm((f) => ({ ...f, matriculaVehiculo: e.target.value }))}
                        required
                        className={styles.formSelect}
                        autoComplete="off"
                        >
                        <option value="">Seleccione matrícula</option>
                        {matriculas.map((m) => (
                            <option key={m} value={m}>
                            {m}
                            </option>
                        ))}
                        </select>
                    </label>
                    </div>
                )}

                <div className={styles.formActions}>
                    <button type="submit" disabled={saving} className={styles.formButton}>
                    Guardar
                    </button>
                    <button
                    type="button"
                    onClick={() => {
                        setShowForm(false);
                        setEditEvento(null);
                        setMsg("");
                    }}
                    className={`${styles.formButton} ${styles.formButtonAlt}`}
                    >
                    Cancelar
                    </button>
                </div>

                {/* Sección de asignación de IMEIs/series solo para supervisor */}
                                {isSupervisor && (
                                    <div style={{ marginTop: 24, borderTop: "2px solid #2563eb", background: "#f4f8ff", padding: 18, borderRadius: 8, boxShadow: "0 2px 8px #2563eb22" }}>
                                        <h3 style={{ color: "#2563eb", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                            <span role="img" aria-label="barcode">📱</span> Asignar IMEIs/Series a este evento
                                        </h3>
                                        <div style={{ color: '#2563eb', fontSize: 14, marginBottom: 8 }}>
                                            Escanee o escriba el IMEI/serie y asígnelo a este evento. Los dispositivos quedarán reservados.
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Buscar o escanear IMEI disponible"
                                            value={imeiBusqueda}
                                            onChange={(e) => setImeiBusqueda(e.target.value)}
                                            style={{ marginBottom: 8, width: "100%", padding: 8, border: '1.5px solid #2563eb', borderRadius: 6, fontSize: 16 }}
                                            autoFocus
                                            autoComplete="off"
                                        />
                                        <div style={{ maxHeight: 120, overflowY: "auto", border: "1px solid #ddd", borderRadius: 6, marginBottom: 8, background: '#fff' }}>
                                            {imeisDisponibles.length === 0 ? (
                                                <div style={{ color: "#c00", padding: 12, fontWeight: 600 }}>No hay IMEIs disponibles en inventario.</div>
                                            ) : imeisDisponibles.filter(i => i.imei.includes(imeiBusqueda)).length === 0 ? (
                                                <div style={{ color: "#888", padding: 8 }}>No hay coincidencias para ese IMEI.</div>
                                            ) : (
                                                imeisDisponibles.filter(i => i.imei.includes(imeiBusqueda)).map(i => (
                                                    <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 4 }}>
                                                        <span style={{ fontFamily: "monospace", fontSize: 15 }}>{i.imei}</span>
                                                        <button
                                                            type="button"
                                                            style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: imeisAsignados.includes(i.id) ? "#ef4444" : "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}
                                                            onClick={() => setImeisAsignados(prev => prev.includes(i.id) ? prev.filter(x => x !== i.id) : [...prev, i.id])}
                                                        >
                                                            {imeisAsignados.includes(i.id) ? "Quitar" : "Asignar"}
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div style={{ marginTop: 8 }}>
                                            <b>IMEIs/Series asignados a este evento:</b>
                                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                                {imeisAsignados.length === 0 && <li style={{ color: "#888" }}>Ninguno</li>}
                                                {imeisAsignados.map(imei => (
                                                    <li key={imei} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span style={{ fontFamily: "monospace" }}>{imei}</span>
                                                        <button type="button" style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "#ef4444", color: "#fff", border: "none", cursor: "pointer" }} onClick={() => setImeisAsignados(prev => prev.filter(x => x !== imei))}>Quitar</button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                {/* Sección para el ejecutivo: ver y vender IMEIs reservados */}
                {!isSupervisor && editEvento && (
                    <div style={{ marginTop: 24, borderTop: "1px solid #eee", paddingTop: 16 }}>
                    <h4>Dispositivos reservados para este evento</h4>
                    {imeisReservados.length === 0 ? (
                        <div style={{ color: "#888" }}>No hay IMEIs reservados para este evento.</div>
                    ) : (
                        <form onSubmit={e => { e.preventDefault(); handleVenderImeis(); }}>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {imeisReservados.map(item => (
                            <li key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                    type="checkbox"
                                    checked={imeisAVender.includes(item.id)}
                                    onChange={e => {
                                    const checked = e.target.checked;
                                    setImeisAVender(prev => checked ? [...prev, item.id] : prev.filter(x => x !== item.id));
                                    }}
                                    autoComplete="off"
                                />
                                <span style={{ fontFamily: "monospace" }}>{item.imei}</span>
                                </label>
                            </li>
                            ))}
                        </ul>
                        <button type="submit" style={{ marginTop: 12, background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Vender seleccionados</button>
                        {msgVenta && <div style={{ marginTop: 8, color: msgVenta.startsWith("Error") ? "#c00" : "#090" }}>{msgVenta}</div>}
                        </form>
                    )}
                    </div>
                )}

                {msg && (
                    <div className={`${styles.formMsg} ${msg.startsWith("Error") ? styles.formMsgError : styles.formMsgOk}`}>
                    {msg}
                    </div>
                )}
                </form>
            </div>
            )}

            {/* === HISTORIAL DE EVENTOS === */}
            <div style={{ flex: "1 1 340px", minWidth: 320, maxWidth: 420 }}>
            <div className={styles.eventList}>
                <h4 style={{ marginBottom: 8 }}>Historial de todos los eventos</h4>
                {loadingEventos ? (
                <div style={{ color: "#888" }}>Cargando eventos...</div>
                ) : allEvents.length === 0 ? (
                <div style={{ color: "#888" }}>No hay eventos registrados.</div>
                ) : (
                <ul className={styles.eventList}>
                    {allEvents.map((ev) => (
                    <li key={ev.id} className={styles.eventItem}>
                        <span className={styles.eventTitle}>{ev.title}</span>{" "}
                        <span className={styles.eventPlace}>({ev.lugar})</span>
                        <br />
                        <span className={styles.eventDesc}>{ev.description}</span>
                        <br />
                        <span className={styles.eventMeta}>
                        Fecha: {ev.date && ev.date.toDate ? ev.date.toDate().toLocaleDateString() : ""}
                        </span>
                        <br />
                        <span className={styles.eventMeta}>
                        Ejecutivos: {Array.isArray(ev.convocados) ? ev.convocados.join(", ") : ""}
                        </span>
                        <br />
                        {ev.vehiculoICE && (
                        <span className={styles.eventMeta}>Vehículo ICE: {ev.matriculaVehiculo}</span>
                        )}
                    </li>
                    ))}
                </ul>
                )}
            </div>
            </div>
        </div>
        </div>
    );
    }

    export default MarketingEventsCalendar;
