import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useTime } from './TimeContext';
import { API_URL } from '../config/api';

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
    descripcion: '',
    acomodo_mobiliario: '',
    sillas_mesa_panel: ''
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
  const [modoEliminarMateriales, setModoEliminarMateriales] = useState(false);
  const [materialesParaEliminar, setMaterialesParaEliminar] = useState([]);
  const [eliminandoLoteMateriales, setEliminandoLoteMateriales] = useState(false);
  const [cargandoRecursos, setCargandoRecursos] = useState(false);
  const [restaurandoPredefinidos, setRestaurandoPredefinidos] = useState(false);

  // Opciones rápidas de acomodo de mobiliario (modificables / eliminables)
  const [acomodosCatalogo, setAcomodosCatalogo] = useState([]);
  const [editandoAcomodos, setEditandoAcomodos] = useState(false);
  const [acomodoEnEdicion, setAcomodoEnEdicion] = useState(null);
  const [acomodoInputTexto, setAcomodoInputTexto] = useState('');
  const [guardandoAcomodo, setGuardandoAcomodo] = useState(false);

  // Plantillas de evento compartidas (reservas_plantillas_evento)
  const [plantillasEvento, setPlantillasEvento] = useState([]);
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState('');
  const [mostrarModalPlantilla, setMostrarModalPlantilla] = useState(false);
  const [plantillaEnEdicion, setPlantillaEnEdicion] = useState(null);
  const [plantillaFormNombre, setPlantillaFormNombre] = useState('');
  const [plantillaFormTipo, setPlantillaFormTipo] = useState('');
  const [plantillaFormRecursos, setPlantillaFormRecursos] = useState({});
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [eliminandoPlantilla, setEliminandoPlantilla] = useState(false);


  const esNombreExclusivoPorDefecto = (nombre) => {
    const n = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return n.includes('jardin') || n.includes('audiovisual') || /^sa\d+\b/.test(n);
  };

  const esEspacioExclusivoReserva = (aula) =>
    typeof aula?.es_exclusiva_reservas === 'boolean'
      ? aula.es_exclusiva_reservas
      : esNombreExclusivoPorDefecto(aula?.nombre);

  // Cargar aulas siempre actualizadas al abrir el modal o cambiar props
  useEffect(() => {
    if (aulasList && aulasList.length > 0) {
      setAulasInternas(aulasList);
    }
    if (!isOpen && aulasList && aulasList.length > 0) return;
    fetch(`${API_URL}/api/aulas`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setAulasInternas(data);
      })
      .catch(err => console.error('Error al cargar aulas en modal:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, aulasList.length]);

  const listaBaseAulas = aulasInternas.length > 0 ? aulasInternas : aulasList;
  const aulasExclusivas = listaBaseAulas.filter(esEspacioExclusivoReserva);
  const aulasDisponibles =
    eventoAEditar?.aula_nombre && !aulasExclusivas.some(a => a.nombre === eventoAEditar.aula_nombre)
      ? [...aulasExclusivas, ...listaBaseAulas.filter(a => a.nombre === eventoAEditar.aula_nombre)]
      : aulasExclusivas;

  // Cargar catálogo compartido de materiales y plantillas de evento cuando abre el modal
  useEffect(() => {
    if (!isOpen) return;
    setCargandoRecursos(true);
    fetch(`${API_URL}/api/recursos`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (Array.isArray(data)) setRecursosCatalogo(data);
      })
      .catch(err => console.error('Error al cargar catálogo de materiales:', err))
      .finally(() => setCargandoRecursos(false));

    fetch(`${API_URL}/api/plantillas-evento`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (Array.isArray(data)) setPlantillasEvento(data);
      })
      .catch(err => console.error('Error al cargar plantillas de evento:', err));

    fetch(`${API_URL}/api/acomodos`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (Array.isArray(data)) setAcomodosCatalogo(data);
      })
      .catch(err => console.error('Error al cargar opciones de acomodo:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const restablecerCamposEnBlanco = () => {
    const refDate = ahora instanceof Date ? ahora : new Date();
    const anio = refDate.getFullYear();
    const mes = String(refDate.getMonth() + 1).padStart(2, '0');
    const dia = String(refDate.getDate()).padStart(2, '0');
    const hoyISO = `${anio}-${mes}-${dia}`;
    setFormData({
      tipo_evento: '',
      nombre_evento: '',
      aula_nombre: aulasExclusivas.length > 0 ? aulasExclusivas[0].nombre : '',
      fecha: hoyISO,
      hora_inicio: '10:00',
      hora_fin: '12:00',
      responsable: '',
      correo: '',
      descripcion: '',
      acomodo_mobiliario: '',
      sillas_mesa_panel: ''
    });
    setRecordatorios([
      { tipo: 'sipref', antencion_valor: 30, antencion_unidad: 'minutos' },
      { tipo: 'correo', antencion_valor: 1, antencion_unidad: 'horas' }
    ]);
    setRecursosSeleccionados({});
    setMostrarNuevoMaterial(false);
    setNuevoMaterialNombre('');
    setNuevoMaterialRequiereCantidad(true);
    setPlantillaSeleccionadaId('');
    setModoEliminarMateriales(false);
    setMaterialesParaEliminar([]);
    setEditandoAcomodos(false);
    setAcomodoEnEdicion(null);
    setAcomodoInputTexto('');
    setErrorDisponibilidad('');
  };

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
        descripcion: eventoAEditar.descripcion || '',
        acomodo_mobiliario: eventoAEditar.acomodo_mobiliario || '',
        sillas_mesa_panel: Number(eventoAEditar.sillas_mesa_panel) > 0 ? String(eventoAEditar.sillas_mesa_panel) : ''
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
      setMostrarNuevoMaterial(false);
      setNuevoMaterialNombre('');
      setNuevoMaterialRequiereCantidad(true);
      setPlantillaSeleccionadaId('');
      setErrorDisponibilidad('');
    } else {
      restablecerCamposEnBlanco();
    }
    setMaterialesDesplegados(
      Boolean(
        eventoAEditar?.recursos?.length ||
        eventoAEditar?.acomodo_mobiliario ||
        Number(eventoAEditar?.sillas_mesa_panel) > 0
      )
    );
    setMostrarModalPlantilla(false);
    setPlantillaEnEdicion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventoAEditar?.id]);

  // Sincronizar aula inicial exclusiva cuando terminan de cargar las aulas
  useEffect(() => {
    if (!isOpen || eventoAEditar) return;
    if (aulasExclusivas.length === 0) return;
    const existeEnExclusivas = aulasExclusivas.some(a => a.nombre === formData.aula_nombre);
    if (!formData.aula_nombre || !existeEnExclusivas) {
      setFormData(prev => ({ ...prev, aula_nombre: aulasExclusivas[0].nombre }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventoAEditar?.id, aulasExclusivas.length]);

  if (!isOpen) return null;

  const handleLimpiarTodo = () => {
    restablecerCamposEnBlanco();
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Formulario limpiado',
      showConfirmButton: false,
      timer: 2000
    });
  };

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
        sillas_mesa_panel: Math.max(0, parseInt(formData.sillas_mesa_panel, 10) || 0),
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

  const alternarRecursoEnMapa = (setter, recursoId, marcado) => {
    setter(prev => {
      const next = { ...prev };
      if (marcado) {
        next[recursoId] = next[recursoId] || 1;
      } else {
        delete next[recursoId];
      }
      return next;
    });
  };

  const cambiarCantidadEnMapa = (setter, recursoId, delta) => {
    setter(prev => {
      const actual = Number(prev[recursoId]) || 1;
      return {
        ...prev,
        [recursoId]: Math.max(1, actual + delta)
      };
    });
  };

  const establecerCantidadEnMapa = (setter, recursoId, rawVal) => {
    const soloDigitos = String(rawVal || '').replace(/\D/g, '');
    setter(prev => {
      if (soloDigitos === '') {
        return { ...prev, [recursoId]: '' };
      }
      const parsed = parseInt(soloDigitos, 10);
      return {
        ...prev,
        [recursoId]: Number.isNaN(parsed) ? '' : Math.max(1, parsed)
      };
    });
  };

  const normalizarCantidadEnMapa = (setter, recursoId) => {
    setter(prev => {
      const parsed = parseInt(prev[recursoId], 10);
      return {
        ...prev,
        [recursoId]: !parsed || parsed < 1 ? 1 : parsed
      };
    });
  };

  const aplicarPlantillaAlFormulario = (plantilla, mostrarToast = true) => {
    if (!plantilla) return;
    setFormData(prev => ({
      ...prev,
      nombre_evento: plantilla.nombre,
      tipo_evento: plantilla.tipoEvento || plantilla.tipo_evento || plantilla.nombre
    }));
    const mapa = {};
    (plantilla.recursos || []).forEach(r => {
      const rid = r.recurso_id ?? r.id;
      if (rid) mapa[rid] = Math.max(1, Number(r.cantidad) || 1);
    });
    setRecursosSeleccionados(mapa);
    if (mostrarToast) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Plantilla "${plantilla.nombre}" aplicada`,
        showConfirmButton: false,
        timer: 2500
      });
    }
  };

  const handleSeleccionarPlantilla = (e) => {
    const idStr = e.target.value;
    setPlantillaSeleccionadaId(idStr);
    if (!idStr) return;
    const plantilla = plantillasEvento.find(p => String(p.id) === String(idStr));
    if (plantilla) {
      aplicarPlantillaAlFormulario(plantilla, true);
    }
  };

  const handleAbrirNuevaPlantilla = () => {
    setPlantillaEnEdicion(null);
    setPlantillaFormNombre('');
    setPlantillaFormTipo('');
    setPlantillaFormRecursos({ ...recursosSeleccionados });
    setMostrarModalPlantilla(true);
  };

  const handleAbrirEditarPlantilla = () => {
    const actual = plantillasEvento.find(p => String(p.id) === String(plantillaSeleccionadaId));
    if (!actual) return;
    setPlantillaEnEdicion(actual);
    setPlantillaFormNombre(actual.nombre || '');
    setPlantillaFormTipo(actual.tipoEvento || actual.tipo_evento || '');
    const mapa = {};
    (actual.recursos || []).forEach(r => {
      const rid = r.recurso_id ?? r.id;
      if (rid) mapa[rid] = Math.max(1, Number(r.cantidad) || 1);
    });
    setPlantillaFormRecursos(mapa);
    setMostrarModalPlantilla(true);
  };

  const handleGuardarPlantilla = async () => {
    const nombreLimpio = plantillaFormNombre.trim();
    if (!nombreLimpio) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Escribe el nombre de la plantilla',
        showConfirmButton: false,
        timer: 2500
      });
      return;
    }

    setGuardandoPlantilla(true);
    try {
      const recursosPayload = Object.entries(plantillaFormRecursos).map(([idStr, cant]) => ({
        recurso_id: Number(idStr),
        cantidad: Math.max(1, Number(cant) || 1)
      }));
      const esEdicion = Boolean(plantillaEnEdicion?.id);
      const url = esEdicion
        ? `${API_URL}/api/plantillas-evento/${plantillaEnEdicion.id}`
        : `${API_URL}/api/plantillas-evento`;

      const res = await fetch(url, {
        method: esEdicion ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario': encodeURIComponent(usuarioLogueado || 'Prefectura')
        },
        body: JSON.stringify({
          nombre: nombreLimpio,
          tipoEvento: plantillaFormTipo.trim() || null,
          recursos: recursosPayload
        })
      });
      const data = await res.json();
      if (!res.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: data?.detail || 'No se pudo guardar la plantilla',
          showConfirmButton: false,
          timer: 3000
        });
        return;
      }

      setPlantillasEvento(prev => {
        const filtradas = prev.filter(p => p.id !== data.id);
        return [...filtradas, data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      });
      setPlantillaSeleccionadaId(String(data.id));
      aplicarPlantillaAlFormulario(data, false);
      setMostrarModalPlantilla(false);
      setPlantillaEnEdicion(null);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: esEdicion ? 'Plantilla de evento actualizada' : 'Plantilla de evento creada',
        showConfirmButton: false,
        timer: 2800
      });
    } catch {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Error de conexión al guardar la plantilla',
        showConfirmButton: false,
        timer: 3000
      });
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  const handleEliminarPlantilla = async () => {
    if (!plantillaEnEdicion?.id) return;
    const confirm = await Swal.fire({
      title: 'Eliminar plantilla',
      text: `¿Eliminar la plantilla "${plantillaEnEdicion.nombre}"? Los eventos ya registrados conservarán su información.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });
    if (!confirm.isConfirmed) return;

    setEliminandoPlantilla(true);
    try {
      const res = await fetch(`${API_URL}/api/plantillas-evento/${plantillaEnEdicion.id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: data?.detail || 'No se pudo eliminar la plantilla',
          showConfirmButton: false,
          timer: 3000
        });
        return;
      }

      setPlantillasEvento(prev => prev.filter(p => p.id !== plantillaEnEdicion.id));
      if (String(plantillaSeleccionadaId) === String(plantillaEnEdicion.id)) {
        setPlantillaSeleccionadaId('');
      }
      setMostrarModalPlantilla(false);
      setPlantillaEnEdicion(null);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Plantilla de evento eliminada',
        showConfirmButton: false,
        timer: 2500
      });
    } catch {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Error de conexión al eliminar la plantilla',
        showConfirmButton: false,
        timer: 3000
      });
    } finally {
      setEliminandoPlantilla(false);
    }
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
      setMaterialesParaEliminar(prev => prev.filter(id => id !== rec.id));
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

  const alternarMaterialParaEliminar = (recursoId) => {
    setMaterialesParaEliminar(prev =>
      prev.includes(recursoId) ? prev.filter(id => id !== recursoId) : [...prev, recursoId]
    );
  };

  const handleEliminarMaterialesSeleccionados = async () => {
    if (materialesParaEliminar.length === 0) return;
    const confirm = await Swal.fire({
      title: `Eliminar ${materialesParaEliminar.length} ${materialesParaEliminar.length === 1 ? 'material' : 'materiales'}`,
      text: '¿Eliminar los materiales seleccionados del catálogo compartido? Los eventos anteriores conservarán su registro.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });
    if (!confirm.isConfirmed) return;

    setEliminandoLoteMateriales(true);
    try {
      const res = await fetch(`${API_URL}/api/recursos/eliminar-lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: materialesParaEliminar })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: data?.detail || 'No se pudieron eliminar los materiales',
          showConfirmButton: false,
          timer: 3000
        });
        return;
      }

      const idsSet = new Set(materialesParaEliminar);
      setRecursosCatalogo(prev => prev.filter(item => !idsSet.has(item.id)));
      setRecursosSeleccionados(prev => {
        const next = { ...prev };
        materialesParaEliminar.forEach(id => delete next[id]);
        return next;
      });
      setMaterialesParaEliminar([]);
      setModoEliminarMateriales(false);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Materiales eliminados del catálogo',
        showConfirmButton: false,
        timer: 2500
      });
    } catch {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Error de conexión al eliminar materiales',
        showConfirmButton: false,
        timer: 3000
      });
    } finally {
      setEliminandoLoteMateriales(false);
    }
  };

  const handleRestaurarPredefinidos = async () => {
    setRestaurandoPredefinidos(true);
    try {
      const res = await fetch(`${API_URL}/api/recursos/restaurar-predefinidos`, {
        method: 'POST'
      });
      const data = await res.json().catch(() => []);
      if (res.ok && Array.isArray(data)) {
        setRecursosCatalogo(data);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Materiales predefinidos restaurados',
          showConfirmButton: false,
          timer: 2500
        });
      }
    } catch {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'No se pudieron restaurar los materiales',
        showConfirmButton: false,
        timer: 3000
      });
    } finally {
      setRestaurandoPredefinidos(false);
    }
  };

  const handleGuardarAcomodoCatalogo = async () => {
    const nombreLimpio = acomodoInputTexto.trim();
    if (!nombreLimpio) return;

    setGuardandoAcomodo(true);
    try {
      const esEdicion = Boolean(acomodoEnEdicion?.id);
      const url = esEdicion
        ? `${API_URL}/api/acomodos/${acomodoEnEdicion.id}`
        : `${API_URL}/api/acomodos`;
      const res = await fetch(url, {
        method: esEdicion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreLimpio })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: data?.detail || 'No se pudo guardar la opción de acomodo',
          showConfirmButton: false,
          timer: 2500
        });
        return;
      }

      if (esEdicion) {
        setAcomodosCatalogo(prev => prev.map(item => (item.id === data.id ? data : item)));
        if (formData.acomodo_mobiliario === acomodoEnEdicion.nombre) {
          setFormData(prev => ({ ...prev, acomodo_mobiliario: data.nombre }));
        }
      } else {
        setAcomodosCatalogo(prev => (prev.some(item => item.id === data.id) ? prev : [...prev, data]));
        setFormData(prev => ({ ...prev, acomodo_mobiliario: data.nombre }));
      }

      setAcomodoEnEdicion(null);
      setAcomodoInputTexto('');
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: esEdicion ? 'Opción actualizada' : 'Opción agregada',
        showConfirmButton: false,
        timer: 2000
      });
    } catch {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Error de conexión al guardar acomodo',
        showConfirmButton: false,
        timer: 2500
      });
    } finally {
      setGuardandoAcomodo(false);
    }
  };

  const handleEliminarAcomodoCatalogo = async (item) => {
    try {
      const res = await fetch(`${API_URL}/api/acomodos/${item.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: data?.detail || 'No se pudo eliminar la opción de acomodo',
          showConfirmButton: false,
          timer: 2500
        });
        return;
      }
      setAcomodosCatalogo(prev => prev.filter(a => a.id !== item.id));
      if (formData.acomodo_mobiliario === item.nombre) {
        setFormData(prev => ({ ...prev, acomodo_mobiliario: '' }));
      }
      if (acomodoEnEdicion?.id === item.id) {
        setAcomodoEnEdicion(null);
        setAcomodoInputTexto('');
      }
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `"${item.nombre}" eliminado`,
        showConfirmButton: false,
        timer: 2000
      });
    } catch {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Error de conexión al eliminar acomodo',
        showConfirmButton: false,
        timer: 2500
      });
    }
  };

  const cantidadMaterialesSeleccionados = Object.keys(recursosSeleccionados).length;
  const partesResumenMateriales = [
    ...Object.entries(recursosSeleccionados)
      .map(([idStr, cant]) => {
        const mat = recursosCatalogo.find(r => String(r.id) === String(idStr));
        if (!mat) return null;
        const requiereCant = mat.unidad !== 'sin_cantidad' && mat.unidad !== 'fijo';
        const cantNum = Math.max(1, parseInt(cant, 10) || 1);
        return requiereCant ? `${cantNum} ${mat.nombre}` : mat.nombre;
      })
      .filter(Boolean),
    Number(formData.sillas_mesa_panel) > 0 ? `${parseInt(formData.sillas_mesa_panel, 10)} sillas mesa panel` : null,
    formData.acomodo_mobiliario?.trim() ? `Acomodo: ${formData.acomodo_mobiliario.trim()}` : null
  ].filter(Boolean);
  const textoResumenMateriales =
    partesResumenMateriales.length === 0
      ? 'Ningún material seleccionado'
      : partesResumenMateriales.join(' • ');
  const totalPredefinidosActivos = recursosCatalogo.filter(r => r.es_predefinido).length;

  const renderCuadriculaMateriales = (mapaSeleccionado, setter, permitirEliminarCatalogo = false) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {recursosCatalogo.map((rec) => {
        const enModoBorrar = permitirEliminarCatalogo && modoEliminarMateriales;
        const marcadoBorrar = enModoBorrar && materialesParaEliminar.includes(rec.id);
        const marcado = enModoBorrar ? marcadoBorrar : mapaSeleccionado[rec.id] !== undefined;
        const cantidad = mapaSeleccionado[rec.id] ?? 1;
        const requiereCantidad = !enModoBorrar && rec.unidad !== 'sin_cantidad' && rec.unidad !== 'fijo';

        return (
          <div
            key={rec.id}
            className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs transition-colors ${
              enModoBorrar
                ? marcadoBorrar
                  ? 'bg-red-50 border-red-400 shadow-xs'
                  : 'bg-white border-red-200/70 hover:border-red-300'
                : marcado
                ? 'bg-white border-[#1c355e]/40 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer flex-1 min-w-0">
              <input
                type="checkbox"
                checked={marcado}
                onChange={(e) => {
                  if (enModoBorrar) {
                    alternarMaterialParaEliminar(rec.id);
                  } else {
                    alternarRecursoEnMapa(setter, rec.id, e.target.checked);
                  }
                }}
                className={`rounded ${enModoBorrar ? 'text-red-600 focus:ring-red-500' : 'text-[#1c355e] focus:ring-[#1c355e]'}`}
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
                    onClick={() => cambiarCantidadEnMapa(setter, rec.id, -1)}
                    className="px-2 py-1 text-slate-600 hover:bg-slate-200/70 font-bold cursor-pointer"
                    aria-label={`Disminuir ${rec.nombre}`}
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cantidad}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    onChange={(e) => establecerCantidadEnMapa(setter, rec.id, e.target.value)}
                    onBlur={() => normalizarCantidadEnMapa(setter, rec.id)}
                    aria-label={`Cantidad de ${rec.nombre}`}
                    className="w-12 px-1 py-1 font-extrabold text-[#1c355e] text-center bg-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => cambiarCantidadEnMapa(setter, rec.id, 1)}
                    className="px-2 py-1 text-slate-600 hover:bg-slate-200/70 font-bold cursor-pointer"
                    aria-label={`Aumentar ${rec.nombre}`}
                  >
                    +
                  </button>
                </div>
              )}

              {permitirEliminarCatalogo && !enModoBorrar && (
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
  );

  const plantillaSeleccionadaActual = plantillasEvento.find(p => String(p.id) === String(plantillaSeleccionadaId)) || null;
  const cantidadMaterialesPlantilla = Object.keys(plantillaFormRecursos).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[70] p-3 sm:p-5">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
        
        {/* CABECERA MODAL */}
        <div className="shrink-0 flex justify-between items-center px-6 sm:px-8 pt-6 pb-4 border-b border-slate-100 bg-white">
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
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 space-y-6">

            {/* ALERTA ERROR DE DISPONIBILIDAD */}
            {errorDisponibilidad && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 animate-fadeIn">
                <span className="material-symbols-outlined text-red-600 text-2xl mt-0.5">error</span>
                <div className="flex-1 text-sm">
                  <p className="font-bold text-red-900">Reserva Bloqueada — Aula Ocupada</p>
                  <p className="mt-0.5 font-medium">{errorDisponibilidad}</p>
                </div>
              </div>
            )}

          {/* BARRA RÁPIDA DE PLANTILLA DE EVENTO */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#1c355e]">
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                <span className="text-xs font-bold uppercase tracking-wider">Plantilla de Evento</span>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold">Opcional</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <select
                value={plantillaSeleccionadaId}
                onChange={handleSeleccionarPlantilla}
                className="flex-1 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
              >
                <option value="">Evento personalizado (o elige una plantilla...)</option>
                {plantillasEvento.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nombre} ({(p.recursos || []).length} materiales)
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAbrirNuevaPlantilla}
                  className="px-3 py-2 rounded-xl bg-[#1c355e] hover:bg-[#152847] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  + Nueva plantilla
                </button>
                {plantillaSeleccionadaActual && (
                  <button
                    type="button"
                    onClick={handleAbrirEditarPlantilla}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-[#1c355e] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Editar
                  </button>
                )}
              </div>
            </div>
          </div>

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
                {cargandoRecursos && recursosCatalogo.length === 0 ? (
                  <p className="text-xs text-slate-400 font-semibold py-2">Cargando catálogo de materiales...</p>
                ) : (
                  renderCuadriculaMateriales(recursosSeleccionados, setRecursosSeleccionados, true)
                )}

            {modoEliminarMateriales ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-red-700">
                  Marca arriba los materiales que deseas eliminar del catálogo ({materialesParaEliminar.length} seleccionados)
                </p>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setModoEliminarMateriales(false);
                      setMaterialesParaEliminar([]);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={materialesParaEliminar.length === 0 || eliminandoLoteMateriales}
                    onClick={handleEliminarMaterialesSeleccionados}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {eliminandoLoteMateriales
                      ? 'Eliminando...'
                      : `Eliminar seleccionados (${materialesParaEliminar.length})`}
                  </button>
                </div>
              </div>
            ) : !mostrarNuevoMaterial ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMostrarNuevoMaterial(true)}
                    className="text-xs font-bold text-[#1c355e] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    + Agregar otro material
                  </button>
                  {totalPredefinidosActivos < 11 && (
                    <button
                      type="button"
                      disabled={restaurandoPredefinidos}
                      onClick={handleRestaurarPredefinidos}
                      className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">restore</span>
                      {restaurandoPredefinidos ? 'Restaurando...' : 'Restaurar predefinidos'}
                    </button>
                  )}
                </div>
                {recursosCatalogo.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarNuevoMaterial(false);
                      setModoEliminarMateriales(true);
                      setMaterialesParaEliminar([]);
                    }}
                    className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                    Seleccionar para eliminar
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-[#1c355e]/30 p-3 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <input
                    type="text"
                    value={nuevoMaterialNombre}
                    onChange={(e) => setNuevoMaterialNombre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleGuardarNuevoMaterial();
                      }
                    }}
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

                {/* ACOMODO DE MESAS Y SILLAS + MESA PANEL */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1c355e] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base">chair</span>
                      Acomodo de mesas, sillas y mesa panel
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoAcomodos(prev => !prev);
                        setAcomodoEnEdicion(null);
                        setAcomodoInputTexto('');
                      }}
                      className="text-[11px] font-bold text-[#1c355e] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">{editandoAcomodos ? 'check' : 'edit'}</span>
                      {editandoAcomodos ? 'Listo' : 'Editar / Eliminar opciones'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {acomodosCatalogo.map((item) =>
                      editandoAcomodos ? (
                        <div
                          key={item.id}
                          className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-[11px] font-bold border border-slate-300 bg-slate-50 text-slate-700"
                        >
                          <span>{item.nombre}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAcomodoEnEdicion(item);
                              setAcomodoInputTexto(item.nombre);
                            }}
                            title={`Modificar "${item.nombre}"`}
                            className="p-0.5 text-[#1c355e] hover:bg-[#1c355e]/10 rounded-full cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[13px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarAcomodoCatalogo(item)}
                            title={`Eliminar "${item.nombre}"`}
                            className="p-0.5 text-red-500 hover:bg-red-100 rounded-full cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[13px]">close</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setFormData(prev => ({
                              ...prev,
                              acomodo_mobiliario: prev.acomodo_mobiliario === item.nombre ? '' : item.nombre
                            }))
                          }
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer transition-colors ${
                            formData.acomodo_mobiliario === item.nombre
                              ? 'bg-[#1c355e] text-white border-[#1c355e]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#1c355e]/40'
                          }`}
                        >
                          {item.nombre}
                        </button>
                      )
                    )}
                  </div>

                  {editandoAcomodos && (
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-lg border border-dashed border-[#1c355e]/30">
                      <input
                        type="text"
                        maxLength={120}
                        placeholder={acomodoEnEdicion ? 'Nuevo nombre...' : 'Agregar nueva opción de acomodo...'}
                        value={acomodoInputTexto}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleGuardarAcomodoCatalogo();
                          }
                        }}
                        onChange={(e) => setAcomodoInputTexto(e.target.value)}
                        className="flex-1 min-w-[160px] px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#1c355e]/20"
                      />
                      {acomodoEnEdicion && (
                        <button
                          type="button"
                          onClick={() => {
                            setAcomodoEnEdicion(null);
                            setAcomodoInputTexto('');
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={guardandoAcomodo || !acomodoInputTexto.trim()}
                        onClick={handleGuardarAcomodoCatalogo}
                        className="px-3 py-1 rounded-lg bg-[#1c355e] hover:bg-[#152847] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                      >
                        {guardandoAcomodo ? 'Guardando...' : acomodoEnEdicion ? 'Guardar cambio' : '+ Agregar'}
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        ¿Cómo se acomodarán las mesas y sillas? <span className="text-slate-400 font-normal">(Opcional)</span>
                      </label>
                      <input
                        type="text"
                        maxLength={255}
                        placeholder="Ej. Auditorio con 4 mesas al frente y pasillo central"
                        value={formData.acomodo_mobiliario}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.preventDefault();
                        }}
                        onChange={(e) => setFormData(prev => ({ ...prev, acomodo_mobiliario: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Sillas para mesa panel
                      </label>
                      <div className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData(prev => {
                              const actual = parseInt(prev.sillas_mesa_panel, 10) || 0;
                              const sig = Math.max(0, actual - 1);
                              return { ...prev, sillas_mesa_panel: sig === 0 ? '' : String(sig) };
                            })
                          }
                          className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200/70 font-bold cursor-pointer"
                          aria-label="Disminuir sillas mesa panel"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={formData.sillas_mesa_panel}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          onChange={(e) => {
                            const soloDigitos = e.target.value.replace(/\D/g, '');
                            setFormData(prev => ({
                              ...prev,
                              sillas_mesa_panel: soloDigitos === '' ? '' : String(parseInt(soloDigitos, 10))
                            }));
                          }}
                          className="w-full px-2 py-1.5 text-xs font-extrabold text-[#1c355e] text-center bg-transparent outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData(prev => {
                              const actual = parseInt(prev.sillas_mesa_panel, 10) || 0;
                              return { ...prev, sillas_mesa_panel: String(actual + 1) };
                            })
                          }
                          className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200/70 font-bold cursor-pointer"
                          aria-label="Aumentar sillas mesa panel"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
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

          </div>

          {/* BOTONES ACCIÓN */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 sm:px-8 py-4 border-t border-slate-100 bg-slate-50/70">
            <button
              type="button"
              onClick={handleLimpiarTodo}
              disabled={guardando || verificando}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Limpiar todo lo seleccionado y escrito"
            >
              <span className="material-symbols-outlined text-lg">cleaning_services</span>
              Limpiar todo
            </button>
            <div className="flex items-center gap-3 ml-auto">
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
          </div>

        </form>
      </div>

      {/* SUBMODAL CREAR / EDITAR PLANTILLA DE EVENTO */}
      {mostrarModalPlantilla && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[80] p-3 sm:p-5">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1c355e]/10 text-[#1c355e] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">auto_awesome</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#1c355e]">
                    {plantillaEnEdicion ? 'Editar Plantilla de Evento' : 'Nueva Plantilla de Evento'}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Guarda un conjunto de evento y materiales para reutilizarlo rápido
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMostrarModalPlantilla(false);
                  setPlantillaEnEdicion(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-1.5">
                  Nombre de la plantilla *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ceremonia de Titulación"
                  value={plantillaFormNombre}
                  onChange={(e) => setPlantillaFormNombre(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1c355e] uppercase tracking-wider mb-1.5">
                  Tipo de evento <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ceremonia, Conferencia..."
                  value={plantillaFormTipo}
                  onChange={(e) => setPlantillaFormTipo(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20 outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#1c355e]">
                  <span className="material-symbols-outlined text-lg">inventory_2</span>
                  <span className="text-xs font-bold uppercase tracking-wider">Materiales de la plantilla</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#fdbb11]/25 border border-[#fdbb11]/60 text-[#1c355e]">
                  {cantidadMaterialesPlantilla} {cantidadMaterialesPlantilla === 1 ? 'seleccionado' : 'seleccionados'}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto pr-1">
                {renderCuadriculaMateriales(plantillaFormRecursos, setPlantillaFormRecursos, false)}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <div>
                {plantillaEnEdicion && (
                  <button
                    type="button"
                    disabled={eliminandoPlantilla || guardandoPlantilla}
                    onClick={handleEliminarPlantilla}
                    className="px-3.5 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    {eliminandoPlantilla ? 'Eliminando...' : 'Eliminar plantilla'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalPlantilla(false);
                    setPlantillaEnEdicion(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={guardandoPlantilla || eliminandoPlantilla}
                  onClick={handleGuardarPlantilla}
                  className="px-5 py-2 rounded-xl bg-[#1c355e] hover:bg-[#152847] text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {guardandoPlantilla
                    ? 'Guardando...'
                    : plantillaEnEdicion
                      ? 'Actualizar plantilla'
                      : 'Guardar plantilla'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
