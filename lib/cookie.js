// El nombre de la cookie vive aparte porque lo necesita el middleware, que
// corre en Edge y no puede cargar lib/session.js (usa node:crypto).
export const COOKIE = 'ind_rrhh_sesion';
