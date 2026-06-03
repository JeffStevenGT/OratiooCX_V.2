import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/shared/Sidebar';

export default async function DashboardLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = {
    name: session.user.name || 'Usuario',
    email: session.user.email || '',
    userRole: (session.user as any).role || 'asesor',
  };

  return (
    <div className="flex min-h-screen bg-[#f5f5fa]">
      <Sidebar userName={user.name} userRole={user.role} />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
