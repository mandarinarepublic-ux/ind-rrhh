# INDFACTORY · RRHH

App de gestión de personal: equipo, faltas, horas extra, vacaciones, pagos y anticipos.
Next.js 14 + Supabase (schema `rrhh` del proyecto `mandarina-DATA`).

---

## 1. Arrancar por primera vez

**a) Pega la llave de Supabase**

Abre `.env.local` y llena `SUPABASE_SERVICE_ROLE_KEY`.
La sacas de: Supabase → Project Settings → API Keys → **service_role** (secret).

El `SESSION_SECRET` ya viene generado. No lo cambies después de que la gente
empiece a usar la app: al cambiarlo se cierran todas las sesiones abiertas.

**b) Levanta la app**

```bash
npm install
npm run dev
```

Entra a http://localhost:3000

**c) Crea tu cuenta**

Como la tabla de empleados está vacía, la pantalla de login te ofrece
*Crear administrador*. Esa puerta se cierra sola apenas exista la primera persona.

---

## 2. Cargar al equipo

En **Equipo → + Nueva persona**. Los campos que de verdad importan:

| Campo | Por qué importa |
|---|---|
| **Fecha de ingreso** | De aquí sale el cálculo de vacaciones. Si está mal, el saldo sale mal. |
| **Sueldo base** | Con esto se valora la hora extra (sueldo ÷ 240 h). Sin sueldo, las extras salen en $0. |
| **PIN de 6 dígitos** | Es su clave. Se la entregas y ellos la cambian desde *Mi ficha*. |
| **Ajuste de vacaciones** | El saldo con el que arranca. Ver abajo. |
| **Rol** | `EMPLEADO` ve solo lo suyo · `JEFE` aprueba a su equipo · `RRHH`/`ADMIN` ven todo. |

### El ajuste de vacaciones

El sistema calcula los días ganados desde la fecha de ingreso, pero **no sabe
cuántos días ya se tomó esa persona antes** de que existiera esta app.

Por eso cada ficha tiene *Ajuste de vacaciones*:

```
saldo = días ganados por antigüedad − días registrados aquí + ajuste
```

Ejemplo: alguien con 6 años acumula 91 días ganados. Si en la vida real le
quedan 12 días disponibles, pones **ajuste = −79**. De ahí en adelante el
sistema lleva la cuenta solo.

Hazlo una sola vez, al cargar a cada persona.

---

## 3. Cómo se usa día a día

- **Faltas, permisos, horas extra, anticipos** → entras a la ficha de la persona
  (Equipo → clic en su nombre) y usas *+ Registrar*.
- **Corregir algo** → clic en cualquier fila y se abre para editar. Todo registro
  se puede corregir o borrar; queda constancia de quién lo cambió en la bitácora.
- **Pagos** → pestaña *Pagos*. Registra lo que ya pagaste: monto, descuentos,
  método, referencia y **foto del comprobante**. Exportas el mes a Excel con un botón.

### Cómo funcionan los pagos por mes

Cada pago tiene **dos fechas distintas**, y esa es la parte que confunde:

| Campo | Qué significa |
|---|---|
| **Fecha del pago** | El día real en que saliste la plata. |
| **Mes al que corresponde** | El mes que estás pagando. |

Casi siempre coinciden, pero no cuando pagas con desfase. Si el 3 de agosto pagas
el sueldo de julio, pones *fecha del pago* = 3 de agosto y *mes al que corresponde*
= julio. La pantalla de Pagos filtra por el **mes al que corresponde**, así que ese
pago aparece en julio — que es donde tú lo buscas cuando quieres saber cuánto te
costó julio.

Si no llenas el mes, se toma solo el de la fecha de pago. Nunca queda un pago suelto.

Un mismo mes puede tener varios pagos por persona (quincena + quincena, o sueldo +
horas extra + bono). Todos se suman en el total del mes.

### Comprobantes y adjuntos

- En cada pago puedes adjuntar la **foto de la transferencia**; en cada falta, el
  certificado médico. Desde el celular se abre la cámara directamente.
- Los archivos van a un bucket **privado**. No existe un enlace público: cada vez
  que alguien abre un comprobante, el servidor verifica el permiso y firma un
  enlace que caduca en 5 minutos.
- El empleado ve el comprobante de **sus** pagos desde *Mi ficha*, y de nadie más.
- **Aprobaciones** → cuando alguien pide vacaciones desde su celular, cae ahí.
  Te muestra si le alcanza el saldo antes de que apruebes.
- **Los empleados** entran a la misma URL con su cédula y PIN, y caen
  directamente en *Mi ficha*: su saldo de vacaciones, sus pagos, sus horas
  extra y sus faltas. No ven nada de nadie más.

---

## 4. Lo que este sistema NO hace (a propósito)

- **No calcula la nómina.** No liquida IESS, décimos ni fondos de reserva:
  tú pones el monto que ya calculas y el sistema lo registra. La tabla ya está
  preparada para agregarlo después sin migrar nada.
- **No marca entrada y salida.** Solo se registran faltas y horas extra.

---

## 5. Seguridad

- El schema `rrhh` tiene RLS activo **sin políticas**: con la llave pública de
  Supabase no se lee ni una fila. Todo pasa por el servidor.
- La `service_role` vive solo en el servidor (`lib/supabase.js` revienta a
  propósito si alguien la importa desde el navegador).
- La sesión es una cookie `httpOnly` firmada con HMAC. Alterar el rol a mano
  invalida la firma.
- Los PIN se guardan con bcrypt y **nunca** salen del servidor, ni hasheados.
- El login se bloquea 5 minutos tras 5 intentos fallidos.
- Quién puede ver y tocar qué se decide en un solo archivo: `lib/guard.js`.
- Todo cambio queda registrado en `rrhh.bitacora` (quién, qué, antes y después).

---

## 6. Desplegar en Vercel

```bash
npx vercel --prod
```

Carga en Vercel las mismas variables de `.env.local`:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`.

---

## 7. Mapa del código

```
app/
  login/           entrada + creación del primer administrador
  panel/           vista ADMIN: resumen, equipo, aprobaciones, pagos
  mi/              vista EMPLEADO (móvil)
  api/
    auth/          login, logout, quién soy
    setup/         primer administrador (se cierra sola)
    data/[recurso] CRUD único, con lista blanca de campos por recurso
    dashboard/     todo el panel en una llamada
    mi/            todo el portal del empleado en una llamada
lib/
  supabase.js      cliente service_role + bitácora
  session.js       cookie firmada
  guard.js         permisos  ← el archivo que importa
  fmt.js           formato de fechas, plata y días
  api.js           cliente HTTP del navegador
```
