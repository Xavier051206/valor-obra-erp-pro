import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function DashboardObras({ 
  proyectos, 
  tasaHoy, 
  onSeleccionarObra, 
  onAbrirModal, 
  formatMoney 
}) {
  const [resumenGlobal, setResumenGlobal] = useState({ 
      saldoBs: 0, saldoUsd: 0, diferencialGlobal: 0, totalIngresosUSD: 0, totalEgresosUSD: 0, saldoCuentaUSD: 0,
      totalComisionGlobal: 0, totalComisionPagadaGlobal: 0, comisionPendienteGlobal: 0, historialComisiones: []
  });
  
  const [modalGlobalAbierto, setModalGlobalAbierto] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  
  // 🔥 ESTADO PARA EL NUEVO MODAL DE HISTORIAL DE COMISIONES
  const [modalHistorialComisionesAbierto, setModalHistorialComisionesAbierto] = useState(false);

  const obrasActivas = proyectos.filter(p => p.estado !== 'FINALIZADA');
  const obrasFinalizadas = proyectos.filter(p => p.estado === 'FINALIZADA');
  const obrasAMostrar = mostrarHistorial ? obrasFinalizadas : obrasActivas;

  useEffect(() => {
    axios.get('valor-obra-erp-pro.railway.internal/api/global-resumen')
      .then(res => setResumenGlobal(res.data))
      .catch(err => console.error("Error cargando resumen global", err));
  }, [proyectos]);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">PRO VENEZUELA</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">ValorObra ERP</h1>
            <p className="text-slate-400 text-sm mt-1">Gestión avanzada de presupuestos, hitos y control multimoneda.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <button 
              onClick={onAbrirModal}
              className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-3.5 rounded-2xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2 text-sm"
            >
              <span>➕ Registrar Nueva Obra</span>
            </button>
            <div className="bg-slate-950 border border-slate-800 px-4 py-3 rounded-2xl flex items-center gap-3">
              <span className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold text-slate-300">BCV: <span className="text-white font-mono">{formatMoney(tasaHoy?.tasa_bcv_usd)} Bs/$</span></span>
            </div>
          </div>
        </div>

        {/* 🔥 SALDO GLOBAL Y COMISIONES (MITAD Y MITAD) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* IZQUIERDA: Saldo Global de Cuentas */}
            <div 
              onClick={() => setModalGlobalAbierto(true)} 
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-3xl p-6 md:p-8 border border-slate-800 cursor-pointer transition shadow-xl group flex flex-col justify-between"
            >
                <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 group-hover:text-emerald-400 transition">🌍 Saldo Global Consolidado (USD)</span>
                    <span className="font-mono font-black text-4xl md:text-5xl text-white">${formatMoney(resumenGlobal.saldoCuentaUSD)}</span>
                </div>
                <div className="mt-6 flex justify-between items-center border-t border-slate-700/50 pt-4">
                    <span className="text-xs font-bold text-slate-400">Fondos sumados de la constructora</span>
                    <span className="text-xs font-bold text-slate-300 group-hover:text-emerald-400 transition">Ver Detalles →</span>
                </div>
            </div>

            {/* DERECHA: Comisión General y Pagos */}
            <div 
              onClick={() => setModalHistorialComisionesAbierto(true)} 
              className="bg-orange-50 border border-orange-200 hover:border-orange-400 rounded-3xl p-6 md:p-8 cursor-pointer transition shadow-xl group flex flex-col justify-between"
            >
                <div>
                    <span className="block text-xs font-bold text-orange-800 uppercase tracking-widest mb-4 group-hover:text-orange-600 transition">💼 Comisión General a Entregar</span>
                    
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">Total Acumulado</span>
                            <span className="font-mono text-xl font-black text-slate-800">${formatMoney(resumenGlobal.totalComisionGlobal)}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">Ya Entregado</span>
                            <span className="font-mono text-xl font-black text-emerald-600">-${formatMoney(resumenGlobal.totalComisionPagadaGlobal)}</span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-orange-200 flex justify-between items-center">
                        <span className="text-xs font-black text-orange-800 uppercase">Pendiente</span>
                        <span className="font-mono text-3xl md:text-4xl font-black text-orange-600">${formatMoney(resumenGlobal.comisionPendienteGlobal)}</span>
                    </div>
                </div>
                
                <span className="block mt-6 text-center bg-orange-100 text-orange-800 font-bold py-2.5 rounded-xl text-xs group-hover:bg-orange-500 group-hover:text-white transition">
                    Ver Historial de Pagos →
                </span>
            </div>
        </div>

        {/* LISTA DE OBRAS CON FILTRO DE HISTORIAL */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              {mostrarHistorial ? '🗄️ Historial de Obras Finalizadas' : '📂 Obras Activas en Ejecución'}
              <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-bold">
                {obrasAMostrar.length}
              </span>
            </h2>
            
            <button 
              onClick={() => setMostrarHistorial(!mostrarHistorial)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
            >
              {mostrarHistorial ? '← Volver a Obras Activas' : 'Ver Historial Finalizadas 🗄️'}
            </button>
          </div>

          {obrasAMostrar.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-16 text-center text-slate-400 shadow-sm">
              <div className="text-5xl mb-3">{mostrarHistorial ? '🗄️' : '🏗️'}</div>
              <p className="font-bold text-slate-700 text-lg">
                  {mostrarHistorial ? 'No tienes obras finalizadas en el historial.' : 'No hay obras activas registradas todavía.'}
              </p>
              {!mostrarHistorial && (
                  <button 
                    onClick={onAbrirModal}
                    className="mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-2xl shadow transition cursor-pointer"
                  >
                    Registrar Primera Obra 🚀
                  </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {obrasAMostrar.map((obra) => {
                const porcentaje = obra.total_hitos > 0 
                    ? Math.round((obra.hitos_completados / obra.total_hitos) * 100) 
                    : 0;

                return (
                  <div 
                    key={obra.id}
                    onClick={() => onSeleccionarObra(obra)}
                    className="bg-white border border-slate-200/80 hover:border-emerald-500/80 rounded-3xl p-6 transition shadow-sm hover:shadow-xl cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-0 group-hover:opacity-100 transition"></div>
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${obra.estado === 'FINALIZADA' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {obra.estado}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">ID #{obra.id}</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-600 transition">{obra.nombre}</h3>
                      <p className="text-sm text-slate-600 mt-1">👤 {obra.cliente}</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">📍 {obra.ubicacion || 'Sin ubicación registrada'}</p>
                      
                      <div className="mt-4 mb-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                              <span>Progreso Global</span>
                              <span className="text-emerald-600">{porcentaje}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${porcentaje}%` }}></div>
                          </div>
                      </div>

                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-700 group-hover:text-emerald-600 transition">
                      <span>Administrar Obra →</span>
                      <span className="text-slate-400 font-mono">Inicio: {new Date(obra.fecha_inicio).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 💳 MODAL INTERACTIVO DE SALDO GLOBAL */}
      {modalGlobalAbierto && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-slate-200">
                <div className="flex justify-between items-start mb-6 border-b pb-4">
                    <h3 className="text-xl font-black text-slate-900">🌍 Detalle Consolidado</h3>
                    <button onClick={() => setModalGlobalAbierto(false)} className="text-slate-400 hover:text-rose-500 font-black cursor-pointer">✕</button>
                </div>
                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Saldo Total en Bolívares</span>
                        <span className="font-mono text-2xl font-black text-slate-800">Bs. {formatMoney(resumenGlobal.saldoBs)}</span>
                        {resumenGlobal.saldoBs >= 0 && (
                            <span className="block text-xs font-bold text-emerald-600 mt-1">≈ ${formatMoney(resumenGlobal.saldoBs / (tasaHoy?.tasa_bcv_usd || 1))} USD (Tasa BCV del día)</span>
                        )}
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                        <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Saldo Total en Dólares Netos</span>
                        <span className="font-mono text-2xl font-black text-emerald-600">${formatMoney(resumenGlobal.saldoUsd)}</span>
                        <span className="block text-[10px] text-emerald-700/70 mt-1 font-bold">Efectivo o cuentas extranjeras</span>
                    </div>
                </div>
                <button onClick={() => setModalGlobalAbierto(false)} className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl cursor-pointer">Cerrar Detalle</button>
            </div>
        </div>
      )}

      {/* 💼 MODAL HISTORIAL DE COMISIONES */}
      {modalHistorialComisionesAbierto && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-3xl p-8 max-w-4xl w-full shadow-2xl border border-slate-200 my-8 max-h-[90vh] flex flex-col">
                  <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                      <h3 className="text-xl font-black text-orange-800">💼 Historial General de Comisiones Pagadas</h3>
                      <button onClick={() => setModalHistorialComisionesAbierto(false)} className="text-slate-400 hover:text-rose-500 font-black cursor-pointer text-xl">✕</button>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 pr-2">
                      {resumenGlobal.historialComisiones && resumenGlobal.historialComisiones.length > 0 ? (
                          <div className="space-y-3">
                              {resumenGlobal.historialComisiones.map((pago, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                      <div>
                                          <span className="bg-orange-100 text-orange-800 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider mb-2 inline-block">Obra: {pago.proyecto_nombre}</span>
                                          <p className="text-sm font-bold text-slate-800">Fecha: {new Date(pago.fecha).toLocaleDateString()}</p>
                                          <p className="text-xs text-slate-500 mt-1">
                                              Moneda: <span className="font-bold">{pago.moneda_usada}</span> | Tasa: <span className="font-mono">{formatMoney(pago.tasa_cambio)}</span>
                                          </p>
                                      </div>
                                      <div className="text-right w-full sm:w-auto bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Monto Original Pagado</span>
                                          <span className="font-mono font-bold text-slate-600 mb-1 block">{pago.moneda_usada === 'BS' ? 'Bs.' : '$'} {formatMoney(pago.monto_original)}</span>
                                          <span className="block text-[10px] font-black text-emerald-600 uppercase border-t pt-1">Abono Neto Restado (USD)</span>
                                          <span className="font-mono text-xl font-black text-emerald-600">${formatMoney(pago.monto_abonado_usd)}</span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
                              <p className="font-bold text-slate-500">Aún no hay pagos de comisiones registrados.</p>
                          </div>
                      )}
                  </div>
                  <div className="shrink-0 pt-6 mt-2 border-t">
                      <button onClick={() => setModalHistorialComisionesAbierto(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl cursor-pointer transition">Cerrar Historial</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}