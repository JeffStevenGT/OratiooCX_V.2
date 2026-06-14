/**
 * lib/auth.ts — Configuración de NextAuth.js
 * =============================================
 * Autenticación con credenciales (email + password) contra PostgreSQL.
 * JWT firmado con refresh en producción.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Oratioo CX',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limiting: máximo 5 intentos por IP en 15 minutos
        const { default: pool } = await import('./db');
        const ip = (req as any)?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
        const bcrypt = (await import('bcryptjs')).default;

        // Rate limiting en memoria: máx 5 intentos fallidos por IP en 15 min
        const now = Date.now();
        const windowMs = 15 * 60 * 1000;
        if (!(globalThis as any)._loginAttempts) (globalThis as any)._loginAttempts = new Map();
        const attempts = (globalThis as any)._loginAttempts.get(ip) || [];
        const recent = attempts.filter((t: number) => now - t < windowMs);
        if (recent.length >= 5) {
          console.warn(`[auth] Rate limit IP ${ip}: ${recent.length} intentos`);
          return null;
        }

        const { rows } = await pool.query(
          `SELECT id, email, nombre, password_hash, rol, equipo, activo
           FROM usuarios WHERE email = $1 AND activo = true`,
          [credentials.email as string]
        );

        if (rows.length === 0) return null;

        const user = rows[0];

        // Verificar contraseña
        const passwordMatch = await bcrypt.compare(credentials.password as string, user.password_hash);

        if (!passwordMatch) {
          recent.push(now);
          (globalThis as any)._loginAttempts.set(ip, recent);
          return null;
        }

        // Login exitoso — limpiar contador
        (globalThis as any)._loginAttempts.delete(ip);

        // Actualizar última conexión
        await pool.query(
          'UPDATE usuarios SET ultima_conexion = now() WHERE id = $1',
          [user.id]
        );

        return {
          id: String(user.id),
          email: user.email,
          name: user.nombre,
          role: user.rol,
          team: user.equipo,
          activo: user.activo,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.team = (user as any).team;
        token.userId = user.id;
        token.activo = (user as any).activo ?? true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).team = token.team;
        (session.user as any).id = token.userId;
        (session.user as any).activo = token.activo;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 horas
  },
});
