// lib/session.js
// Sesion en cookie firmada con HMAC-SHA256. Sin dependencias externas.
//
// Formato: base64url(payloadJSON) + '.' + base64url(hmac)
// El payload viaja legible (no lleva nada secreto) pero NO se puede alterar
// sin SESSION_SECRET: cambiar el rol a mano invalida la firma.

import crypto from 'crypto';
import { COOKIE } from '@/lib/cookie';

export { COOKIE };
const DURACION_MS = 1000 * 60 * 60 * 12; // 12 horas

function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('Falta SESSION_SECRET (minimo 16 caracteres). Ver .env.example.');
  }
  return s;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function firmar(datos) {
  return crypto.createHmac('sha256', secreto()).update(datos).digest('base64url');
}

/** Crea el valor de la cookie para un empleado ya autenticado. */
export function crearSesion({ id, cedula, nombre, rol }) {
  const payload = b64(JSON.stringify({ id, cedula, nombre, rol, exp: Date.now() + DURACION_MS }));
  return `${payload}.${firmar(payload)}`;
}

/** Devuelve la sesion si la firma es valida y no expiro; si no, null. */
export function leerSesion(valor) {
  if (!valor || typeof valor !== 'string') return null;

  const [payload, firma] = valor.split('.');
  if (!payload || !firma) return null;

  const esperada = firmar(payload);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!datos.exp || datos.exp < Date.now()) return null;
    return datos;
  } catch {
    return null;
  }
}

export const opcionesCookie = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DURACION_MS / 1000,
};
