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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Dynamic import: evita que el middleware (Edge) cargue pg
        const { default: pool } = await import('./db');
        const bcrypt = (await import('bcryptjs')).default;

        const { rows } = await pool.query(
          `SELECT id, email, nombre, password_hash, rol, equipo, activo
           FROM usuarios WHERE email = $1 AND activo = true`,
          [credentials.email as string]
        );

        if (rows.length === 0) return null;

        const user = rows[0];

        // Verificar contraseña en desarrollo: aceptar texto plano o hash
        // En producción: solo bcrypt
        const passwordMatch =
          process.env.NODE_ENV === 'production'
            ? await bcrypt.compare(credentials.password as string, user.password_hash)
            : (await bcrypt.compare(credentials.password as string, user.password_hash).catch(() => false))
              || credentials.password === user.password_hash; // Fallback dev: texto plano

        if (!passwordMatch) return null;

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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).team = token.team;
        (session.user as any).id = token.userId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});
