'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, User, Star, Gift, AlertTriangle, ChevronLeft, ChevronRight, Smartphone, PhoneCall, PhoneOff, Plus, CheckCircle2, XCircle, MessageCircle, Pause, Play, Coffee, Utensils, Timer, Users2, BookOpen, HelpCircle } from 'lucide-react';
import Skeleton, { PageSkeleton } from '@/components/shared/Skeleton';
import FlipCard from '@/components/shared/FlipCard';
import { toast } from '@/components/shared/Toast';
import { CIMA_COLORS, RENOVE_COLORS } from '@/lib/pipeline-colors';
import WhatsAppChat from '@/components/shared/WhatsAppChat';
import { useProject } from '@/lib/project-context';

type L = { numero: string; es_cima: boolean; tiene_renove: boolean; variante_renove: string; etiquetas: string[]; es_principal: boolean; esExtra?: boolean; producto?: string; estado_detallado?: {texto:string;color:string;activo:boolean}[]; permanencia?: string; consumo?: string; venta_plazos?: string; campanas_extra?: {tipo:string;texto:string}[] };
type Lead = { id_cliente: string; dni: string; nombre: string; paquete: string; cima: string; tiene_renove: string; renove_variante: string; lineas_count: number; pipeline_id: number; lineas: L[]; intentos: number; raw_datos?: any };

const PAUSA_LABELS: Record<string,string> = { bano:'Baño', almuerzo:'Almuerzo', descanso:'Descanso', reunion:'Reunión', capacitacion:'Capacitación', otro:'Otro' };
const PAUSA_ICONS: Record<string,any> = { bano:Coffee, almuerzo:Utensils, descanso:Timer, reunion:Users2, capacitacion:BookOpen, otro:HelpCircle };
const PAUSA_LIMITS: Record<string,number> = { bano:900, almuerzo:3600, descanso:1800, reunion:3600, capacitacion:7200, otro:99999 };

