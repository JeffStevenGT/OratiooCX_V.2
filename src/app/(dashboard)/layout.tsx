import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/shared/Sidebar';
import ToastContainer from '@/components/shared/Toast';
import Breadcrumb from '@/components/shared/Breadcrumb';
import KeyboardShortcuts from '@/lib/keyboard-shortcuts';
import { ProjectProvider } from '@/lib/project-context';
import ClientLayout from './client-layout';
import { Suspense } from 'react';
import TopLoader from '@/components/shared/TopLoader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = {
    id: (session.user as any).id || '0',
    name: session.user.name || 'Usuario',
    email: session.user.email || '',
    userRole: (session.user as any).role || 'asesor',
  };

  return (
    <ProjectProvider>
      <Suspense fallback={null}>
        <TopLoader />
      </Suspense>
      <div className="flex min-h-screen bg-[#f5f5fa] dark:bg-[#121218]">
        <Sidebar userName={user.name} userRole={user.userRole} userId={user.id} />
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Breadcrumb />
            <ClientLayout>
              {children}
            </ClientLayout>
          </div>
        </main>
      </div>
      <ToastContainer />
      <KeyboardShortcuts />
    </ProjectProvider>
  );
}
