import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export default function MiLayout({ children }) {
  if (!sesionActual()) redirect('/login');
  return <div className="min-h-screen bg-slate-100">{children}</div>;
}
