// El panel es solo para quien administra o dirige un area.
// Aqui SI se verifica la firma de la cookie (corre en Node, no en Edge).

import { redirect } from 'next/navigation';
import { sesionActual, esAdmin, esJefe } from '@/lib/guard';
import Nav from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default function PanelLayout({ children }) {
  const sesion = sesionActual();
  if (!sesion) redirect('/login');
  if (!esAdmin(sesion) && !esJefe(sesion)) redirect('/mi');

  return (
    <div className="min-h-screen">
      <Nav sesion={sesion} />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
