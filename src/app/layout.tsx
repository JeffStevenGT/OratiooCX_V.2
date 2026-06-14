import './globals.css';
import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import ThemeProvider from '@/components/shared/ThemeProvider';

export const metadata: Metadata = {
  title: 'Oratioo CX',
  description: 'CRM omnicanal con bots, discador y formación',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-[#f5f5fa] dark:bg-[#121218] antialiased transition-colors">
        <SessionProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
