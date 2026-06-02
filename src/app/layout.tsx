import './globals.css';
import type { Metadata } from 'next';

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
    <html lang="es">
      <body className="min-h-screen bg-[#f5f5fa] antialiased">
        {children}
      </body>
    </html>
  );
}
