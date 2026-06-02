/**
 * app/api/auth/[...nextauth]/route.ts — API Route de NextAuth.js
 */

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
