/**
 * app/api/perfil/password/route.ts
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { current, new: newPass } = await req.json();
  if (!current || !newPass) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

  // Validar complejidad
  if (newPass.length < 8) return NextResponse.json({ error: 'Minimo 8 caracteres' }, { status: 400 });
  if (!/[A-Z]/.test(newPass)) return NextResponse.json({ error: 'Debe contener al menos una mayuscula' }, { status: 400 });
  if (!/[0-9]/.test(newPass)) return NextResponse.json({ error: 'Debe contener al menos un numero' }, { status: 400 });

  const email = session.user.email;
  const { rows: [u] } = await pool.query('SELECT password_hash FROM usuarios WHERE email = $1', [email]);
  if (!u) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const valid = await bcrypt.compare(current, u.password_hash);
  if (!valid) return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 403 });

  const hash = await bcrypt.hash(newPass, 10);
  await pool.query('UPDATE usuarios SET password_hash = $1 WHERE email = $2', [hash, email]);

  return NextResponse.json({ success: true });
}
