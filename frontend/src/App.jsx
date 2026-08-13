import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DashboardObras from './components/DashboardObras';
import DetalleObra from './components/DetalleObra';

export default function App() {
  const [tasaHoy, setTasaHoy] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sistemaDesbloqueado, setSistemaDesbloqueado] = useState(false);

  // Estados de Login
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  
  const [proyectos, setProyectos] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [obraSeleccionada, setObraSeleccionada] = useState(null);
  
  const [transacciones, setTransacciones] = useState([]);
  
  // Modales de Transacción Normal
  const [modalTransaccionAbierto, setModalTransaccionAbierto] = useState(false);
  const [tipoTransaccionActual, setTipoTransaccionActual] = useState('INGRESO');
  const [categoriaTransaccion, setCategoriaTransaccion] = useState('ANTICIPO');
  const [conceptoTransaccion, setConceptoTransaccion] = useState('');
  const [monedaUsada, setMonedaUsada] = useState('BS');
  
  // 🔥 Modal Exclusivo de Compra de Dólares
  const [modalCompraDolaresAbierto, setModalCompraDolaresAbierto] = useState(false);

  // Estados para la máscara de dinero
  const [montoOriginalRaw, setMontoOriginalRaw] = useState('');
  const [montoOriginalDisplay, setMontoOriginalDisplay] = useState('');
  
  const [tasaRecepcion, setTasaRecepcion] = useState(''); 
  const [tasaOficialDia, setTasaOficialDia] = useState(''); 

  // Modal de Obra Extra
  const [modalObraExtraAbierto, setModalObraExtraAbierto] = useState(false);
  const [descripcionExtra, setDescripcionExtra] = useState('');
  const [costoExtraRaw, setCostoExtraRaw] = useState('');
  const [costoExtraDisplay, setCostoExtraDisplay] = useState('');
  const [tipoGananciaExtra, setTipoGananciaExtra] = useState('PORCENTAJE');
  const [valorGananciaExtraRaw, setValorGananciaExtraRaw] = useState('');
  const [valorGananciaExtraDisplay, setValorGananciaExtraDisplay] = useState('');
  const [porcentajeComisionExtra, setPorcentajeComisionExtra] = useState('15');
  const [nuevoObjetivoExtra, setNuevoObjetivoExtra] = useState('');
  const [listaObjetivosExtra, setListaObjetivosExtra] = useState([]);

  // Campos para nueva obra principal
  const [nombreObra, setNombreObra] = useState('');
  const [clienteObra, setClienteObra] = useState('');
  const [ubicacionObra, setUbicacionObra] = useState('');
  const [costoEstimadoRaw, setCostoEstimadoRaw] = useState('');
  const [costoEstimadoDisplay, setCostoEstimadoDisplay] = useState('');
  const [tipoGanancia, setTipoGanancia] = useState('PORCENTAJE');
  const [valorGananciaRaw, setValorGananciaRaw] = useState('');
  const [valorGananciaDisplay, setValorGananciaDisplay] = useState('');
  const [porcentajeComision, setPorcentajeComision] = useState('15');
  const [tasaPresupuesto, setTasaPresupuesto] = useState('');
  const [nuevoObjetivo, setNuevoObjetivo] = useState('');
  const [listaObjetivos, setListaObjetivos] = useState(['Cimientos y Excavación', 'Estructura de Concreto']);

  const formatMoney = (amount) => {
    return (amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleMoneyInput = (e, setRaw, setDisplay) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (!value) {
        setRaw('');
        setDisplay('');
        return;
    }
    const number = parseInt(value, 10) / 100; 
    setRaw(number);
    setDisplay(number.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleCostoChange = (e) => handleMoneyInput(e, setCostoEstimadoRaw, setCostoEstimadoDisplay);
  const handleGananciaChange = (e) => handleMoneyInput(e, setValorGananciaRaw, setValorGananciaDisplay);
  const handleCostoExtraChange = (e) => handleMoneyInput(e, setCostoExtraRaw, setCostoExtraDisplay);
  const handleGananciaExtraChange = (e) => handleMoneyInput(e, setValorGananciaExtraRaw, setValorGananciaExtraDisplay);

  const costoNum = parseFloat(costoEstimadoRaw) || 0;
  const valorGNum = parseFloat(valorGananciaRaw) || 0;
  const comisionNum = parseFloat(porcentajeComision) || 0;
  
  const baseImponibleCalculada = costoNum;
  let gananciaCalculada = tipoGanancia === 'PORCENTAJE' ? (baseImponibleCalculada * valorGNum) / 100 : valorGNum;
  const comisionCalculada = (baseImponibleCalculada * comisionNum) / 100;
  const ivaCalculado = baseImponibleCalculada * 0.16;
  const presupuestoTotalCalculado = baseImponibleCalculada + ivaCalculado;
  
  const tasaUsadaNum = parseFloat(tasaPresupuesto) || (tasaHoy?.tasa_bcv_usd || 1);
  const totalEnBolivares = presupuestoTotalCalculado * tasaUsadaNum;

  const costoExtraNum = parseFloat(costoExtraRaw) || 0;
  const valorGExtraNum = parseFloat(valorGananciaExtraRaw) || 0;
  const comisionExtraNum = parseFloat(porcentajeComisionExtra) || 0;
  let gananciaExtraCalc = tipoGananciaExtra === 'PORCENTAJE' ? (costoExtraNum * valorGExtraNum) / 100 : valorGExtraNum;
  const ivaExtraCalc = costoExtraNum * 0.16;
  const totalExtraCalc = costoExtraNum + ivaExtraCalc;

  const montoTotalEnDolaresReales = monedaUsada === 'USD' 
      ? parseFloat(montoOriginalRaw) || 0 
      : (parseFloat(montoOriginalRaw) || 0) / (parseFloat(tasaOficialDia) || 1);

  let esPerdida = false;
  let esGanancia = false;
  let valorDiferencial = 0;

  if (monedaUsada === 'BS' && parseFloat(montoOriginalRaw) > 0 && parseFloat(tasaOficialDia) > 0 && parseFloat(tasaRecepcion) > 0 && categoriaTransaccion !== 'COMPRA_DOLARES') {
      const dolaresBCV = parseFloat(montoOriginalRaw) / parseFloat(tasaOficialDia);
      const dolaresPactados = parseFloat(montoOriginalRaw) / parseFloat(tasaRecepcion);
      
      valorDiferencial = Math.abs(dolaresBCV - dolaresPactados);

      if (tipoTransaccionActual === 'INGRESO') {
          if (parseFloat(tasaRecepcion) < parseFloat(tasaOficialDia)) esPerdida = true;
          else if (parseFloat(tasaRecepcion) > parseFloat(tasaOficialDia)) esGanancia = true;
      } else {
          if (parseFloat(tasaRecepcion) > parseFloat(tasaOficialDia)) esPerdida = true;
          else if (parseFloat(tasaRecepcion) < parseFloat(tasaOficialDia)) esGanancia = true;
      }
  }

  useEffect(() => {
    axios.get('http://localhost:3000/api/tasas/actual')
      .then(response => {
        setTasaHoy(response.data);
        if (response.data?.tasa_bcv_usd) {
          setTasaPresupuesto(response.data.tasa_bcv_usd);
          setTasaOficialDia(response.data.tasa_bcv_usd);
          setTasaRecepcion(response.data.tasa_bcv_usd); 
        }
        setCargando(false);
      })
      .catch(error => {
        console.error("Error buscando la tasa:", error);
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    if (sistemaDesbloqueado) cargarProyectos();
  }, [sistemaDesbloqueado]);

  useEffect(() => {
    if (obraSeleccionada) cargarTransacciones(obraSeleccionada.id);
  }, [obraSeleccionada]);

  const cargarProyectos = () => {
    axios.get('http://localhost:3000/api/proyectos')
      .then(res => setProyectos(res.data))
      .catch(err => console.error("Error cargando proyectos:", err));
  };

  const cargarTransacciones = (proyectoId) => {
    axios.get(`http://localhost:3000/api/transacciones/${proyectoId}`)
      .then(res => setTransacciones(res.data))
      .catch(err => console.error("Error cargando transacciones:", err));
  };

  const manejarLogin = (e) => {
    e.preventDefault();
    axios.post('http://localhost:3000/api/login', { username: usernameInput, password: passwordInput })
      .then(res => {
        if (res.data.success) {
          setSistemaDesbloqueado(true);
          setErrorLogin('');
        }
      })
      .catch(() => {
        setErrorLogin('Usuario o contraseña incorrectos (Prueba admin / 1234)');
      });
  };

  const agregarObjetivoTemporal = (e) => {
    e.preventDefault();
    if (!nuevoObjetivo.trim()) return;
    setListaObjetivos([...listaObjetivos, nuevoObjetivo.trim()]);
    setNuevoObjetivo('');
  };

  const eliminarObjetivoTemporal = (index) => {
    setListaObjetivos(listaObjetivos.filter((_, i) => i !== index));
  };

  const guardarProyectoCompleto = (e) => {
    e.preventDefault();
    if (!nombreObra || !clienteObra || !costoEstimadoRaw) return alert("Por favor completa los campos obligatorios.");

    axios.post('http://localhost:3000/api/proyectos-completo', {
      nombre: nombreObra,
      cliente: clienteObra,
      ubicacion: ubicacionObra,
      costo_estimado_usd: costoNum,
      tipo_ganancia: tipoGanancia,
      valor_ganancia: valorGNum,
      porcentaje_comision: comisionNum,
      tasa_bcv_presupuesto: tasaUsadaNum,
      objetivos: listaObjetivos
    })
    .then(() => {
      cargarProyectos();
      setModalAbierto(false);
      setNombreObra(''); setClienteObra(''); setUbicacionObra('');
      setCostoEstimadoRaw(''); setCostoEstimadoDisplay('');
      setValorGananciaRaw(''); setValorGananciaDisplay('');
    })
    .catch(err => console.error("Error guardando:", err));
  };

  const registrarCompraDolares = (e) => {
    e.preventDefault();
    if (!montoOriginalRaw || !tasaRecepcion) return alert("Por favor coloca los dólares a comprar y la tasa.");

    axios.post('http://localhost:3000/api/comprar-dolares', {
        proyecto_id: obraSeleccionada.id,
        monto_usd: parseFloat(montoOriginalRaw),
        tasa_compra: parseFloat(tasaRecepcion),
        tasa_oficial_dia: parseFloat(tasaOficialDia)
    }).then(() => {
        cargarTransacciones(obraSeleccionada.id);
        setModalCompraDolaresAbierto(false);
        setMontoOriginalRaw(''); setMontoOriginalDisplay('');
        alert("¡Compra de Dólares registrada con éxito!");
    }).catch(err => console.error("Error en compra:", err));
  };

  const registrarTransaccion = (e) => {
    e.preventDefault();
    if (!montoOriginalRaw || !tasaRecepcion || !conceptoTransaccion) return alert("Por favor completa todos los campos.");

    axios.post('http://localhost:3000/api/transacciones', {
      proyecto_id: obraSeleccionada.id,
      tipo: tipoTransaccionActual,
      categoria: categoriaTransaccion,
      concepto: conceptoTransaccion,
      moneda_usada: monedaUsada,
      monto_moneda_original: parseFloat(montoOriginalRaw),
      tasa_bcv_momento: parseFloat(tasaRecepcion),
      tasa_oficial_dia: parseFloat(tasaOficialDia),
      monto_usd_real: montoTotalEnDolaresReales 
    })
    .then(() => {
      cargarTransacciones(obraSeleccionada.id);
      setModalTransaccionAbierto(false);
      setConceptoTransaccion(''); 
      setMontoOriginalRaw(''); 
      setMontoOriginalDisplay('');
    })
    .catch(err => console.error("Error registrando transacción:", err));
  };

  const guardarObraExtra = (e) => {
    e.preventDefault();
    if (!descripcionExtra || !costoExtraRaw) return alert("Completa la descripción y el costo del trabajo extra.");

    axios.post(`http://localhost:3000/api/proyectos/${obraSeleccionada.id}/presupuestos-extra`, {
      descripcion: descripcionExtra,
      costo_estimado_usd: costoExtraNum,
      tipo_ganancia: tipoGananciaExtra,
      valor_ganancia: valorGExtraNum,
      porcentaje_comision: comisionExtraNum,
      tasa_bcv_presupuesto: parseFloat(tasaOficialDia),
      objetivos: listaObjetivosExtra
    })
    .then(() => {
      setModalObraExtraAbierto(false);
      setDescripcionExtra('');
      setCostoExtraRaw(''); setCostoExtraDisplay('');
      setValorGananciaExtraRaw(''); setValorGananciaExtraDisplay('');
      setListaObjetivosExtra([]);
      alert("¡Obra extra registrada exitosamente!");
      cargarProyectos(); 
    })
    .catch(err => {
      console.error("Error guardando obra extra:", err);
      alert("Ocurrió un error al guardar la obra extra. Verifica la consola.");
    });
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-black tracking-tight">Cargando ValorObra ERP...</p>
      </div>
    );
  }

  // 🔐 PANTALLA DE LOGIN SEGURA
  if (!sistemaDesbloqueado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500"></div>
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🇻🇪</div>
            <h1 className="text-2xl font-black text-white">ValorObra ERP <span className="text-emerald-400">Pro</span></h1>
            <p className="text-xs text-slate-400 mt-1">Inicia sesión para acceder al sistema</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl mb-6 border border-slate-800 text-center">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tasa BCV Oficial (USD)</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">{formatMoney(tasaHoy?.tasa_bcv_usd)} <span className="text-xs text-slate-400">Bs/$</span></p>
          </div>

          <form onSubmit={manejarLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Usuario</label>
              <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="Ej: admin" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Contraseña</label>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="••••" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" required />
            </div>
            {errorLogin && <p className="text-xs text-rose-500 font-bold text-center">{errorLogin}</p>}
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-2xl transition shadow-lg text-sm cursor-pointer mt-2">
              Entrar al Sistema 🚀
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (obraSeleccionada) {
    return (
      <>
        <DetalleObra 
          obra={obraSeleccionada}
          onVolver={() => { setObraSeleccionada(null); cargarProyectos(); }}
          transacciones={transacciones}
          onAbrirModalCompraDolares={() => { 
            setTasaRecepcion(tasaOficialDia); 
            setMontoOriginalRaw(''); 
            setMontoOriginalDisplay(''); 
            setModalCompraDolaresAbierto(true); 
          }}
          onAbrirModalIngreso={() => { 
            setTipoTransaccionActual('INGRESO'); 
            setCategoriaTransaccion('ANTICIPO'); 
            setTasaRecepcion(tasaOficialDia); 
            setMontoOriginalRaw('');
            setMontoOriginalDisplay('');
            setModalTransaccionAbierto(true); 
          }}
          onAbrirModalGasto={() => { 
            setTipoTransaccionActual('EGRESO'); 
            setCategoriaTransaccion('MATERIALES'); 
            setTasaRecepcion(tasaOficialDia); 
            setMontoOriginalRaw('');
            setMontoOriginalDisplay('');
            setModalTransaccionAbierto(true); 
          }}
          onAbrirModalObraExtra={() => setModalObraExtraAbierto(true)}
          formatMoney={formatMoney}
        />

        {/* 💱 MODAL EXCLUSIVO PARA COMPRAR DÓLARES */}
        {modalCompraDolaresAbierto && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black text-blue-700">💱 Compra de Divisas</h3>
                <button onClick={() => setModalCompraDolaresAbierto(false)} className="bg-slate-100 text-slate-600 font-bold w-8 h-8 rounded-full flex items-center justify-center cursor-pointer">✕</button>
              </div>

              <form onSubmit={registrarCompraDolares} className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4">
                    <p className="text-[11px] text-blue-800 font-bold text-center">Se descontarán Bolívares de tu cuenta y se sumarán Dólares netos.</p>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto Dólares a Comprar ($) *</label>
                  <input 
                    type="text" 
                    value={montoOriginalDisplay} 
                    onChange={(e) => handleMoneyInput(e, setMontoOriginalRaw, setMontoOriginalDisplay)} 
                    placeholder="0,00" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-950" 
                    required 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2 p-3 bg-slate-100 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tasa Oficial Intacta</label>
                    <input type="number" value={tasaOficialDia} disabled className="w-full bg-slate-200 border-none rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-600 opacity-80 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-amber-700 uppercase mb-1">Tasa a la que Compras *</label>
                    <input type="number" step="0.0001" value={tasaRecepcion} onChange={(e) => setTasaRecepcion(e.target.value)} className="w-full bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono font-black text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500" required />
                  </div>
                </div>

                {parseFloat(montoOriginalRaw) > 0 && (
                  <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex justify-between items-center mt-2 shadow-inner">
                    <div>
                      <span className="block text-[10px] font-bold text-blue-400 uppercase tracking-wider">Bolívares a Pagar</span>
                      <span className="block text-[10px] text-slate-400">Se debitarán de tu saldo</span>
                    </div>
                    <span className="font-mono text-xl md:text-2xl font-black text-blue-400">Bs. {formatMoney(parseFloat(montoOriginalRaw) * parseFloat(tasaRecepcion))}</span>
                  </div>
                )}

                <div className="pt-4">
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-2xl transition shadow cursor-pointer">
                    Confirmar Compra 💵
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE TRANSACCIÓN NORMAL */}
        {modalTransaccionAbierto && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <h3 className={`text-lg font-black ${tipoTransaccionActual === 'INGRESO' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {tipoTransaccionActual === 'INGRESO' ? '➕ Registrar Ingreso o Anticipo' : '➖ Registrar Gasto Categorizado'}
                </h3>
                <button onClick={() => setModalTransaccionAbierto(false)} className="bg-slate-100 text-slate-600 font-bold w-8 h-8 rounded-full flex items-center justify-center cursor-pointer">✕</button>
              </div>

              <form onSubmit={registrarTransaccion} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                  <select value={categoriaTransaccion} onChange={(e) => setCategoriaTransaccion(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-blue-950">
                    {tipoTransaccionActual === 'INGRESO' ? (
                      <>
                        <option value="ANTICIPO">Anticipo</option>
                        <option value="VALUACION">Valuación</option>
                        <option value="OTRO_INGRESO">Otro Ingreso</option>
                      </>
                    ) : (
                      <>
                        <option value="MATERIALES">Materiales (Cemento, Cabilla, etc.)</option>
                        <option value="MANO_DE_OBRA">Mano de Obra / Nómina</option>
                        <option value="MAQUINARIA">Maquinaria / Equipos</option>
                        <option value="VARIOS">Gastos Varios / Imprevistos</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto / Descripción *</label>
                  <input type="text" value={conceptoTransaccion} onChange={(e) => setConceptoTransaccion(e.target.value)} placeholder="Ej: Compra de materiales" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-950" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda Utilizada</label>
                    <select value={monedaUsada} onChange={(e) => setMonedaUsada(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-blue-950">
                      <option value="BS">Bolívares (Bs)</option>
                      <option value="USD">Dólares ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto Original *</label>
                    <input 
                      type="text" 
                      value={montoOriginalDisplay} 
                      onChange={(e) => handleMoneyInput(e, setMontoOriginalRaw, setMontoOriginalDisplay)} 
                      placeholder="0,00" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-950" 
                      required 
                    />
                  </div>
                </div>

                {monedaUsada === 'BS' && (
                  <div className="grid grid-cols-2 gap-4 mt-2 p-3 bg-slate-100 rounded-2xl border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tasa Oficial Intacta</label>
                      <input type="number" value={tasaOficialDia} disabled className="w-full bg-slate-200 border-none rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-600 opacity-80 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-amber-700 uppercase mb-1">Tasa de Recepción *</label>
                      <input type="number" step="0.0001" value={tasaRecepcion} onChange={(e) => setTasaRecepcion(e.target.value)} className="w-full bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono font-black text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500" required />
                    </div>
                  </div>
                )}

                {parseFloat(montoOriginalRaw) > 0 && (
                  <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex justify-between items-center mt-2 shadow-inner">
                    <div>
                      <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Monto Real ({tipoTransaccionActual})</span>
                      <span className="block text-[10px] text-slate-400">Calculado a Tasa BCV Oficial</span>
                    </div>
                    <span className="font-mono text-xl md:text-2xl font-black text-white">${formatMoney(montoTotalEnDolaresReales)}</span>
                  </div>
                )}

                {esPerdida && monedaUsada === 'BS' && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-xl border border-red-200 text-xs text-center font-bold">
                    ⚠️ Pérdida por Diferencial Cambiario: <span className="font-black text-red-900 text-sm font-mono">-${formatMoney(valorDiferencial)} USD</span>
                  </div>
                )}
                {esGanancia && monedaUsada === 'BS' && (
                  <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-200 text-xs text-center font-bold">
                    ✅ Ganancia por Diferencial: <span className="font-black text-emerald-900 text-sm font-mono">+${formatMoney(valorDiferencial)} USD</span>
                  </div>
                )}

                <div className="pt-4">
                  <button type="submit" className={`w-full text-white font-black py-3.5 rounded-2xl transition shadow cursor-pointer ${tipoTransaccionActual === 'INGRESO' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}>
                    {tipoTransaccionActual === 'INGRESO' ? 'Guardar Ingreso 🚀' : 'Guardar Gasto 💸'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE OBRA EXTRA */}
        {modalObraExtraAbierto && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-amber-800">🧱 Registrar Obra Extra o Trabajo Adicional</h3>
                  <p className="text-xs text-slate-500">Se sumará al costo total y presupuesto global de la obra.</p>
                </div>
                <button onClick={() => setModalObraExtraAbierto(false)} className="bg-slate-100 text-slate-600 font-bold w-8 h-8 rounded-full flex items-center justify-center cursor-pointer">✕</button>
              </div>

              <form onSubmit={guardarObraExtra} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción del Trabajo Extra *</label>
                  <input type="text" value={descripcionExtra} onChange={(e) => setDescripcionExtra(e.target.value)} placeholder="Ej: Construcción de muro perimetral adicional" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-600" required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Costo Estimado ($) *</label>
                    <input type="text" value={costoExtraDisplay} onChange={handleCostoExtraChange} placeholder="Ej: 1.500" className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-mono text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comisión (%)</label>
                    <input type="number" step="0.01" value={porcentajeComisionExtra} onChange={(e) => setPorcentajeComisionExtra(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-mono text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo Ganancia</label>
                    <select value={tipoGananciaExtra} onChange={(e) => setTipoGananciaExtra(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold">
                      <option value="PORCENTAJE">% sobre Costo</option>
                      <option value="MONTO_FIJO">$ Fijo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor de la Ganancia</label>
                  <input type="text" value={valorGananciaExtraDisplay} onChange={handleGananciaExtraChange} placeholder="Ej: 20" className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-mono text-sm" />
                </div>

                <div className="bg-amber-950 text-white rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-black text-amber-400 uppercase">Desglose Fiscal de la Obra Extra</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Base Imponible (Costo): <span className="font-mono font-bold">${formatMoney(costoExtraNum)}</span></div>
                    <div>IVA (16% sobre Base): <span className="font-mono font-bold">${formatMoney(ivaExtraCalc)}</span></div>
                    <div className="col-span-2 pt-1 border-t border-amber-900">Total Factura Cliente: <span className="font-mono font-black text-amber-300 text-sm">${formatMoney(totalExtraCalc)}</span></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 mt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hitos de esta Obra Extra</label>
                  <div className="flex gap-2 mb-3">
                    <input type="text" value={nuevoObjetivoExtra} onChange={(e) => setNuevoObjetivoExtra(e.target.value)} placeholder="Ej: Demolición de pared" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500" />
                    <button type="button" onClick={() => { if(nuevoObjetivoExtra.trim()){ setListaObjetivosExtra([...listaObjetivosExtra, nuevoObjetivoExtra.trim()]); setNuevoObjetivoExtra('');} }} className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-slate-800">Agregar</button>
                  </div>
                  <div className="space-y-1">
                    {listaObjetivosExtra.map((obj, i) => (
                      <div key={i} className="flex justify-between items-center bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 text-xs text-amber-900 font-bold">
                        <span>📌 {obj}</span>
                        <button type="button" onClick={() => setListaObjetivosExtra(listaObjetivosExtra.filter((_, idx)=>idx!==i))} className="text-red-500 hover:text-red-700 cursor-pointer">Borrar</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3.5 rounded-2xl transition shadow cursor-pointer">
                    Guardar y Sumar Obra Extra 🚀
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <DashboardObras 
        proyectos={proyectos}
        tasaHoy={tasaHoy}
        onSeleccionarObra={(obra) => setObraSeleccionada(obra)}
        onAbrirModal={() => setModalAbierto(true)}
        formatMoney={formatMoney}
      />

      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-8 max-w-3xl w-full shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">🏗️ Registrar Nueva Obra Completa</h2>
                <p className="text-xs text-slate-500">Configuración financiera (Ganancia y Comisión separadas del Total).</p>
              </div>
              <button onClick={() => setModalAbierto(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition">✕</button>
            </div>

            <form onSubmit={guardarProyectoCompleto} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre de la Obra *</label>
                  <input type="text" value={nombreObra} onChange={(e) => setNombreObra(e.target.value)} placeholder="Ej: Remodelación Torre" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 focus:outline-none focus:border-emerald-600 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cliente / Dueño *</label>
                  <input type="text" value={clienteObra} onChange={(e) => setClienteObra(e.target.value)} placeholder="Ej: Inversiones C.A." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 focus:outline-none focus:border-emerald-600 text-sm" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ubicación</label>
                <input type="text" value={ubicacionObra} onChange={(e) => setUbicacionObra(e.target.value)} placeholder="Ej: Macuto, Estado La Guaira" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 focus:outline-none focus:border-emerald-600 text-sm" />
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4">
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Parámetros Financieros, Comisión y Tasa BCV</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Costo Estimado ($) *</label>
                    <input type="text" value={costoEstimadoDisplay} onChange={handleCostoChange} placeholder="Ej: 5.000" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comisión Base (%)</label>
                    <input type="number" step="0.01" value={porcentajeComision} onChange={(e) => setPorcentajeComision(e.target.value)} placeholder="Ej: 15" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-emerald-700 uppercase mb-1">Tasa BCV del Presupuesto</label>
                    <input type="number" step="0.0001" value={tasaPresupuesto} onChange={(e) => setTasaPresupuesto(e.target.value)} placeholder="Ej: 757.54" className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm font-bold" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Ganancia</label>
                    <select value={tipoGanancia} onChange={(e) => setTipoGanancia(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold">
                      <option value="PORCENTAJE">Porcentaje sobre Costo (%)</option>
                      <option value="MONTO_FIJO">Monto Fijo en Dólares ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor de la Ganancia</label>
                    <input type="text" value={valorGananciaDisplay} onChange={handleGananciaChange} placeholder="Ej: 30" className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono text-sm" />
                  </div>
                </div>
              </div>

              <div className="bg-emerald-950 text-white border border-emerald-900 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] sm:text-xs font-black text-emerald-400 uppercase tracking-widest">Desglose Financiero</p>
                  <span className="text-[10px] bg-emerald-900 text-emerald-200 px-2 py-0.5 rounded font-mono">Tasa: {formatMoney(tasaUsadaNum)} Bs/$</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-3 rounded-xl overflow-hidden">
                    <span className="block text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">Ganancia (Ref)</span>
                    <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm tracking-tight truncate block">${formatMoney(gananciaCalculada)}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-3 rounded-xl overflow-hidden">
                    <span className="block text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">Base Imp.</span>
                    <span className="font-mono font-black text-white text-xs sm:text-sm tracking-tight truncate block">${formatMoney(baseImponibleCalculada)}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-3 rounded-xl overflow-hidden">
                    <span className="block text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">Comisión (Ref)</span>
                    <span className="font-mono font-black text-white text-xs sm:text-sm tracking-tight truncate block">${formatMoney(comisionCalculada)}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-3 rounded-xl overflow-hidden">
                    <span className="block text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">IVA (16%)</span>
                    <span className="font-mono font-black text-white text-xs sm:text-sm tracking-tight truncate block">${formatMoney(ivaCalculado)}</span>
                  </div>
                  <div className="bg-emerald-600 border border-emerald-500 p-2.5 sm:p-3 rounded-xl col-span-2 sm:col-span-1 overflow-hidden">
                    <span className="block text-[8px] sm:text-[9px] font-black text-emerald-100 uppercase tracking-tight truncate">Total ($)</span>
                    <span className="font-mono font-black text-white text-xs sm:text-sm tracking-tight truncate block">${formatMoney(presupuestoTotalCalculado)}</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-emerald-500/30 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                  <span className="text-xs font-bold text-slate-300 uppercase">Total en Bolívares (Bs):</span>
                  <span className="font-mono font-black text-emerald-400 text-sm sm:text-base break-all">Bs. {formatMoney(totalEnBolivares)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pasos o Hitos Iniciales</label>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={nuevoObjetivo} onChange={(e) => setNuevoObjetivo(e.target.value)} placeholder="Ej: Vaciado de columnas" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" />
                  <button type="button" onClick={agregarObjetivoTemporal} className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-3 rounded-xl text-sm cursor-pointer">Agregar</button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-2">
                  {listaObjetivos.map((obj, index) => (
                    <div key={index} className="flex justify-between items-center bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 text-sm">
                      <span className="font-semibold text-slate-800">📌 {obj}</span>
                      <button type="button" onClick={() => eliminarObjetivoTemporal(index)} className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer">Eliminar</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition shadow-xl text-base cursor-pointer">
                  Guardar Obra con Desglose Fiscal Exacto 
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}