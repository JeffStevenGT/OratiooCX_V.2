/**
 * lib/project-context.tsx — Contexto de proyecto activo
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Proyecto = { id: number; nombre: string; nombre_visible: string; activo: boolean; config?: any };

const ProjectContext = createContext<{
  proyecto: Proyecto | null;
  setProyecto: (p: Proyecto) => void;
  proyectos: Proyecto[];
}>({ proyecto: null, setProyecto: () => {}, proyectos: [] });

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);

  useEffect(() => {
    fetch('/api/proyectos')
      .then(r => r.json())
      .then(data => {
        setProyectos(data);
        // Seleccionar Orange por defecto
        const activo = data.find((p: Proyecto) => p.activo !== false);
        if (activo) setProyecto(activo);
      });
  }, []);

  return (
    <ProjectContext.Provider value={{ proyecto, setProyecto, proyectos }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
