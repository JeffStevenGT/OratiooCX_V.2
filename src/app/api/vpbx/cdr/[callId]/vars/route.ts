/**
 * POST /api/vpbx/cdr/[callId]/vars
 * Escribe var1-var5 en el CDR de VPBX para vincular con CRM
 */

import { NextResponse } from 'next/server';
import { updateCallVars } from '@/lib/vpbx';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  try {
    const body = await req.json();
    const result = await updateCallVars(callId, body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[api]', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
