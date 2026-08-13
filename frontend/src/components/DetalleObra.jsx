import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function DetalleObra({ 
  obra, 
  onVolver, 
  transacciones, 
  onAbrirModalIngreso, 
  onAbrirModalGasto, 
  onAbrirModalObraExtra,
  onAbrirModalCompraDolares,
  formatMoney 
}) {
  const [hitos, setHitos] = useState([]);
  const [nuevoHitoTexto, setNuevoHitoTexto] = useState('');
  const [nuevoHitoExtraTextos, setNuevoHitoExtraTextos] = useState({});
  const [presupuestos, setPresupuestos] = useState([]);
  const [pagosComision, setPagosComision] = useState([]);
  const [tasaHoyGlobal, setTasaHoyGlobal] = useState(1);
  const [obraFinalizada, setObraFinalizada] = useState(obra.estado === 'FINALIZADA');
  const [mostrarResumen, setMostrarResumen] = useState(false); 

  const [modalComisionAbierto, setModalComisionAbierto] = useState(false);
  const [monedaPago, setMonedaPago] = useState('BS');
  const [montoPagoRaw, setMontoPagoRaw] = useState('');
  const [montoPagoDisplay, setMontoPagoDisplay] = useState('');
  const [tasaPagoComision, setTasaPagoComision] = useState('');

  const [modalInfoAbierto, setModalInfoAbierto] = useState(false);
  const [modalDetalleFinanciero, setModalDetalleFinanciero] = useState(null);

  useEffect(() => {
    cargarDatosObra();
    axios.get('http://localhost:3000/api/tasas/actual').then(res => {
      if (res.data?.tasa_bcv_usd) setTasaHoyGlobal(res.data.tasa_bcv_usd);
    }).catch(() => {});
  }, [obra.id]);

  const cargarDatosObra = () => {
    axios.get(`http://localhost:3000/api/objetivos/${obra.id}`)
      .then(res => setHitos(res.data))
      .catch(err => console.error("Error cargando hitos:", err));

    axios.get(`http://localhost:3000/api/proyectos/${obra.id}/detalle`)
      .then(res => {
        setPresupuestos(res.data.presupuestos);
        setPagosComision(res.data.pagos_comision || []);
        if (res.data.proyecto?.estado === 'FINALIZADA') {
          setObraFinalizada(true);
        }
      })
      .catch(err => console.error("Error cargando presupuestos:", err));
  };

  const toggleHito = (id, estadoActual) => {
    if (obraFinalizada) return;
    axios.patch(`http://localhost:3000/api/objetivos/${id}`, { completado: !estadoActual })
      .then(() => setHitos(hitos.map(h => h.id === id ? { ...h, completado: !estadoActual } : h)))
      .catch(err => console.error("Error actualizando hito:", err));
  };

  const presupuestoBaseObj = presupuestos.find(p => p.tipo === 'BASE');
  const basePresupuestoId = presupuestoBaseObj?.id || null;

  const agregarNuevoHito = (e) => {
    e.preventDefault();
    if (!nuevoHitoTexto.trim() || obraFinalizada) return;
    axios.post('http://localhost:3000/api/objetivos', { 
        proyecto_id: obra.id, 
        descripcion: nuevoHitoTexto.trim(),
        presupuesto_id: basePresupuestoId 
    })
    .then(res => {
      setHitos([...hitos, res.data]);
      setNuevoHitoTexto('');
    })
    .catch(err => alert("Error al agregar hito."));
  };

  const agregarNuevoHitoExtra = (e, presupuestoId) => {
    e.preventDefault();
    const textoExtra = nuevoHitoExtraTextos[presupuestoId];
    if (!textoExtra?.trim() || obraFinalizada) return;
    
    axios.post('http://localhost:3000/api/objetivos', { 
        proyecto_id: obra.id, 
        descripcion: textoExtra.trim(),
        presupuesto_id: presupuestoId 
    })
    .then(res => {
      setHitos([...hitos, res.data]);
      setNuevoHitoExtraTextos(prev => ({ ...prev, [presupuestoId]: '' }));
    })
    .catch(err => alert("Error al agregar hito extra."));
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

  const registrarPagoComision = (e) => {
    e.preventDefault();
    if (!montoPagoRaw || !tasaPagoComision) return alert("Completa los datos del pago.");
    axios.post('http://localhost:3000/api/pagos-comision', {
      proyecto_id: obra.id,
      moneda_usada: monedaPago,
      monto_original: parseFloat(montoPagoRaw),
      tasa_cambio: parseFloat(tasaPagoComision),
      tasa_oficial: tasaHoyGlobal
    }).then(() => {
      cargarDatosObra();
      setModalComisionAbierto(false);
      setMontoPagoRaw(''); 
      setMontoPagoDisplay('');
      alert("¡Pago de comisión registrado con éxito!");
    }).catch(err => alert("Error registrando pago de comisión"));
  };

  const finalizarObraTotal = () => {
    if (!window.confirm("¿Seguro que deseas FINALIZAR esta obra? Generará el reporte ejecutivo de cierre.")) return;
    axios.post(`http://localhost:3000/api/proyectos/${obra.id}/finalizar`)
      .then(() => {
        setObraFinalizada(true);
        setHitos(hitos.map(h => ({ ...h, completado: true })));
        setMostrarResumen(true); 
      })
      .catch(err => alert("Error al finalizar la obra."));
  };

  const totalHitos = hitos.length;
  const hitosCompletados = hitos.filter(h => h.completado).length;
  const porcentajeAvance = obraFinalizada ? 100 : (totalHitos > 0 ? Math.round((hitosCompletados / totalHitos) * 100) : 0);

  const hitosBase = hitos.filter(h => !h.presupuesto_id || String(h.presupuesto_id) === String(basePresupuestoId));

  let totalIngresosUSD = 0;
  let totalEgresosUSD = 0;
  let balanceDiferencialCambiario = 0; 
  let ingresosBsPuros = 0;
  let ingresosUsdPuros = 0;
  let gastosBsPuros = 0;
  let gastosUsdPuros = 0;
  let gastosBsConvertidosUSD = 0;
  
  transacciones.forEach(tx => {
    const montoReal = tx.moneda_usada === 'BS' ? (parseFloat(tx.monto_moneda_original) / parseFloat(tx.tasa_oficial_dia)) : parseFloat(tx.monto_usd_real);
    const montoOriginal = parseFloat(tx.monto_moneda_original) || 0;
    
    if (tx.tipo === 'INGRESO') {
      totalIngresosUSD += montoReal;
      if (tx.moneda_usada === 'BS') ingresosBsPuros += montoOriginal;
      else ingresosUsdPuros += montoOriginal;
    } else {
      totalEgresosUSD += montoReal;
      if (tx.moneda_usada === 'BS') {
          gastosBsPuros += montoOriginal;
          gastosBsConvertidosUSD += montoReal;
      } else {
          gastosUsdPuros += montoOriginal;
      }
    }

    if(tx.moneda_usada === 'BS') {
        const dolaresOficial = parseFloat(tx.monto_moneda_original) / parseFloat(tx.tasa_oficial_dia);
        const dolaresRecepcion = parseFloat(tx.monto_moneda_original) / parseFloat(tx.tasa_bcv_momento); 
        
        if (tx.tipo === 'INGRESO') {
            balanceDiferencialCambiario += (dolaresOficial - dolaresRecepcion);
        } else {
            balanceDiferencialCambiario += (dolaresRecepcion - dolaresOficial);
        }
    }
  });

  const saldoEnCuentaUSD = totalIngresosUSD - totalEgresosUSD;
  const saldoBsPuro = ingresosBsPuros - gastosBsPuros;
  const saldoUsdPuro = ingresosUsdPuros - gastosUsdPuros;
  
  const pOriginalTotal = parseFloat(presupuestoBaseObj?.presupuesto_total_usd) || 0;
  const costoBaseOriginal = parseFloat(presupuestoBaseObj?.base_imponible_usd) || 0;
  const comisionBasePorcentaje = presupuestoBaseObj?.porcentaje_comision || 15;
  const pOriginalComision = parseFloat(presupuestoBaseObj?.comision_usd) || 0;
  
  // 🔥 LÓGICA DE MATEMÁTICAS DETALLADAS PARA EL RESUMEN EJECUTIVO
  let totalComisionRef = 0;
  let gananciaEsperadaBase = 0;
  let gananciaEsperadaExtra = 0;
  let sumaObrasExtrasTotal = 0;

  presupuestos.forEach(p => {
    totalComisionRef += parseFloat(p.comision_usd) || 0;
    
    if(p.tipo === 'BASE') {
        gananciaEsperadaBase += parseFloat(p.ganancia_esperada_usd) || 0;
    }
    if(p.tipo === 'EXTRA') {
        gananciaEsperadaExtra += parseFloat(p.ganancia_esperada_usd) || 0;
        sumaObrasExtrasTotal += parseFloat(p.presupuesto_total_usd) || 0;
    }
  });

  const totalGananciaEsperada = gananciaEsperadaBase + gananciaEsperadaExtra;

  let totalComisionPagadaUSD = 0;
  pagosComision.forEach(p => {
    totalComisionPagadaUSD += parseFloat(p.monto_abonado_usd) || 0;
  });

  const comisionPendienteUSD = totalComisionRef - totalComisionPagadaUSD;
  const costoGlobalProyecto = pOriginalTotal + sumaObrasExtrasTotal;
  const miGananciaRealMio = saldoEnCuentaUSD - comisionPendienteUSD;
  const porcentajeRealResultante = costoGlobalProyecto > 0 ? ((miGananciaRealMio / costoGlobalProyecto) * 100).toFixed(2) : 0;

  // 🔥 VISTA TEMPORAL: EL RESUMEN EJECUTIVO (TOMA TODA LA PANTALLA)
  if (mostrarResumen) {
      return (
          <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 font-sans flex flex-col">
              <button onClick={() => setMostrarResumen(false)} className="self-start mb-6 text-slate-400 hover:text-white font-bold text-sm cursor-pointer">
                 ← Volver al Panel de la Obra
              </button>
              
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-5xl mx-auto w-full shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-purple-500 to-amber-500"></div>
                  
                  <div className="text-center mb-10 mt-4">
                      <h1 className="text-4xl font-black mb-2">📑 Resumen Ejecutivo Final</h1>
                      <p className="text-slate-400 text-lg">{obra.nombre} - <span className="text-emerald-400 font-bold">{obra.cliente}</span></p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700">
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Presupuesto Original</p>
                          <p className="font-mono text-2xl font-black">${formatMoney(pOriginalTotal)}</p>
                      </div>
                      <div className="bg-amber-900/20 p-5 rounded-2xl border border-amber-900/50">
                          <p className="text-[11px] text-amber-500 font-bold uppercase tracking-wider mb-1">Total Obras Extra (+)</p>
                          <p className="font-mono text-2xl font-black text-amber-400">${formatMoney(sumaObrasExtrasTotal)}</p>
                      </div>
                      <div className="bg-emerald-900/20 p-5 rounded-2xl border border-emerald-900/50">
                          <p className="text-[11px] text-emerald-500 font-bold uppercase tracking-wider mb-1">Total Ingresado (Real)</p>
                          <p className="font-mono text-2xl font-black text-emerald-400">${formatMoney(totalIngresosUSD)}</p>
                      </div>
                      <div className="bg-rose-900/20 p-5 rounded-2xl border border-rose-900/50">
                          <p className="text-[11px] text-rose-500 font-bold uppercase tracking-wider mb-1">Total Gastado</p>
                          <p className="font-mono text-2xl font-black text-rose-400">${formatMoney(totalEgresosUSD)}</p>
                      </div>
                  </div>

                  {/* 🔥 NUEVO DESGLOSE DE PRESUPUESTOS (BASE Y EXTRAS) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 mb-8">
                      <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">📋 Desglose de Presupuestos Aprobados</h3>
                      
                      <div className="space-y-3">
                          {presupuestos.map(p => (
                              <div key={p.id} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                  <div>
                                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded mb-2 inline-block ${p.tipo === 'BASE' ? 'bg-blue-900/50 text-blue-300' : 'bg-amber-900/50 text-amber-300'}`}>
                                          Presupuesto {p.tipo}
                                      </span>
                                      <p className="text-sm font-bold text-white">{p.descripcion}</p>
                                  </div>
                                  <div className="text-right">
                                      <span className="block text-[10px] text-slate-400 uppercase">Total Aprobado</span>
                                      <span className={`font-mono font-black text-lg ${p.tipo === 'BASE' ? 'text-blue-400' : 'text-amber-400'}`}>
                                          ${formatMoney(p.presupuesto_total_usd)}
                                      </span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="col-span-2 bg-slate-950 rounded-3xl p-6 border border-slate-800 space-y-6">
                          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                              <span className="text-slate-300 font-bold">💰 Saldo Total en Cuenta (Caja Fuerte)</span>
                              <span className="font-mono text-xl font-black text-white">${formatMoney(saldoEnCuentaUSD)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                              <span className="text-slate-300 font-bold">🤝 Comisión Pendiente a Entregar</span>
                              <span className="font-mono text-xl font-black text-orange-400">-${formatMoney(comisionPendienteUSD)}</span>
                          </div>
                          
                          <div className={`flex justify-between items-center border-b ${balanceDiferencialCambiario < 0 ? 'border-red-900/30 bg-red-950/20' : 'border-emerald-900/30 bg-emerald-950/20'} pb-4 -mx-6 px-6 pt-4`}>
                              <div>
                                  <span className={`block font-bold ${balanceDiferencialCambiario < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                                      {balanceDiferencialCambiario < 0 ? '📉 Pérdida por Diferencial' : '📈 Ganancia por Diferencial'}
                                  </span>
                                  <span className={`text-[10px] ${balanceDiferencialCambiario < 0 ? 'text-red-400/70' : 'text-emerald-400/70'}`}>
                                      Sumatoria de variaciones al recibir/pagar bolívares
                                  </span>
                              </div>
                              <span className={`font-mono text-xl font-black ${balanceDiferencialCambiario < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {balanceDiferencialCambiario < 0 ? '-' : '+'}${formatMoney(Math.abs(balanceDiferencialCambiario))}
                              </span>
                          </div>
                          
                          <div className="flex justify-between items-center pt-2">
                              <span className="text-emerald-400 font-black text-xl md:text-2xl uppercase">💎 Mi Ganancia Libre</span>
                              <span className="font-mono text-3xl font-black text-emerald-400">${formatMoney(miGananciaRealMio)}</span>
                          </div>
                      </div>

                      <div className="bg-purple-900/20 rounded-3xl p-6 border border-purple-800/50 flex flex-col justify-center text-center">
                          <p className="text-xs font-black text-purple-300 uppercase tracking-widest mb-4">Análisis de Rentabilidad</p>
                          
                          {/* 🔥 NUEVO DESGLOSE DE LA GANANCIA ESPERADA */}
                          <div className="mb-6 bg-slate-950/50 p-4 rounded-xl border border-purple-800/30">
                              <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Desglose de Ganancia Esperada</p>
                              <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs text-slate-400">De la Obra Base:</span>
                                  <span className="font-mono text-sm font-bold text-emerald-400">${formatMoney(gananciaEsperadaBase)}</span>
                              </div>
                              <div className="flex justify-between items-center mb-3 border-b border-purple-800/30 pb-3">
                                  <span className="text-xs text-slate-400">De las Obras Extra:</span>
                                  <span className="font-mono text-sm font-bold text-emerald-400">${formatMoney(gananciaEsperadaExtra)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                  <span className="text-[11px] font-bold text-slate-300 uppercase">Total Esperado:</span>
                                  <span className="font-mono text-lg font-black text-white">${formatMoney(totalGananciaEsperada)}</span>
                              </div>
                          </div>
                          
                          <p className="text-sm text-slate-400 mb-1">Porcentaje de Ganancia Final Real:</p>
                          <div className="w-32 h-32 mx-auto rounded-full border-8 border-purple-500 flex items-center justify-center bg-purple-950/50 shadow-inner">
                              <span className="text-3xl font-black text-purple-300">{porcentajeRealResultante}%</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-4 leading-tight">Calculado dividiendo tu Ganancia Libre entre el Costo Global del Proyecto.</p>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // --- VISTA NORMAL DE LA OBRA ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between mb-8">
            <button onClick={onVolver} className="bg-white border border-slate-200 hover:bg-slate-100 px-5 py-2.5 rounded-xl font-bold transition shadow-sm text-sm cursor-pointer">
            ← Volver al Panel Principal
            </button>
            {obraFinalizada && (
                <button onClick={()=>setMostrarResumen(true)} className="bg-purple-700 hover:bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black transition shadow-xl text-sm cursor-pointer">
                📑 Ver Resumen de Cierre
                </button>
            )}
        </div>
        
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-100 pb-6">
            <div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${obraFinalizada ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {obraFinalizada ? 'FINALIZADA' : obra.estado}
                </span>
                <button 
                  onClick={() => setModalInfoAbierto(true)}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-black text-xs flex items-center justify-center shadow-sm cursor-pointer transition"
                  title="Ver datos iniciales de la obra"
                >
                  ℹ️
                </button>
              </div>
              <h1 className="text-3xl font-black text-slate-900 mt-2">{obra.nombre}</h1>
              <p className="text-slate-500 text-sm mt-1">👤 Cliente: <span className="font-semibold text-slate-700">{obra.cliente}</span> | 📍 Ubicación: <span className="font-semibold text-slate-700">{obra.ubicacion || 'No especificada'}</span></p>
            </div>
            
            {!obraFinalizada && (
              <div className="flex flex-wrap gap-3">
                <button onClick={onAbrirModalObraExtra} className="bg-amber-600 hover:bg-amber-500 text-white font-black px-4 py-3 rounded-2xl text-sm transition cursor-pointer">➕ Obra Extra</button>
                <button onClick={onAbrirModalIngreso} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-3 rounded-2xl text-sm transition cursor-pointer">➕ Ingreso</button>
                <button onClick={onAbrirModalGasto} className="bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-3 rounded-2xl text-sm transition cursor-pointer">➖ Gasto</button>
                <button onClick={onAbrirModalCompraDolares} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-3 rounded-2xl text-sm transition cursor-pointer">💱 Comprar Divisas</button>
              </div>
            )}
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-800 bg-orange-100 px-2.5 py-1 rounded-full">Control de Comisión General</span>
              <div className="flex flex-wrap items-baseline gap-6 mt-3">
                <div>
                   <p className="text-[11px] text-slate-500 uppercase font-bold">Comisión Total Acumulada:</p>
                   <p className="font-mono text-xl font-black text-slate-900">${formatMoney(totalComisionRef)}</p>
                </div>
                <div>
                   <p className="text-[11px] text-slate-500 uppercase font-bold">Ya Pagado:</p>
                   <p className="font-mono text-xl font-black text-emerald-600">-${formatMoney(totalComisionPagadaUSD)}</p>
                </div>
                <div>
                   <p className="text-[11px] text-slate-500 uppercase font-bold">Comisión Pendiente:</p>
                   <p className="font-mono text-2xl font-black text-orange-600">${formatMoney(comisionPendienteUSD)}</p>
                </div>
              </div>
            </div>
            {!obraFinalizada && (
              <button onClick={() => { setTasaPagoComision(tasaHoyGlobal); setModalComisionAbierto(true); }} className="bg-orange-600 hover:bg-orange-500 text-white font-black px-5 py-3 rounded-xl text-xs shadow transition cursor-pointer">
                💳 Registrar Pago de Comisión
              </button>
            )}
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 mb-8 shadow-inner border-2 border-emerald-500/20">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">🌍 Avance Global de la Obra (Base + Extras)</h3>
              <span className="font-mono text-sm font-bold bg-emerald-950 text-emerald-300 px-3 py-1 rounded-full border border-emerald-800">
                {porcentajeAvance}% Completado
              </span>
            </div>
            <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden mb-2 shadow-inner">
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-500" style={{ width: `${porcentajeAvance}%` }}></div>
            </div>
            <p className="text-[10px] text-slate-400 text-right">Suma de todos los hitos (Obra original + Obras Extra)</p>
          </div>

          <div className="bg-slate-100/50 border border-slate-200 rounded-2xl p-6 mb-8">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">🛠️ Pasos / Hitos Obra Base</h3>
             </div>
             
            {!obraFinalizada && (
              <form onSubmit={agregarNuevoHito} className="flex gap-2 mb-4">
                <input 
                    type="text" 
                    value={nuevoHitoTexto} 
                    onChange={(e) => setNuevoHitoTexto(e.target.value)} 
                    placeholder="Escribe un nuevo hito para la OBRA BASE..." 
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-slate-500 shadow-sm" 
                />
                <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition">Agregar Hito Base 📌</button>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {hitosBase.map((hito) => (
                <label key={hito.id} className={`flex items-start gap-3 p-3 rounded-xl border transition ${hito.completado || obraFinalizada ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-slate-200 text-slate-700'} ${!obraFinalizada ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}`}>
                  <input type="checkbox" checked={hito.completado || obraFinalizada} disabled={obraFinalizada} onChange={() => toggleHito(hito.id, hito.completado)} className="mt-1 w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
                  <span className={`text-xs font-semibold leading-tight ${hito.completado || obraFinalizada ? 'line-through opacity-70' : ''}`}>{hito.descripcion}</span>
                </label>
              ))}
              {hitosBase.length === 0 && <p className="text-xs text-slate-400 italic">No hay hitos base registrados.</p>}
            </div>
          </div>

          <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-6 mb-8">
            <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider mb-4">🧱 Obras Extra Registradas ({presupuestos.filter(p => p.tipo === 'EXTRA').length})</h3>
            
            {presupuestos.filter(p => p.tipo === 'EXTRA').length === 0 ? (
              <p className="text-xs text-amber-700/80">No hay obras extra registradas.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {presupuestos.filter(p => p.tipo === 'EXTRA').map(extra => {
                  const hitosDeEsteExtra = hitos.filter(h => String(h.presupuesto_id) === String(extra.id));
                  const extraCompletados = hitosDeEsteExtra.filter(h => h.completado).length;
                  const extraTotalHitos = hitosDeEsteExtra.length;
                  const extraAvance = obraFinalizada ? 100 : (extraTotalHitos > 0 ? Math.round((extraCompletados / extraTotalHitos) * 100) : 0);

                  return (
                  <div key={extra.id} className="bg-white border border-amber-200 p-5 rounded-2xl shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 border-b border-amber-100 pb-4">
                      <div>
                        <span className="font-black text-slate-900 block text-sm">{extra.descripcion}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 block">Presupuesto Extra Asignado</span>
                      </div>
                      <span className="font-mono font-black text-amber-800 text-base bg-amber-100 px-4 py-2 rounded-xl border border-amber-200">${formatMoney(extra.presupuesto_total_usd)}</span>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between text-[10px] font-bold text-amber-800 uppercase mb-1">
                            <span>Avance de esta sección</span>
                            <span>{extraAvance}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${extraAvance}%` }}></div>
                        </div>
                    </div>

                    {!obraFinalizada && (
                        <form onSubmit={(e) => agregarNuevoHitoExtra(e, extra.id)} className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                value={nuevoHitoExtraTextos[extra.id] || ''} 
                                onChange={(e) => setNuevoHitoExtraTextos(prev => ({ ...prev, [extra.id]: e.target.value }))} 
                                placeholder={`Hito para: ${extra.descripcion}...`} 
                                className="flex-1 bg-amber-50/50 border border-amber-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-amber-400" 
                            />
                            <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-2 rounded-lg text-xs cursor-pointer transition">Agregar +</button>
                        </form>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {hitosDeEsteExtra.map((hito) => (
                            <label key={hito.id} className={`flex items-start gap-2 p-2.5 rounded-lg border transition ${hito.completado || obraFinalizada ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'} ${!obraFinalizada ? 'cursor-pointer hover:bg-amber-50' : 'cursor-default'}`}>
                                <input type="checkbox" checked={hito.completado || obraFinalizada} disabled={obraFinalizada} onChange={() => toggleHito(hito.id, hito.completado)} className="mt-0.5 w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer" />
                                <span className={`text-[11px] font-semibold leading-tight ${hito.completado || obraFinalizada ? 'line-through opacity-70' : ''}`}>{hito.descripcion}</span>
                            </label>
                        ))}
                        {hitosDeEsteExtra.length === 0 && <p className="text-[11px] text-slate-400 italic">Sin hitos registrados.</p>}
                    </div>

                  </div>
                )})}
              </div>
            )}
          </div>

          {/* 💰 4 CUADROS FINANCIEROS EN VIVO */}
          <div className="mb-4 mt-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">💰</span>
              <h3 className="text-lg font-black text-slate-800">Resumen Financiero en Vivo</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div 
                onClick={() => setModalDetalleFinanciero('INGRESOS')} 
                className="bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-300 rounded-2xl p-5 shadow-sm transition cursor-pointer group"
              >
                <span className="block text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-1 group-hover:text-emerald-600">Total Ingresos (USD)</span>
                <span className="font-mono font-black text-emerald-600 text-2xl group-hover:text-emerald-500">${formatMoney(totalIngresosUSD)}</span>
                <span className="block text-[10px] text-emerald-700/70 mt-1 font-bold">Ver detalles Bs y $ →</span>
              </div>
              
              <div 
                onClick={() => setModalDetalleFinanciero('GASTOS')} 
                className="bg-rose-50/70 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-2xl p-5 shadow-sm transition cursor-pointer group"
              >
                <span className="block text-[10px] font-black text-rose-800 uppercase tracking-wider mb-1 group-hover:text-rose-600">Total Gastos (USD)</span>
                <span className="font-mono font-black text-rose-600 text-2xl group-hover:text-rose-500">${formatMoney(totalEgresosUSD)}</span>
                <span className="block text-[10px] text-rose-700/70 mt-1 font-bold">Ver detalles Bs y $ →</span>
              </div>
              
              <div 
                onClick={() => setModalDetalleFinanciero('SALDO')} 
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-5 shadow-sm transition cursor-pointer group"
              >
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 group-hover:text-white">Saldo en Cuenta Total</span>
                <span className="font-mono font-black text-white text-2xl">${formatMoney(saldoEnCuentaUSD)}</span>
                <span className="block text-[10px] text-slate-500 mt-1 font-bold">Ver disponibilidad real →</span>
              </div>

              {/* DIFERENCIAL CAMBIARIO (INTERACTIVO) */}
              <div 
                  onClick={() => setModalDetalleFinanciero('DIFERENCIAL')}
                  className={`border rounded-2xl p-5 shadow-sm flex flex-col justify-center cursor-pointer transition group hover:shadow-md ${balanceDiferencialCambiario < 0 ? 'bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-300'}`}
              >
                  <span className={`block text-[10px] font-black uppercase tracking-wider mb-1 transition ${balanceDiferencialCambiario < 0 ? 'text-red-800 group-hover:text-red-600' : 'text-emerald-800 group-hover:text-emerald-600'}`}>
                      {balanceDiferencialCambiario < 0 ? '📉 Diferencial Cambiario' : '📈 Diferencial Cambiario'}
                  </span>
                  <span className={`font-mono font-black text-2xl transition ${balanceDiferencialCambiario < 0 ? 'text-red-600 group-hover:text-red-500' : 'text-emerald-600 group-hover:text-emerald-500'}`}>
                      {balanceDiferencialCambiario < 0 ? '-' : '+'}${formatMoney(Math.abs(balanceDiferencialCambiario))}
                  </span>
                  <span className={`block text-[9px] mt-1 font-bold transition ${balanceDiferencialCambiario < 0 ? 'text-red-700/70' : 'text-emerald-700/70'}`}>
                      Ver historial detallado →
                  </span>
              </div>
            </div>
          </div>

          <div className="mb-10 mt-6">
            <h3 className="text-lg font-black text-slate-800 mb-4">📋 Registro Contable</h3>
            {transacciones.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500">
                    Aún no hay transacciones registradas.
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead className="bg-slate-100 border-b border-slate-200">
                            <tr>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Fecha / Tipo</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Concepto</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Monto Original</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Tasa BCV del Día</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">Tasa Recepción</th>
                                <th className="p-4 text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Monto Real (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {transacciones.map((tx) => {
                                const montoDolaresTabla = tx.moneda_usada === 'BS' ? (parseFloat(tx.monto_moneda_original) / parseFloat(tx.tasa_oficial_dia)) : parseFloat(tx.monto_usd_real);
                                return (
                                <tr key={tx.id} className="hover:bg-slate-50 transition">
                                    <td className="p-4">
                                        <span className="block text-slate-500 font-mono text-xs">{new Date(tx.fecha).toLocaleDateString()}</span>
                                        <span className={`text-[10px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded ${tx.tipo === 'INGRESO' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>{tx.tipo}</span>
                                    </td>
                                    
                                    <td className="p-4">
                                        <span className="font-bold text-slate-800 text-sm block max-w-[200px] truncate">{tx.concepto}</span>
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{tx.categoria || 'GENERAL'}</span>
                                    </td>
                                    
                                    <td className="p-4 text-sm font-mono font-semibold text-slate-600">
                                        {tx.moneda_usada === 'BS' ? 'Bs.' : '$'} {formatMoney(tx.monto_moneda_original)}
                                    </td>
                                    <td className="p-4 text-center font-mono text-xs text-slate-400">
                                        {tx.moneda_usada === 'BS' ? formatMoney(tx.tasa_oficial_dia) : '-'}
                                    </td>
                                    <td className="p-4 text-center font-mono text-xs font-bold text-amber-700">
                                        {tx.moneda_usada === 'BS' ? formatMoney(tx.tasa_bcv_momento) : '-'}
                                    </td>
                                    <td className={`p-4 text-right font-mono font-black text-sm ${tx.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {tx.tipo === 'INGRESO' ? '+' : '-'}${formatMoney(montoDolaresTabla)}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            )}
          </div>

          {!obraFinalizada && (
            <div className="pt-8 border-t border-slate-100 flex justify-center mt-8">
              <button onClick={finalizarObraTotal} className="bg-purple-700 hover:bg-purple-600 text-white font-black px-10 py-5 rounded-2xl transition shadow-xl text-sm md:text-base hover:scale-105 transform cursor-pointer">
                🏁 CERRAR OBRA Y VER RESUMEN FINAL
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ℹ️ MODAL INFORMATIVO BASE */}
      {modalInfoAbierto && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-black text-slate-900">Datos Base</h3>
              <button onClick={() => setModalInfoAbierto(false)} className="text-slate-400 hover:text-rose-500 font-black cursor-pointer">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre de la Obra</span>
                <span className="block text-sm font-black text-slate-800">{obra.nombre}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cliente</span>
                <span className="block text-sm font-black text-slate-800">{obra.cliente}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ubicación</span>
                <span className="block text-sm font-black text-slate-800">{obra.ubicacion || 'No especificada'}</span>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Presupuesto Base Original (Sin Extras)</span>
                <span className="font-mono text-2xl font-black text-blue-600">${formatMoney(pOriginalTotal)}</span>
              </div>
              <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                <span className="block text-[10px] font-bold text-orange-800 uppercase tracking-wider mb-1">Comisión Base Acordada</span>
                <span className="font-mono text-xl font-black text-orange-600">${formatMoney(pOriginalComision)}</span>
                <span className="text-xs font-bold text-orange-800/60 ml-2">({comisionBasePorcentaje}%)</span>
              </div>
            </div>
            
            <button onClick={() => setModalInfoAbierto(false)} className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl cursor-pointer">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* 📊 MODALES DE DETALLES FINANCIEROS (INTERACTIVOS DE LAS TARJETAS) */}
      {modalDetalleFinanciero && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-black text-slate-900">
                {modalDetalleFinanciero === 'INGRESOS' && 'Detalle de Ingresos'}
                {modalDetalleFinanciero === 'GASTOS' && 'Detalle de Gastos'}
                {modalDetalleFinanciero === 'SALDO' && 'Disponibilidad Real'}
                {modalDetalleFinanciero === 'DIFERENCIAL' && 'Historial Diferencial'}
              </h3>
              <button onClick={() => setModalDetalleFinanciero(null)} className="text-slate-400 hover:text-rose-500 font-black cursor-pointer">✕</button>
            </div>
            
            {modalDetalleFinanciero === 'INGRESOS' && (
                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ingresos en Bolívares</span>
                        <span className="font-mono text-xl font-black text-slate-800">Bs. {formatMoney(ingresosBsPuros)}</span>
                        {ingresosBsPuros >= 0 && (
                            <span className="block text-[10px] font-bold text-emerald-600 mt-1">≈ ${formatMoney(ingresosBsPuros / tasaHoyGlobal)} USD (Tasa BCV del Día)</span>
                        )}
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                        <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Ingresos Dólares Puros</span>
                        <span className="font-mono text-xl font-black text-emerald-600">${formatMoney(ingresosUsdPuros)}</span>
                        <span className="block text-[10px] text-emerald-700/70 mt-1">Recibidos en Efectivo/Zelle</span>
                    </div>
                </div>
            )}

            {modalDetalleFinanciero === 'GASTOS' && (
                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Gastos en Bolívares</span>
                        <span className="font-mono text-xl font-black text-slate-800">Bs. {formatMoney(gastosBsPuros)}</span>
                        {gastosBsPuros >= 0 && (
                            <span className="block text-[10px] font-bold text-rose-600 mt-1">≈ ${formatMoney(gastosBsConvertidosUSD)} USD (Según BCV de cada pago)</span>
                        )}
                    </div>
                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                        <span className="block text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">Gastos Dólares Puros</span>
                        <span className="font-mono text-xl font-black text-rose-600">${formatMoney(gastosUsdPuros)}</span>
                        <span className="block text-[10px] text-rose-700/70 mt-1">Gastados en Efectivo/Zelle</span>
                    </div>
                </div>
            )}

            {modalDetalleFinanciero === 'SALDO' && (
                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Saldo en Bolívares Actual</span>
                        <span className="font-mono text-xl font-black text-slate-800">Bs. {formatMoney(saldoBsPuro)}</span>
                        {saldoBsPuro >= 0 && (
                            <span className="block text-[10px] font-bold text-emerald-600 mt-1">≈ ${formatMoney(saldoBsPuro / tasaHoyGlobal)} USD (Tasa BCV del Día)</span>
                        )}
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                        <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Saldo en Dólares Netos</span>
                        <span className="font-mono text-xl font-black text-emerald-600">${formatMoney(saldoUsdPuro)}</span>
                        <span className="block text-[10px] text-emerald-700/70 mt-1">Efectivo o cuentas extranjeras</span>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center shadow-inner mt-2">
                        <div>
                            <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Suma Consolidada (USD)</span>
                        </div>
                        <span className="font-mono text-2xl font-black text-white">${formatMoney(saldoEnCuentaUSD)}</span>
                    </div>
                </div>
            )}

            {/* 🔥 NUEVO MODAL DE DETALLE DEL DIFERENCIAL CAMBIARIO */}
            {modalDetalleFinanciero === 'DIFERENCIAL' && (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div className={`p-4 rounded-xl border ${balanceDiferencialCambiario < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                        <span className="block text-[10px] font-bold uppercase tracking-wider mb-1">Total Acumulado</span>
                        <span className={`font-mono text-xl font-black ${balanceDiferencialCambiario < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {balanceDiferencialCambiario < 0 ? '-' : '+'}${formatMoney(Math.abs(balanceDiferencialCambiario))}
                        </span>
                    </div>
                    
                    <h4 className="text-xs font-bold text-slate-500 uppercase mt-4 mb-2">Historial por Transacción (Solo Bolívares)</h4>
                    
                    {transacciones.filter(tx => tx.moneda_usada === 'BS').map(tx => {
                        const dolaresOficial = parseFloat(tx.monto_moneda_original) / parseFloat(tx.tasa_oficial_dia);
                        const dolaresRecepcion = parseFloat(tx.monto_moneda_original) / parseFloat(tx.tasa_bcv_momento); 
                        let diferencia = 0;
                        if (tx.tipo === 'INGRESO') {
                            diferencia = dolaresOficial - dolaresRecepcion;
                        } else {
                            diferencia = dolaresRecepcion - dolaresOficial;
                        }
                        
                        if (Math.abs(diferencia) < 0.01) return null; 
                        
                        return (
                            <div key={tx.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between items-center mb-2">
                                <div>
                                    <span className="font-bold text-slate-800 block">{tx.concepto}</span>
                                    <span className="text-[10px] text-slate-500">{new Date(tx.fecha).toLocaleDateString()} | Tasa BCV: {formatMoney(tx.tasa_oficial_dia)} | Tasa Usada: {formatMoney(tx.tasa_bcv_momento)}</span>
                                </div>
                                <span className={`font-mono font-black ${diferencia < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {diferencia < 0 ? '' : '+'}{formatMoney(diferencia)}
                                </span>
                            </div>
                        );
                    })}
                    {transacciones.filter(tx => tx.moneda_usada === 'BS').length === 0 && (
                        <p className="text-xs text-slate-400 text-center italic">No hay transacciones en bolívares registradas.</p>
                    )}
                </div>
            )}
            
            <button onClick={() => setModalDetalleFinanciero(null)} className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl cursor-pointer">Cerrar</button>
          </div>
        </div>
      )}

      {/* 💳 MODAL PARA REGISTRAR PAGO DE COMISIÓN */}
      {modalComisionAbierto && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border">
            <h3 className="text-lg font-black text-orange-800 mb-4">💳 Registrar Pago de Comisión</h3>
            <form onSubmit={registrarPagoComision} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda del Abono</label>
                <select value={monedaPago} onChange={(e) => setMonedaPago(e.target.value)} className="w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold">
                  <option value="BS">Bolívares (Bs)</option>
                  <option value="USD">Dólares ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto Abonado *</label>
                <input 
                  type="text" 
                  value={montoPagoDisplay} 
                  onChange={(e) => handleMoneyInput(e, setMontoPagoRaw, setMontoPagoDisplay)} 
                  placeholder="0,00" 
                  className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-mono text-sm" 
                  required 
                />
              </div>
              {monedaPago === 'BS' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-100 rounded-2xl border">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tasa Oficial Intacta</label>
                    <input type="number" value={tasaHoyGlobal} disabled className="w-full bg-slate-200 border-none rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-600 opacity-80 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-amber-700 uppercase mb-1">Tasa de Recepción *</label>
                    <input type="number" step="0.0001" value={tasaPagoComision} onChange={(e) => setTasaPagoComision(e.target.value)} placeholder="Ej: 76.21" className="w-full bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono font-black text-amber-900" required />
                  </div>
                </div>
              )}
              <div className="pt-4 flex gap-2">
                <button type="button" onClick={() => setModalComisionAbierto(false)} className="flex-1 bg-slate-200 py-3 rounded-xl font-bold cursor-pointer">Cancelar</button>
                <button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-xl cursor-pointer">Guardar Abono</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}