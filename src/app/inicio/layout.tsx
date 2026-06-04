import { ProjectProvider } from '@/lib/project-context';

export default function InicioLayout({ children }: { children: React.ReactNode }) {
  return <ProjectProvider>{children}</ProjectProvider>;
}
