'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

const ENLACES = [
  { href: '/panel',               texto: 'Resumen',      icono: '📊', exacto: true },
  { href: '/panel/empleados',     texto: 'Equipo',       icono: '👥' },
  { href: '/panel/aprobaciones',  texto: 'Aprobaciones', icono: '✅' },
  { href: '/panel/pagos',         texto: 'Pagos',        icono: '💵' },
];

export default function Nav({ sesion }) {
  const ruta = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const activo = (e) => (e.exacto ? ruta === e.href : ruta.startsWith(e.href));

  async function salir() {
    await api.logout();
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/panel" className="flex items-center gap-2 shrink-0">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-ind-600 text-white">👷</span>
            <span className="font-bold text-slate-800 hidden sm:block">
              INDFACTORY <span className="text-slate-400 font-medium">RRHH</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-1">
            {ENLACES.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  activo(e) ? 'bg-ind-50 text-ind-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="mr-1.5">{e.icono}</span>
                {e.texto}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/mi" className="hidden sm:inline text-sm text-slate-500 hover:text-ind-600">
              Mi ficha
            </Link>
            <div className="hidden sm:block text-right leading-tight">
              <p className="text-sm font-medium text-slate-700">{sesion.nombre}</p>
              <p className="text-xs text-slate-400">{sesion.rol}</p>
            </div>
            <button onClick={salir} className="btn-suave !px-3" title="Cerrar sesion">
              ⏻
            </button>
            <button
              className="md:hidden btn-suave !px-3"
              onClick={() => setAbierto((v) => !v)}
              aria-label="Menu"
            >
              ☰
            </button>
          </div>
        </div>

        {abierto && (
          <nav className="md:hidden pb-3 grid grid-cols-2 gap-2">
            {ENLACES.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                onClick={() => setAbierto(false)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium ${
                  activo(e) ? 'bg-ind-50 text-ind-700' : 'bg-slate-50 text-slate-600'
                }`}
              >
                <span className="mr-1.5">{e.icono}</span>
                {e.texto}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
