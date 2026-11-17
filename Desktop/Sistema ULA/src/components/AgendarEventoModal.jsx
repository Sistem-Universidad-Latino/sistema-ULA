import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useTime } from './TimeContext';

export default function AgendarEventoModal({
  isOpen,
  onClose,
  onSuccess,
  eventoAEditar = null,
  aulasList = [],
  usuarioLogueado = 'Prefectura'
}) {
  const ahora = useTime();
  const [formData, setFormData] = useState({
    tipo_evento: 'Conferencia',
    nombre_evento: '',
    aula_nombre: '',
    fecha: '',
    hora_inicio: '09:00',
    hora_fin: '11:00',
    responsable: '',
    correo: '',
    descripcion: ''
  });

  const [recordatorios, setRecordatorios] = useState([
    { tipo: 'sipref', antencion_valor: 30, antencion_unidad: 'minutos' },
    { tipo: 'correo', antencion_valor: 1, antencion_unidad: 'horas' }
  ]);

  const [aulasInternas, setAulasInternas] = useState([]);
  const [verificando, setVerificando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [probandoCorreo, setProbandoCorreo] = useState(false);
  const [errorDisponibilidad, setErrorDisponibilidad] = useState('');

  // Materiales y equipo (catálogo compartido reservas_recursos_catalogo)
  const [recursosCatalogo, setRecursosCatalogo] = useState([]);
  const [recursosSeleccionados, setRecursosSeleccionados] = useState({});
  const [mostrarNuevoMaterial, setMostrarNuevoMaterial] = useState(false);
  const [nuevoMaterialNombre, setNuevoMaterialNombre] = useState('');
  const [nuevoMaterialRequiereCantidad, setNuevoMaterialRequiereCantidad] = useState(true);
  const [guardandoMaterial, setGuardandoMaterial] = useState(false);
  const [materialesDesplegados, setMaterialesDesplegados] = useState(false);

  const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';

  // Cargar aulas si no vienen en props
  useEffect(() => {
    if (aulasList && aulasList.length > 0) {
      setAulasInternas(aulasList);
    } else {
      fetch(`${API_URL}/api/aulas`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAulasInternas(data);
        })
        .catch(err => console.error('Error al cargar aulas en modal:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulasList.length]);

  // Cargar catálogo compartido de materiales y equipo cuando abre el modal
  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_URL}/api/recursos`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (Array.isArray(data)) setRecursosCatalogo(data);
      })
      .catch(err => console.error('Error al cargar catálogo de materiales:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reset form ONLY when the modal opens or when editing a different event
  useEffect(() => {
    if (!isOpen) return;
    if (eventoAEditar) {
      setFormData({
        tipo_evento: eventoAEditar.tipo_evento || 'Conferencia',
        nombre_evento: eventoAEditar.nombre_evento || '',
        aula_nombre: eventoAEditar.aula_nombre || '',
        fecha: eventoAEditar.fecha || '',
        hora_inicio: eventoAEditar.hora_inicio ? String(eventoAEditar.hora_inicio).slice(0, 5) : '09:00',
        hora_fin: eventoAEditar.hora_fin ? String(eventoAEditar.hora_fin).slice(0, 5) : '11:00',
        responsable: eventoAEditar.responsable || '',
        correo: eventoAEditar.correo || '',
        descripcion: eventoAEditar.descripcion || ''
      });
      if (Array.isArray(eventoAEditar.recordatorios) && eventoAEditar.recordatorios.length > 0) {
        setRecordatorios(eventoAEditar.recordatorios.map(r => ({
          tipo: r.tipo || 'correo',
          antencion_valor: Number(r.antencion_valor) || 30,
          antencion_unidad: r.antencion_unidad || 'minutos'
        })));
      }
      if (Array.isArray(eventoAEditar.recursos) && eventoAEditar.recursos.length > 0) {
        const mapa = {};
        eventoAEditar.recursos.forEach(r => {
          const rid = r.recurso_id ?? r.id;
          if (rid) mapa[rid] = Math.max(1, Number(r.cantidad) || 1);
        });
        setRecursosSeleccionados(mapa);
      } else {
        setRecursosSeleccionados({});
      }
    } else {
      const refDate = ahora instanceof Date ? ahora : new Date();
      const anio = refDate.getFullYear();
      const mes = String(refDate.getMonth() + 1).padStart(2, '0');
      const dia = String(refDate.getDate()).padStart(2, '0');
      const hoyISO = `${anio}-${mes}-${dia}`;
      const lista = aulasList.length > 0 ? aulasList : aulasInternas;
      setFormData({
        tipo_evento: '',
        nombre_evento: '',
        aula_nombre: lista.length > 0 ? lista[0].nombre : '',
        fecha: hoyISO,
        hora_inicio: '10:00',
        hora_fin: '12:00',
        responsable: '',
        correo: '',
        descripcion: ''
      });
      setRecordatorios([
        { tipo: 'sipref', antencion_valor: 30, antencion_unidad: 'minutos' },
        { tipo: 'correo', antencion_valor: 1, antencion_unidad: 'horas' }
      ]);
      setRecursosSeleccionados({});
    }
    setMostrarNuevoMaterial(false);
    setNuevoMaterialNombre('');
    setNuevoMaterialRequiereCantidad(true);
    setMaterialesDesplegados(Boolean(eventoAEditar?.recursos?.length));
    setErrorDisponibilidad('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventoAEditar?.id]);

  if (!isOpen) return null;

  const handleAgregarRecordatorio = () => {
    setRecordatorios([
      ...recordatorios,
      { tipo: 'correo', antencion_valor: 30, antencion_unidad: 'minutos' }
    ]);
  };

  const handleEliminarRecordatorio = (index) => {
    setRecordatorios(recordatorios.filter((_, i) => i !== index));
  };

  const handleUpdateRecordatorio = (index, field, value) => {
    const updated = [...recordatorios];
    updated[index][field] = value;
    setRecordatorios(updated);
  };

  const verificarDisponibilidad = async () => {
    if (!formData.aula_nombre || !formData.fecha || !formData.hora_inicio || !formData.hora_fin) {
      return { disponible: true };
    }
    setVerificando(true);
    setErrorDisponibilidad('');
    try {
      const res = await fetch(`${API_URL}/api/eventos/verificar-disponibilidad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aula_nombre: formData.aula_nombre,
          fecha: formData.fecha,
          hora_inicio: formData.hora_inicio,
          hora_fin: formData.hora_fin,
          evento_id: eventoAEditar ? eventoAEditar.id : null
        })
      });
      const data = await res.json();
      if (!data.disponible) {
        setErrorDisponibilidad(data.motivo || 'El aula no está disponible en el horario seleccionado.');
        return { disponible: false, motivo: data.motivo };
      }
      return { disponible: true };
    } catch (err) {
      console.error('Error al verificar disponibilidad:', err);
      return { disponible: true };
    } finally {
      setVerificando(false);
    }
  };

  const handleProbarCorreo = async () => {
    if (!formData.correo || !formData.correo.includes('@')) {
      Swal.fire({
        icon: 'warning',
        title: 'Correo inválido',
        text: 'Ingrese un correo electrónico válido para probar el envío.'
      });
      return;
    }
    setProbandoCorreo(true);
    try {
      const res = await fetch(`${API_URL}/api/eventos/probar-correo?correo=${encodeURIComponent(formData.correo)}&evento_nombre=${encodeURIComponent(formData.nombre_evento || 'Evento de Prueba')}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Correo de prueba enviado a ${formData.correo}`,
          showConfirmButton: false,
          timer: 4000
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error de envío',
          text: data.detail || 'No se pudo enviar el correo de prueba. Verifique configuración SMTP.'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudo conectar con el servidor para probar el correo.'
      });
    } finally {
      setProbandoCorreo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre_evento.trim() || !formData.aula_nombre || !formData.fecha || !formData.responsable.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor complete todos los campos obligatorios (*)'
      });
      return;
    }

    const check = await verificarDisponibilidad();
    if (!check.disponible) {
      return;
    }

    setGuardando(true);
    try {
      const recursosPayload = Object.entries(recursosSeleccionados).map(([idStr, cant]) => ({
        recurso_id: Number(idStr),
        cantidad: Math.max(1, Number(cant) || 1)
      }));

      const payload = {
        ...formData,
        usuario_creador: usuarioLogueado,
        recordatorios: recordatorios,
        recursos: recursosPayload
      };

      const url = eventoAEditar 
        ? `${API_URL}/api/eventos/${eventoAEditar.id}`
        : `${API_URL}/api/eventos`;

      const method = eventoAEditar ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: eventoAEditar ? 'Evento actualizado exitosamente' : 'Evento agendado exitosamente',
          showConfirmButton: false,
          timer: 3000
        });
        onSuccess && onSuccess();
        onClose();
      } else {
        const errData = await res.json();
        setErrorDisponibilidad(errData.detail || 'Error al guardar el evento.');
      }
    } catch (err) {
      console.error('Error al guardar evento:', err);
      setErrorDisponibilidad('Error de conexión con el servidor.');
    } finally {
      setGuardando(false);
    }
  };

  const aulasDisponibles = aulasList.length > 0 ? aulasList : aulasInternas;

  const alternarMaterial = (recursoId, marcado) => {
    setRecursosSeleccionados(prev => {
      const next = { ...prev };
      if (marcado) {
        next[recursoId] = next[recursoId] || 1;
      } else {
        delete next[recursoId];
      }
      return next;
    });
  };

  const cambiarCantidadMaterial = (recursoId, delta) => {
    setRecursosSeleccionados(prev => {
      const actual = prev[recursoId] || 1;
      return {
        ...prev,
        [recursoId]: Math.max(1, actual + delta)
      };
    });
  };

  const handleGuardarNuevoMaterial = async () => {
    const nombreLimpio = nuevoMaterialNombre.trim();
    if (!nombreLimpio) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Escribe el nombre del material',
        showConfirmButton: false,
        timer: 2500
      });
      return;
    }

    setGuardandoMaterial(true);
    try {
      const res = await fetch(`${API_URL}/api/recursos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario': encodeURIComponent(usuarioLogueado || 'Prefectura')
        },
        body: JSON.stringify({
          nombre: nombreLimpio,
          unidad: nuevoMaterialRequiereCantidad ? 'pieza' : 'sin_cantidad'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: data?.detail || 'No se pudo agregar el material',
          showConfirmButton: false,
          timer: 3000
        });
        return;
      }

      setRecursosCatalogo(prev => {
        const existe = prev.some(item => item.id === data.id);
        if (existe) {
          return prev.map(item => (item.id === data.id ? data : item));
        }
        return [...prev, data];
      });
      setRecursosSeleccionados(prev => ({ ...prev, [data.id]: 1 }));
      setNuevoMaterialNombre('');
      setNuevoMaterialRequiereCantidad(true);
      setMostrarNuevoMaterial(false);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Material agregado al catálogo',
        showConfirmButton: false,
        timer: 3000
      });
    } catch {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Error de conexión al guardar material',
        showConfirmButton: false,
        timer: 3000
      });
    } finally {
      setGuardandoMaterial(false);
    }
  };

  const handleEliminarMaterial = async (rec) => {
    const confirm = await Swal.fire({
      title: 'Eliminar material',
      text: '¿Eliminar este material del catálogo? Los eventos anteriores conservarán su registro.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`${API_URL}/api/recursos/${rec.id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: data?.detail || 'No se pudo eliminar el material',
          showConfirmButton: false,
          timer: 3000
        });
        return;
      }

      setRecursosCatalogo(prev => prev.filter(item => item.id !== rec.id));
      setRecursosSeleccionados(prev => {
        const next = { ...prev };
        delete next[rec.id];
        return next;
      });
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Material eliminado del catálogo',
        showConfirmButton: false,
        timer: 2500
      });
    } catch {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Error de conexión al eliminar material',
        showConfirmButton: false,
        timer: 3000
      });
    }
  };

  const cantidadMaterialesSeleccionados = Object.keys(recursosSeleccionados).length;
  const textoResumenMateriales =
    cantidadMaterialesSeleccionados === 0
      ? 'Ningún material seleccionado'
      : Object.entries(recursosSeleccionados)
          .map(([idStr, cant]) => {
            const mat = recursosCatalogo.find(r => String(r.id) === String(idStr));
            if (!mat) return null;
            const requiereCant = mat.unidad !== 'sin_cantidad' && mat.unidad !== 'fijo';
            return requiereCant ? `${cant} ${mat.nombre}` : mat.nombre;
          })
          .filter(Boolean)
          .join(', ');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-100 my-8">
        
        {/* CABECERA MODAL */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1c355e]/10 text-[#1c355e] flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">event_available</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1c355e]">
                {eventoAEditar ? 'Editar Evento en Aula' : 'Agendar Evento en Aula'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Reserva de espacios para conferencias, juntas y exámenes en SIPREF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* ALERTA ERROR DE DISPONIBILIDAD */}
        {errorDisponibilidad && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 animate-fadeIn">
            <span className="material-symbols-outlined text-red-600 text-2xl mt-0.5">error</span>
            <div className="flex-1 text-sm">
              <p className="font-bold text-red-900">Reserva Bloqueada — Aula Ocupada</p>
              <p className="mt-0.5 font-medium">{errorDisponibilidad}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* DATOS PRINCIPALES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-2">
                Tipo de Evento *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Conferencia, Junta, Examen, Taller..."
                value={formData.tipo_evento}
                onChange={e => setFormData(prev => ({ ...prev, tipo_evento: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-2">
                Aula / Espacio *
              </label>
              <select
                required
                value={formData.aula_nombre}
                onChange={e => {
                  setFormData(prev => ({ ...prev, aula_nombre: e.target.value }));
                  setErrorDisponibilidad('');
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
              >
                <option value="" disabled>Seleccione un aula...</option>
                {aulasDisponibles.map(a => (
                  <option key={a.id || a.nombre} value={a.nombre}>
                    {a.nombre} {a.edificio ? `(${a.edificio})` : ''}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div>
            <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-2">
              Nombre del Evento *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Conferencia Magistral de Ingeniería de Software"
              value={formData.nombre_evento}
              onChange={e => setFormData(prev => ({ ...prev, nombre_evento: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
            />
          </div>

          {/* FECHA Y HORARIO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-2">
                Fecha *
              </label>
              <input
                type="date"
                required
                value={formData.fecha}
                onChange={e => {
                  setFormData(prev => ({ ...prev, fecha: e.target.value }));
                  setErrorDisponibilidad('');
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-2">
                Hora Inicio *
              </label>
              <input
                type="time"
                required
                value={formData.hora_inicio}
                onChange={e => {
                  setFormData(prev => ({ ...prev, hora_inicio: e.target.value }));
                  setErrorDisponibilidad('');
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-2">
                Hora Fin *
              </label>
              <input
                type="time"
                required
                value={formData.hora_fin}
                onChange={e => {
                  setFormData(prev => ({ ...prev, hora_fin: e.target.value }));
                  setErrorDisponibilidad('');
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
              />
            </div>
          </div>

          {/* RESPONSABLE Y CORREO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-2">
                Responsable del Evento *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Dr. Juan Pérez"
                value={formData.responsable}
                onChange={e => setFormData(prev => ({ ...prev, responsable: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider">
                  Correo Electrónico (para aviso) *
                </label>
                {formData.correo && (
                  <button
                    type="button"
                    onClick={handleProbarCorreo}
                    disabled={probandoCorreo}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Enviar correo de prueba a esta dirección"
                  >
                    <span className="material-symbols-outlined text-[14px]">send</span>
                    {probandoCorreo ? 'Probando...' : 'Probar aviso'}
                  </button>
                )}
              </div>
              <input
                type="email"
                required
                placeholder="ejemplo@correo.com"
                value={formData.correo}
                onChange={e => setFormData(prev => ({ ...prev, correo: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-2">
              Descripción del Evento <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows="2"
              placeholder="Detalles sobre proyector, micrófonos, asistentes previstos, etc."
              value={formData.descripcion}
              onChange={e => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none resize-none"
            />
          </div>

          {/* SECCIÓN MATERIALES Y EQUIPO (DESPLEGABLE) */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <button
              type="button"
              onClick={() => setMaterialesDesplegados(prev => !prev)}
              className={`w-full text-left cursor-pointer ${materialesDesplegados ? 'border-b border-slate-200 pb-2.5' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#1c355e]">
                  <span className="material-symbols-outlined text-xl">inventory_2</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider">MATERIALES Y EQUIPO</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#fdbb11]/25 border border-[#fdbb11]/60 text-[#1c355e]">
                    {cantidadMaterialesSeleccionados} {cantidadMaterialesSeleccionados === 1 ? 'seleccionado' : 'seleccionados'}
                  </span>
                  <span
                    className={`material-symbols-outlined text-[#1c355e] text-xl transition-transform duration-200 ${
                      materialesDesplegados ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Marca el equipo y mobiliario que se utilizará en el evento
              </p>
            </button>

            {materialesDesplegados && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {recursosCatalogo.map((rec) => {
                const marcado = recursosSeleccionados[rec.id] !== undefined;
                const cantidad = recursosSeleccionados[rec.id] || 1;
                const requiereCantidad = rec.unidad !== 'sin_cantidad' && rec.unidad !== 'fijo';

                return (
                  <div
                    key={rec.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs transition-colors ${
                      marcado
                        ? 'bg-white border-[#1c355e]/40 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={(e) => alternarMaterial(rec.id, e.target.checked)}
                        className="rounded text-[#1c355e] focus:ring-[#1c355e]"
                      />
                      <span className="truncate">{rec.nombre}</span>
                      {rec.unidad === 'fijo' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          Fijo en aula
                        </span>
                      )}
                    </label>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {marcado && requiereCantidad && (
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => cambiarCantidadMaterial(rec.id, -1)}
                            className="px-2 py-1 text-slate-600 hover:bg-slate-200/70 font-bold cursor-pointer"
                            aria-label={`Disminuir ${rec.nombre}`}
                          >
                            −
                          </button>
                          <span className="px-2 py-1 font-extrabold text-[#1c355e] min-w-[24px] text-center">
                            {cantidad}
                          </span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidadMaterial(rec.id, 1)}
                            className="px-2 py-1 text-slate-600 hover:bg-slate-200/70 font-bold cursor-pointer"
                            aria-label={`Aumentar ${rec.nombre}`}
                          >
                            +
                          </button>
                        </div>
                      )}

                      {!rec.es_predefinido && (
                        <button
                          type="button"
                          onClick={() => handleEliminarMaterial(rec)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                          title="Eliminar material del catálogo"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!mostrarNuevoMaterial ? (
              <div>
                <button
                  type="button"
                  onClick={() => setMostrarNuevoMaterial(true)}
                  className="text-xs font-bold text-[#1c355e] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  + Agregar otro material
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-[#1c355e]/30 p-3 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <input
                    type="text"
                    value={nuevoMaterialNombre}
                    onChange={(e) => setNuevoMaterialNombre(e.target.value)}
                    placeholder="Nombre del material"
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
                  />
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer shrink-0 select-none">
                    <span>¿Requiere cantidad?</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={nuevoMaterialRequiereCantidad}
                      onClick={() => setNuevoMaterialRequiereCantidad(prev => !prev)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        nuevoMaterialRequiereCantidad ? 'bg-[#1c355e]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          nuevoMaterialRequiereCantidad ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarNuevoMaterial(false);
                      setNuevoMaterialNombre('');
                      setNuevoMaterialRequiereCantidad(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={guardandoMaterial}
                    onClick={handleGuardarNuevoMaterial}
                    className="px-3 py-1.5 rounded-lg bg-[#1c355e] hover:bg-[#152847] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {guardandoMaterial ? 'Guardando...' : 'Guardar material'}
                  </button>
                </div>
              </div>
            )}
              </>
            )}

            <p className="text-[11px] text-slate-500 font-medium pt-1">
              Resumen: {textoResumenMateriales}
            </p>
          </div>

          {/* SECCIÓN RECORDATORIOS */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#1c355e]">
                <span className="material-symbols-outlined text-xl">notifications_active</span>
                <h4 className="text-xs font-bold uppercase tracking-wider">Configuración de Recordatorios</h4>
              </div>
              <button
                type="button"
                onClick={handleAgregarRecordatorio}
                className="text-xs font-bold text-[#1c355e] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add_circle</span> + Agregar otro
              </button>
            </div>

            {recordatorios.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium italic">Sin recordatorios programados.</p>
            ) : (
              <div className="space-y-2">
                {recordatorios.map((rec, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-xs">
                    <label className="flex items-center gap-1 font-bold text-slate-700 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={rec.tipo === 'sipref' || rec.tipo === 'ambos'}
                        onChange={(e) => {
                          const hasEmail = rec.tipo === 'correo' || rec.tipo === 'ambos';
                          const hasSipref = e.target.checked;
                          const nxt = hasSipref && hasEmail ? 'ambos' : hasSipref ? 'sipref' : 'correo';
                          handleUpdateRecordatorio(idx, 'tipo', nxt);
                        }}
                        className="rounded text-[#1c355e]"
                      />
                      SIPREF
                    </label>

                    <label className="flex items-center gap-1 font-bold text-slate-700 cursor-pointer shrink-0 mr-2">
                      <input
                        type="checkbox"
                        checked={rec.tipo === 'correo' || rec.tipo === 'ambos'}
                        onChange={(e) => {
                          const hasSipref = rec.tipo === 'sipref' || rec.tipo === 'ambos';
                          const hasEmail = e.target.checked;
                          const nxt = hasSipref && hasEmail ? 'ambos' : hasEmail ? 'correo' : 'sipref';
                          handleUpdateRecordatorio(idx, 'tipo', nxt);
                        }}
                        className="rounded text-[#1c355e]"
                      />
                      Correo
                    </label>

                    <span className="text-slate-400 font-bold shrink-0">Anticipación:</span>

                    <input
                      type="number"
                      min="1"
                      value={rec.antencion_valor}
                      onChange={(e) => handleUpdateRecordatorio(idx, 'antencion_valor', e.target.value)}
                      className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                    />

                    <select
                      value={rec.antencion_unidad}
                      onChange={(e) => handleUpdateRecordatorio(idx, 'antencion_unidad', e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                    >
                      <option value="minutos">minutos antes</option>
                      <option value="horas">horas antes</option>
                      <option value="dias">días antes</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleEliminarRecordatorio(idx)}
                      className="ml-auto text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOTONES ACCIÓN */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || verificando}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1c355e] to-[#244275] text-white font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">sync</span> Guardando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  {eventoAEditar ? 'Guardar Cambios' : 'Agendar Evento'}
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
