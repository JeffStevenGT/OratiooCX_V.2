/**
 * GET /api/vpbx/agents — Estado real de agentes VPBX
 * Proxy a VPBX GET /agent con cache Redis (5s TTL)
 */

import { NextResponse } from 'next/server';
import { listAgents } from '@/lib/vpbx';
import { cacheGet } from '@/lib/redis';

export async function GET() {
  try {
    // Cache 5 segundos — balance entre frescura y reducir llamadas a VPBX
    const agents = await cacheGet('vpbx:agents', () => listAgents(), 5);
    return NextResponse.json(agents);
  } catch (error: any) {
    console.error('[api]', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
