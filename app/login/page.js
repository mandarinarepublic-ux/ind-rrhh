'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Aviso, Cargando } from '@/components/ui';

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState(null); // 'login' | 'setup'
  const [cedula, setCedula] = useState('');
  const [pin, setPin] = useState('');
  const [nuevo, setNuevo] = useState({ nombres: '', apellidos: '', cedula: '', pin: '', pin2: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // ¿Base vacia? Entonces toca crear el primer administrador.
  useEffect(() => {
    fetch('/api/auth/login')
      .then((r) => r.json())
      .then((r) => setModo(r.requiereSetup ? 'setup' : 'login'))
      .catch(() => setModo('login'));
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.login(cedula, pin);
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setEnviando(false);
    }
  }

  async function crearAdmin(e) {
    e.preventDefault();
    setError('');

    if (nuevo.pin !== nuevo.pin2) return setError('Los dos PIN no coinciden.');
    if (!/^\d{6}$/.test(nuevo.pin)) return setError('El PIN debe ser de 6 digitos.');

    setEnviando(true);
    try {
      await api.setup(nuevo);
      router.replace('/panel');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (modo === null) {
    return (
      <main className="min-h-screen grid place-items-center">
        <Cargando />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-ind-800 to-ind-600">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-white/15 text-white text-2xl mb-3">
            👷
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">INDFACTORY</h1>
          <p className="text-ind-100 text-sm">Recursos Humanos</p>
        </div>

        <div className="tarjeta p-6">
          {modo === 'setup' ? (
            <form onSubmit={crearAdmin} className="space-y-4">
              <div>
                <h2 className="font-semibold text-slate-800">Crear administrador</h2>
                <p className="text-sm text-slate-500 mt-1">
                  No hay nadie registrado todavia. Esta primera cuenta sera la de administracion.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="etiqueta">Nombres</label>
                  <input
                    className="campo" required value={nuevo.nombres}
                    onChange={(e) => setNuevo({ ...nuevo, nombres: e.target.value })}
                  />
                </div>
                <div>
                  <label className="etiqueta">Apellidos</label>
                  <input
                    className="campo" required value={nuevo.apellidos}
                    onChange={(e) => setNuevo({ ...nuevo, apellidos: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="etiqueta">Cedula</label>
                <input
                  className="campo" required inputMode="numeric" value={nuevo.cedula}
                  onChange={(e) => setNuevo({ ...nuevo, cedula: e.target.value.replace(/\D/g, '') })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="etiqueta">PIN (6 digitos)</label>
                  <input
                    className="campo tracking-widest" required type="password" inputMode="numeric"
                    maxLength={6} value={nuevo.pin}
                    onChange={(e) => setNuevo({ ...nuevo, pin: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <div>
                  <label className="etiqueta">Repite el PIN</label>
                  <input
                    className="campo tracking-widest" required type="password" inputMode="numeric"
                    maxLength={6} value={nuevo.pin2}
                    onChange={(e) => setNuevo({ ...nuevo, pin2: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
              </div>

              <Aviso>{error}</Aviso>

              <button className="btn-primario w-full" disabled={enviando}>
                {enviando ? 'Creando…' : 'Crear y entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={entrar} className="space-y-4">
              <div>
                <label className="etiqueta">Cedula</label>
                <input
                  className="campo" required inputMode="numeric" autoFocus autoComplete="username"
                  placeholder="1712345678" value={cedula}
                  onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div>
                <label className="etiqueta">PIN</label>
                <input
                  className="campo text-center text-2xl tracking-[0.5em]" required type="password"
                  inputMode="numeric" maxLength={6} autoComplete="current-password"
                  placeholder="••••••" value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <Aviso>{error}</Aviso>

              <button className="btn-primario w-full" disabled={enviando || pin.length < 6}>
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>

              <p className="text-xs text-center text-slate-400">
                ¿Olvidaste tu PIN? Pideselo a Recursos Humanos.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