export default function PowerDialerPage() {
  const { proyecto } = useProject();
  const camposLead = (proyecto as any)?.config?.campos_lead || [];
  const [leads, setLeads] = useState<Lead[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enLlamada, setEnLlamada] = useState(false);
  const [calling, setCalling] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [intentos, setIntentos] = useState<Record<string, number>>({});
  const [showResultado, setShowResultado] = useState(false);
  const [showTipificar, setShowTipificar] = useState(false);
  const [ultimoNumero, setUltimoNumero] = useState('');
  const [nota, setNota] = useState('');
  const [showAgregarNumero, setShowAgregarNumero] = useState(false);
  const [nuevoNumero, setNuevoNumero] = useState('');
  const [numerosExtra, setNumerosExtra] = useState<Record<string, string[]>>({});
  const [subEstado, setSubEstado] = useState('');
  const [finPermanencia, setFinPermanencia] = useState('');
  const [callbackFecha, setCallbackFecha] = useState('');
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [lineasExpandidas, setLineasExpandidas] = useState<Set<string>>(new Set());
  const [subEstadosConfig, setSubEstadosConfig] = useState<any[]>([]);
  const [estadosConfig, setEstadosConfig] = useState<any[]>([]);
  const lastCallRef = useRef(0);
  const [enPausa, setEnPausa] = useState(false);
  const [mostrarTiposPausa, setMostrarTiposPausa] = useState(false);
  const [tipoPausa, setTipoPausa] = useState('');
  const [pausaTimer, setPausaTimer] = useState(0);
  const [pausaActionLoading, setPausaActionLoading] = useState(false);
  const pausaIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lead = leads[current] || null;

  useEffect(() => { fetch('/api/pipeline/mine').then(r=>r.json()).then(d=>{ setLeads(Array.isArray(d)?d:[]); setLoading(false); }); }, []);
  useEffect(() => { fetch('/api/tipificaciones-config').then(r=>r.json()).then(c=>{ setEstadosConfig((Array.isArray(c)?c:[]).filter((x:any)=>x.tipo==='estado'&&x.visible_en_power_dialer!==false)); setSubEstadosConfig((Array.isArray(c)?c:[]).filter((x:any)=>x.tipo==='sub_estado')); }); }, []);

  useEffect(() => { if (enPausa) { pausaIntervalRef.current = setInterval(() => setPausaTimer(t=>t+1), 1000); } else { if (pausaIntervalRef.current) clearInterval(pausaIntervalRef.current); } return () => { if (pausaIntervalRef.current) clearInterval(pausaIntervalRef.current); }; }, [enPausa]);

  const formatPausaTimer = (s: number) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return h>0?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
  const iniciarPausa = async (tipo: string) => { setPausaActionLoading(true); try { await fetch('/api/pausas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo})}); setTipoPausa(tipo); setEnPausa(true); setMostrarTiposPausa(false); setPausaTimer(0); } catch { toast.error('Error al iniciar pausa'); } setPausaActionLoading(false); };
  const finalizarPausa = async () => { setPausaActionLoading(true); try { await fetch('/api/pausas',{method:'PUT',headers:{'Content-Type':'application/json'}}); setEnPausa(false); setTipoPausa(''); toast.success('Pausa finalizada'); } catch { toast.error('Error al finalizar pausa'); } setPausaActionLoading(false); };

  const fieldLabel = (f: string) => f.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
  const renderCampoLead = (field: string, lead: Lead) => { const datos = lead.raw_datos || {}; const val = datos[field]; const display = val !== undefined && val !== null && val !== '' ? (typeof val === 'object' ? JSON.stringify(val).slice(0, 60) : String(val)) : null; if (!display) return (<div key={field} className="rounded-xl p-3 text-center bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700"><HelpCircle size={16} className="mx-auto mb-1 text-gray-300 dark:text-gray-600" /><p className="text-[10px] text-gray-400">{fieldLabel(field)}</p></div>); return (<div key={field} className="rounded-xl p-3 text-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"><HelpCircle size={16} className="mx-auto mb-1 text-gray-400" /><p className="text-[10px] font-medium text-gray-600 dark:text-gray-300">{fieldLabel(field)}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{display}</p></div>); };

  const call = useCallback(async (numero: string) => { if (!lead || enLlamada) return; if (Date.now() - lastCallRef.current < 5000) { setMsg('Esperá 5s'); setTimeout(() => setMsg(''), 2000); return; } lastCallRef.current = Date.now(); setEnLlamada(true); setCalling(numero); setUltimoNumero(numero); setIntentos(p => ({ ...p, [lead.id_cliente]: (p[lead.id_cliente] || 0) + 1 })); try { await fetch('/api/vpbx/originate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numero }) }); } catch { toast.error('Error al iniciar llamada'); } setEnLlamada(false); setCalling(null); setShowResultado(true); }, [lead, enLlamada]);

  const guardarResultado = async (r: string) => { if (!lead) return; try { await fetch('/api/pipeline/intento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_cliente: lead.id_cliente, pipeline_id: lead.pipeline_id, numero: ultimoNumero, resultado: r, notas: nota }) }); if (r === 'contactado') { setShowTipificar(true); return; } toast.success(`Resultado: ${r}`); } catch { toast.error('Error al guardar'); } setShowResultado(false); setNota(''); };

  const marcarNoContesta = async () => { if (!lead) return; try { await fetch('/api/pipeline', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.pipeline_id, estado: 'no_contesta' }) }); toast.info('Lead: No Contesta'); } catch { toast.error('Error'); } if (current < leads.length - 1) setCurrent(current + 1); setShowResultado(false); };

  const tipificar = async (estado: string) => { if (!lead) return; const body: any = { id: lead.pipeline_id, estado, notas: nota }; if (subEstado) body.sub_estado = subEstado; if (callbackFecha) body.callback_at = callbackFecha; if (finPermanencia) body.fin_permanencia = finPermanencia; try { await fetch('/api/pipeline/tipificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); toast.success(`Tipificado: ${estado}`); } catch { toast.error('Error al tipificar'); } setShowTipificar(false); setNota(''); setShowResultado(false); setSubEstado(''); setFinPermanencia(''); setCallbackFecha(''); if (current < leads.length - 1) setCurrent(current + 1); };

  const agregarNumero = async () => { if (!nuevoNumero || !lead) return; await fetch('/api/pipeline/intento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_cliente: lead.id_cliente, pipeline_id: lead.pipeline_id, numero: nuevoNumero, resultado: 'numero_agregado' }) }); setNumerosExtra(p => ({ ...p, [lead.id_cliente]: [...(p[lead.id_cliente] || []), nuevoNumero] })); setNuevoNumero(''); setShowAgregarNumero(false); };

  const extras = lead ? (numerosExtra[lead.id_cliente] || []) : [];
  const tieneDatosExtra = (l: L) => l.producto || (l.estado_detallado && l.estado_detallado.length > 0) || (l.permanencia && l.permanencia !== 'N/A') || (l.consumo && l.consumo !== 'N/A') || (l.venta_plazos && l.venta_plazos !== 'N/A') || (l.campanas_extra && l.campanas_extra.length > 0);
  const todas = lead ? [...lead.lineas.map(l => ({ ...l, esExtra: false })), ...extras.map(n => ({ numero: n, es_cima: false, tiene_renove: false, variante_renove: 'N/A', etiquetas: ['Agregado'], es_principal: false, esExtra: true } as L))].sort((a, b) => { const pA = a.esExtra ? 3 : a.es_principal ? 1 : 2; const pB = b.esExtra ? 3 : b.es_principal ? 1 : 2; return pA - pB; }) : [];
  const intentosLead = intentos[lead?.id_cliente] || 0;

  if (loading) return <PageSkeleton />;
  if (!leads.length) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6"><Phone size={36} className="text-gray-400" /></div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Power Dialer</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No tenés leads asignados</p>
      <p className="text-xs text-gray-400 mb-6">Solicitá leads a tu supervisor para empezar a llamar</p>
      <a href="/asesor" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0a6ea9] hover:bg-[#085d8f] text-white text-sm font-medium rounded-xl transition-colors"><Phone size={16} /> Ir al Dashboard</a>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Power Dialer</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{current + 1} de {leads.length} leads</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMostrarTiposPausa(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              enPausa ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20'
            }`}><Pause size={14} />{enPausa ? 'Pausado' : 'Pausa'}</button>
          <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"><ChevronLeft size={16} className="text-gray-600 dark:text-gray-400" /></button>
          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px] text-center tabular-nums">{current + 1}/{leads.length}</span>
          <button onClick={() => setCurrent(Math.min(leads.length - 1, current + 1))} disabled={current === leads.length - 1}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"><ChevronRight size={16} className="text-gray-600 dark:text-gray-400" /></button>
        </div>
      </div>

      {/* Pausa: seleccionar tipo */}
      {mostrarTiposPausa && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-scale-in">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Iniciar Pausa</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">El Power Dialer se bloqueará hasta que vuelvas.</p>
            <div className="space-y-1.5">
              {Object.entries(PAUSA_LABELS).map(([tipo, label]) => { const Icon = PAUSA_ICONS[tipo]; return (
                <button key={tipo} onClick={() => iniciarPausa(tipo)} disabled={pausaActionLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-left">
                  <Icon size={18} className="text-gray-400" /><span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                </button>);})}
            </div>
            <button onClick={() => setMostrarTiposPausa(false)} className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-2">Cancelar</button>
          </div>
        </div>
      )}

      {/* Pausa activa: pantalla completa */}
      {enPausa && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#481163] to-[#2d0a40] flex items-center justify-center">
          <div className="text-center animate-scale-in">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
              {(() => { const Icon = PAUSA_ICONS[tipoPausa] || HelpCircle; return <Icon size={44} className="text-white/80" />; })()}
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">{PAUSA_LABELS[tipoPausa] || tipoPausa}</h2>
            <p className="text-white/50 text-sm mb-8">Power Dialer pausado</p>
            {(() => { const c = pausaTimer < 300 ? 'text-white' : pausaTimer < 900 ? 'text-amber-300' : pausaTimer < 1800 ? 'text-orange-400' : 'text-red-400';
              return <div className={`text-7xl font-mono font-bold mb-8 tracking-wider transition-colors duration-500 ${c}`}>{formatPausaTimer(pausaTimer)}</div>; })()}
            <button onClick={finalizarPausa} disabled={pausaActionLoading}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#481163] rounded-2xl text-lg font-bold hover:bg-white/90 transition-colors disabled:opacity-50 shadow-xl"><Play size={20} /> Volver a trabajar</button>
            <p className="text-white/20 text-xs mt-6">Volverás al mismo lead</p>
          </div>
        </div>
      )}

      {lead && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Banner llamada activa */}
          {enLlamada && (
            <div className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center gap-2 animate-pulse">
              <PhoneCall size={14} className="text-red-500" />
              <span className="text-xs text-red-700 dark:text-red-400 font-medium">En llamada — no cierres la ventana</span>
            </div>
          )}

          <div className="p-6">

          {/* Tipificación */}
          {showTipificar && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Tipificar — {lead.nombre || lead.dni}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {estadosConfig.map((e: any) => (
                  <button key={e.codigo} onClick={() => { if (e.codigo === 'no_interesa' || e.codigo === 'no_contesta') setSubEstado(e.codigo === 'no_interesa' ? 'proceso_portabilidad' : 'volver_a_llamar'); tipificar(e.codigo); }}
                    style={{backgroundColor: e.color}} className="text-white rounded-lg py-2 text-[10px] font-medium hover:opacity-90 transition-opacity">{e.etiqueta}</button>
                ))}
              </div>
              <div className="border-t border-blue-200 dark:border-blue-800 pt-2">
                <p className="text-[10px] font-medium text-gray-500 mb-1.5">Sub-estado (opcional)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {subEstadosConfig.map((se: any) => (
                    <button key={se.codigo} onClick={() => setSubEstado(subEstado === se.codigo ? '' : se.codigo)}
                      className="text-[10px] rounded-lg py-1.5 px-2 border transition-colors"
                      style={{ backgroundColor: subEstado === se.codigo ? `${se.color}20` : 'transparent', borderColor: subEstado === se.codigo ? se.color : '#d1d5db', color: subEstado === se.codigo ? se.color : '#6b7280' }}>{se.etiqueta}</button>
                  ))}
                </div>
              </div>
              <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Notas..." className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white" rows={2} />
              <button onClick={() => tipificar('contactado')} className="w-full text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1">Solo guardar sin cambiar estado</button>
            </div>
          )}

          {/* Resultado de llamada */}
          {showResultado && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-gray-900 dark:text-white">¿Resultado de {ultimoNumero}?</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[{k:'contactado',l:'Contactado',i:CheckCircle2,c:'bg-emerald-500'},{k:'no_contesta',l:'No Contesta',i:XCircle,c:'bg-red-500'},{k:'buzon',l:'Buzón',i:PhoneOff,c:'bg-gray-500'},{k:'equivocado',l:'Equivocado',i:AlertTriangle,c:'bg-amber-500'}].map(r => { const I = r.i; return (
                  <button key={r.k} onClick={() => guardarResultado(r.k)} className={`${r.c} text-white rounded-xl py-3 text-[10px] font-medium flex flex-col items-center gap-1 hover:opacity-90 transition-opacity`}><I size={16} />{r.l}</button>
                );})}
              </div>
              <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota..." className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white" rows={1} />
              <button onClick={marcarNoContesta} className="w-full text-[10px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg py-1.5 border border-red-200 dark:border-red-800">Marcar No Contesta y siguiente</button>
            </div>
          )}

          {/* Lead info */}
          <div className="text-center mb-5">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
              <User size={28} className="text-[#0a6ea9]" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{lead.nombre || '—'}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{lead.dni}</p>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              {intentosLead > 0 && <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">Ronda {intentosLead}/5</span>}
              <button onClick={() => setShowWhatsApp(!showWhatsApp)}
                className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full px-3 py-1 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                <MessageCircle size={12} /> WhatsApp
              </button>
            </div>
          </div>

          {/* CIMA + Renove */}
          {camposLead.length === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <FlipCard back="Cliente CIMA. Prioridad de contacto">
                  <div className={`rounded-xl p-3 text-center ${lead.cima==='SI'?'bg-emerald-50 dark:bg-emerald-900/20':'bg-gray-50 dark:bg-gray-800'}`}>
                    <Star size={18} className={`mx-auto mb-1 ${lead.cima==='SI'?'text-emerald-500':'text-gray-400'}`} />
                    <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{lead.cima==='SI'?'CIMA':'Sin CIMA'}</p>
                  </div>
                </FlipCard>
                <FlipCard back="Oferta de renovación disponible">
                  <div className={`rounded-xl p-3 text-center ${lead.tiene_renove==='SI'?'bg-blue-50 dark:bg-blue-900/20':'bg-gray-50 dark:bg-gray-800'}`}>
                    <Gift size={18} className={`mx-auto mb-1 ${lead.tiene_renove==='SI'?'text-blue-500':'text-gray-400'}`} />
                    <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{lead.tiene_renove==='SI'?'Renove':'Sin Renove'}</p>
                  </div>
                </FlipCard>
              </div>
              <div className="text-center mb-4 bg-gray-50 dark:bg-gray-800 rounded-xl py-2 px-4">
                <span className="text-[10px] text-gray-400">Paquete: </span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{lead.paquete}</span>
              </div>
            </>
          )}

          {camposLead.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {camposLead.slice(0,8).map((f:string) => renderCampoLead(f, lead))}
            </div>
          )}

          {/* Alerta ronda avanzada */}
          {intentosLead >= 3 && (
            <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
              <span className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle size={12} /> Ronda {intentosLead}/5</span>
              <button onClick={marcarNoContesta} className="text-[10px] bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-800 dark:text-amber-200 rounded-lg px-2.5 py-1 font-medium transition-colors">No Contesta</button>
            </div>
          )}

          {/* Líneas */}
          <div className="space-y-2 mb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Líneas ({todas.length})</p>
            {todas.map((l, i) => (
              <div key={i} className={`rounded-xl border overflow-hidden transition-colors ${
                l.es_principal&&!l.esExtra ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10' :
                l.esExtra ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10' :
                'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Smartphone size={14} className={l.es_principal ? 'text-blue-500' : l.esExtra ? 'text-purple-500' : 'text-gray-400'} />
                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-white truncate">{l.numero}</span>
                    <div className="flex gap-1 flex-wrap">
                      {l.etiquetas?.map((t,j)=><span key={j} className="text-[8px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 whitespace-nowrap">{t}</span>)}
                      {l.es_cima && <span className="text-emerald-500"><Star size={10} /></span>}
                      {l.tiene_renove && <span className="text-blue-500"><Gift size={10} /></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {tieneDatosExtra(l) && (
                      <button onClick={() => { const n = new Set(lineasExpandidas); n.has(l.numero) ? n.delete(l.numero) : n.add(l.numero); setLineasExpandidas(n); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Ver detalles">
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={16}/><line x1={8} y1={12} x2={16} y2={12}/></svg>
                      </button>
                    )}
                    <button onClick={async()=>{await fetch('/api/pipeline/intento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_cliente:lead.id_cliente,pipeline_id:lead.pipeline_id,numero:l.numero,resultado:'contacto_confirmado'})});setMsg('★ Marcado');setTimeout(()=>setMsg(''),2000);}}
                      className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/20 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="Marcar contacto principal"><Star size={12}/></button>
                    <button onClick={()=>call(l.numero)} disabled={enLlamada}
                      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                        enLlamada ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed' :
                        'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                      }`}>{enLlamada ? <><PhoneOff size={12}/>Llamando</> : <><PhoneCall size={12}/>Llamar</>}</button>
                  </div>
                </div>
                {lineasExpandidas.has(l.numero) && (
                  <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-[10px] space-y-1.5">
                    {l.producto && l.producto !== 'N/A' && <p className="font-medium text-gray-600 dark:text-gray-300">Producto: {l.producto}</p>}
                    {l.estado_detallado && l.estado_detallado.length > 0 && (
                      <div className="flex flex-wrap gap-1">{l.estado_detallado.map((e,j)=>(
                        <span key={j} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${e.activo?'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400':'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>{e.texto}</span>
                      ))}</div>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-gray-500 dark:text-gray-400">
                      {l.permanencia && l.permanencia !== 'N/A' && <span>Permanencia: {l.permanencia}</span>}
                      {l.consumo && l.consumo !== 'N/A' && <span>Consumo: {l.consumo}</span>}
                      {l.venta_plazos && l.venta_plazos !== 'N/A' && <span>VAP: {l.venta_plazos}</span>}
                    </div>
                    {l.campanas_extra && l.campanas_extra.length > 0 && (
                      <div className="flex flex-wrap gap-1">{l.campanas_extra.map((c,j)=>(
                        <span key={j} className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[9px] border border-indigo-100 dark:border-indigo-800">{c.tipo}: {c.texto.length>40?c.texto.slice(0,40)+'...':c.texto}</span>
                      ))}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {showAgregarNumero ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20">
                <input value={nuevoNumero} onChange={e=>setNuevoNumero(e.target.value)} placeholder="Nuevo número..." className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white" autoFocus />
                <button onClick={agregarNumero} disabled={!nuevoNumero} className="bg-purple-500 hover:bg-purple-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40">Agregar</button>
                <button onClick={()=>setShowAgregarNumero(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Cancelar</button>
              </div>
            ) : (
              <button onClick={()=>setShowAgregarNumero(true)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-purple-400 dark:hover:border-purple-500 transition-colors"><Plus size={12}/>Agregar número</button>
            )}
          </div>

          {msg && <p className="text-xs text-center mb-2 text-gray-500 dark:text-gray-400">{msg}</p>}

          <div className="flex justify-between text-xs text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button onClick={()=>setCurrent(0)} className="hover:text-[#0a6ea9] dark:hover:text-blue-400 transition-colors">← Primero</button>
            <span className="font-mono text-gray-500 dark:text-gray-400">{lead.dni}</span>
            <button onClick={()=>setCurrent(leads.length-1)} className="hover:text-[#0a6ea9] dark:hover:text-blue-400 transition-colors">Último →</button>
          </div>
          </div>
        </div>
      )}

      {showWhatsApp && lead && <WhatsAppChat id_cliente={lead.id_cliente} dni={lead.dni} nombre={lead.nombre} onClose={() => setShowWhatsApp(false)} />}
    </div>
  );
}
