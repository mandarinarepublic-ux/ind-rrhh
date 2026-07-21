// Puerta de entrada: cada quien a su lugar segun el rol.
import { redirect } from 'next/navigation';
import { sesionActual, ROLES_ADMIN } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export default function Inicio() {
  const sesion = sesionActual();
  if (!sesion) redirect('/login');
  redirect(ROLES_ADMIN.includes(sesion.rol) || sesion.rol === 'JEFE' ? '/panel' : '/mi');
}
