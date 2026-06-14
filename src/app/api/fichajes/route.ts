/**
 * API /api/fichajes — Fichaje electrónico (normativa España RD-ley 8/2019)
 * =========================================================================
 * POST  - Registrar entrada o salida
 * GET   - Historial personal del usuario logueado (?desde=&hasta=&mes=)
 *          Supervisor/Jefe/Dev/BO/IT pueden ver equipo con ?usuario_id=
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-roles';
import pool from '@/lib/db';

const ROLES_VER_EQUIPO = ['supervisor', 'jefe_area', 'desarrollador', 'it', 'back_office'];

// POST — Registrar entrada o salida
export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = parseInt((session.user as any).id);
    const userRole = (session.user as any).role;
    const userActivo = (session.user as any).activo;

    // Doble check: usuario activo (por si JWT no expiró tras desactivación)
    if (userActivo === false) {
      return NextResponse.json({ error: 'Usuario desactivado. Contacta a tu supervisor.' }, { status: 403 });
    }

    const body = await req.json();
    const { tipo, timestamp, target_user_id, motivo, modalidad } = body;

    // Determinar usuario objetivo (supervisor puede fichar por otro)
    let targetId = userId;
    if (target_user_id && ROLES_VER_EQUIPO.includes(userRole)) {
      targetId = parseInt(target_user_id);
    }

    if (!tipo || !['entrada', 'salida'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido. Usar: entrada, salida' }, { status: 400 });
    }

    // Validar modalidad (Ley 10/2021 España — trabajo a distancia)
    const mod = modalidad && ['presencial', 'remoto'].includes(modalidad) ? modalidad : 'presencial';

    // Para registro manual de supervisor
    if (target_user_id && userId !== targetId) {
      if (!motivo) {
        return NextResponse.json({ error: 'Se requiere motivo para corrección manual' }, { status: 400 });
      }
    }

    const ts = timestamp ? new Date(timestamp) : new Date();

    // Verificar doble clic: rechazar si el último fichaje fue del mismo tipo hace < 30 segundos
    const { rows: ultimo } = await pool.query(
      `SELECT tipo, timestamp FROM fichajes WHERE usuario_id = $1 ORDER BY timestamp DESC LIMIT 1`,
      [targetId]
    );

    if (ultimo.length > 0) {
      const segsDesdeUltimo = (ts.getTime() - new Date(ultimo[0].timestamp).getTime()) / 1000;
      if (ultimo[0].tipo === tipo && segsDesdeUltimo < 30) {
        return NextResponse.json({ error: 'Fichaje duplicado (menos de 30s)' }, { status: 409 });
      }
    }

    const metodo = target_user_id && userId !== targetId ? 'supervisor' : 'manual';
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;

    const { rows: [fichaje] } = await pool.query(
      `INSERT INTO fichajes (usuario_id, tipo, timestamp, metodo, ip, notas, corregido_por, correcion_motivo, modalidad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, usuario_id, tipo, timestamp, metodo, notas, modalidad`,
      [
        targetId, tipo, ts.toISOString(), metodo, ip,
        motivo || null,
        target_user_id && userId !== targetId ? userId : null,
        target_user_id && userId !== targetId ? motivo : null,
        mod
      ]
    );

    return NextResponse.json(fichaje, { status: 201 });
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/fichajes]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// GET — Historial de fichajes
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = parseInt((session.user as any).id);
    const userRole = (session.user as any).role;
    const { searchParams } = new URL(req.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const mes = searchParams.get('mes');
    const usuarioId = searchParams.get('usuario_id');
    const exportar = searchParams.get('exportar');
    const hoy = searchParams.get('hoy');        // ISO start of day (local)
    const hoyFin = searchParams.get('hoy_fin');  // ISO end of day (local)

    // Determinar qué usuarios ver
    let targetIds: number[] = [userId];
    if (ROLES_VER_EQUIPO.includes(userRole) && usuarioId) {
      targetIds = [parseInt(usuarioId)];
    } else if (ROLES_VER_EQUIPO.includes(userRole) && (desde || hasta || mes || exportar || hoy)) {
      // Ver equipo completo: supervisor solo ve su equipo
      if (userRole === 'supervisor') {
        const { rows: equipo } = await pool.query(
          `SELECT id FROM usuarios WHERE activo = true AND (supervisor_id = $1 OR id = $1) ORDER BY nombre`,
          [userId]
        );
        targetIds = equipo.map((u: any) => u.id);
      } else {
        const { rows: equipo } = await pool.query(
          `SELECT id FROM usuarios WHERE activo = true ORDER BY nombre`
        );
        targetIds = equipo.map((u: any) => u.id);
      }
    }

    // Construir query con timestamps en vez de cast ::date (timezone-safe)
    let sql = `SELECT f.id, f.usuario_id, f.tipo, f.timestamp, f.metodo, f.ip, f.notas,
                      f.corregido_por, f.correcion_motivo, f.modalidad,
                      u.nombre as usuario_nombre, u.email as usuario_email
               FROM fichajes f
               JOIN usuarios u ON u.id = f.usuario_id
               WHERE f.usuario_id = ANY($1)`;
    const params: any[] = [targetIds];
    let paramIdx = 2;

    if (desde) {
      sql += ` AND f.timestamp >= $${paramIdx}::timestamptz`;
      params.push(desde);
      paramIdx++;
    }
    if (hasta) {
      sql += ` AND f.timestamp < $${paramIdx}::timestamptz`;
      params.push(hasta);
      paramIdx++;
    }
    if (hoy && hoyFin) {
      // Filtro timezone-safe: usa rangos de timestamp en vez de ::date
      sql += ` AND f.timestamp >= $${paramIdx}::timestamptz AND f.timestamp < $${paramIdx + 1}::timestamptz`;
      params.push(hoy, hoyFin);
      paramIdx += 2;
    }
    if (mes) {
      sql += ` AND to_char(f.timestamp, 'YYYY-MM') = $${paramIdx}`;
      params.push(mes);
      paramIdx++;
    }

    sql += ` ORDER BY f.timestamp DESC LIMIT 500`;

    const { rows } = await pool.query(sql, params);

    // Si es exportación CSV
    if (exportar === 'csv') {
      // Formato inspección de trabajo España (RD-ley 8/2019)
      const csvHeader = 'Fecha;DNI/Email;Nombre;Entrada;Salida;Pausas (min);Horas Trabajadas;Modalidad;Método;Notas\n';
      
      // Agrupar por usuario+día para calcular jornadas completas
      const jornadas = new Map<string, { entradas: string[]; salidas: string[]; nombre: string; email: string; metodo: string; modalidad: string }>();
      
      for (const r of rows) {
        const fecha = new Date(r.timestamp).toISOString().split('T')[0];
        const key = `${r.usuario_id}_${fecha}`;
        if (!jornadas.has(key)) {
          jornadas.set(key, { entradas: [], salidas: [], nombre: r.usuario_nombre, email: r.usuario_email, metodo: r.metodo, modalidad: r.modalidad || 'presencial' });
        }
        const j = jornadas.get(key)!;
        const hora = new Date(r.timestamp).toISOString().split('T')[1].substring(0, 5);
        if (r.tipo === 'entrada') j.entradas.push(hora);
        else j.salidas.push(hora);
        if (r.metodo === 'supervisor') j.metodo = 'supervisor';
      }

      const csvRows = Array.from(jornadas.entries()).map(([key, j]) => {
        const fecha = key.split('_')[1];
        const entrada = j.entradas[0] || '—';
        const salida = j.salidas[j.salidas.length - 1] || '—';
        
        // Calcular horas trabajadas (salida - entrada en horas)
        let horasT = '—';
        if (j.entradas[0] && j.salidas.length > 0) {
          const [h1, m1] = entrada.split(':').map(Number);
          const [h2, m2] = salida.split(':').map(Number);
          const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
          horasT = `${Math.floor(mins / 60)}h ${mins % 60}m`;
        }
        
        return `${fecha};${j.email};${j.nombre};${entrada};${salida};—;${horasT};${j.modalidad};${j.metodo};`;
      }).join('\n');

      return new NextResponse('\uFEFF' + csvHeader + csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=fichajes_${desde || 'export'}_${hasta || ''}.csv`,
        },
      });
    }

    return NextResponse.json(rows);
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/fichajes]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
