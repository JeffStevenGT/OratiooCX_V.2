/**
 * app/(dashboard)/client-layout.tsx — Wrapper cliente para ErrorBoundary + OfflineIndicator
 * Los componentes 'use client' no pueden usarse directamente en un layout async (servidor).
 */

'use client';

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import OfflineIndicator from '@/components/shared/OfflineIndicator';
import TopLoader from '@/components/shared/TopLoader';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
      <OfflineIndicator />
    </ErrorBoundary>
  );
}
