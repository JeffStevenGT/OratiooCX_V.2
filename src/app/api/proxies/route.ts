/**
 * app/api/proxies/route.ts — CRUD de Proxies
 * ==========================================
 * GET  → lista proxies desde proxies.txt
 * POST → agrega uno o varios proxies
 * DELETE → elimina por IP
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-roles';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const PROXIES_PATH = join(process.cwd(), 'proxies.txt');

function readProxies(): string[] {
  if (!existsSync(PROXIES_PATH)) return [];
  const text = readFileSync(PROXIES_PATH, 'utf-8');
  return text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

function writeProxies(lines: string[]) {
  writeFileSync(PROXIES_PATH, lines.join('\n') + '\n', 'utf-8');
}

function parseLine(line: string) {
  const p = line.split(':');
  return {
    ip: p[0] || '',
    port: p[1] || '',
    user: p[2] || '',
    pass: p[3] || '',
    raw: line,
  };
}

// ── GET ──
export async function GET() {
  await requireRole('it', 'desarrollador', 'jefe_area');
  const lines = readProxies();
  return NextResponse.json({
    total: lines.length,
    proxies: lines.map(parseLine),
  });
}

// ── POST (agregar) ──
export async function POST(req: Request) {
  await requireRole('it', 'desarrollador');
  try {
    const body = await req.json();
    const { ip, port, user, pass, line } = body;

    let newLine: string;
    if (line) {
      newLine = line.trim();
    } else if (ip && port) {
      newLine = `${ip}:${port}${user ? ':' + user : ''}${pass ? ':' + pass : ''}`;
    } else {
      return NextResponse.json({ error: 'Falta ip:puerto o línea completa' }, { status: 400 });
    }

    const lines = readProxies();
    // Evitar duplicados por IP
    const newIp = newLine.split(':')[0];
    const existe = lines.some(l => l.split(':')[0] === newIp);
    if (existe) {
      return NextResponse.json({ error: `El proxy ${newIp} ya existe` }, { status: 409 });
    }

    lines.push(newLine);
    writeProxies(lines);

    return NextResponse.json({ success: true, proxy: parseLine(newLine), total: lines.length });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ── DELETE ──
export async function DELETE(req: Request) {
  await requireRole('it', 'desarrollador');
  try {
    const { ip } = await req.json();
    if (!ip) return NextResponse.json({ error: 'Falta IP' }, { status: 400 });

    const lines = readProxies();
    const filtered = lines.filter(l => !l.startsWith(ip + ':'));
    if (filtered.length === lines.length) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    writeProxies(filtered);
    return NextResponse.json({ success: true, total: filtered.length });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
