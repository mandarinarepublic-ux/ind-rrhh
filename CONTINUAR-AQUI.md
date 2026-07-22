# 📱 CONTINUAR AQUÍ — App RRHH INDFACTORY

> Handoff para retomar la sesión (incluso desde el celular). Última actualización: **22-jul-2026**.

---

## Qué es

App de gestión de personal de **INDFACTORY** (~20 personas). Next.js 14 + Supabase.

| | |
|---|---|
| **App en vivo** | https://ind-rrhh.vercel.app |
| **Repo (privado)** | https://github.com/mandarinarepublic-ux/ind-rrhh |
| **Vercel** | proyecto `ind-rrhh` (team `mandarinarepublic-6819s-projects`), conectado al repo → cada `git push` despliega solo |
| **Base de datos** | Supabase proyecto `piingkecjgoisnxccvaa` (mandarina-DATA), **schema `rrhh`** (aislado del CRM y los inbox) |
| **Local (Windows)** | `C:\Users\RodrigoWork\Desktop\ind-rrhh` |
| **Login** | cédula + PIN de 6 dígitos (bcrypt). Empleados reales ya cargados: 4. |

---

## Estado: TODO commiteado y en producción

- Rama `main` sincronizada con GitHub. Nada pendiente de subir.
- Lo que está en GitHub = lo que corre en producción.

## Lo que YA hace

- **Empleados**: ficha completa, alta/edición (desde la lista y desde el expediente), baja lógica (INACTIVO, no se borran).
- **Roles**: EMPLEADO / JEFE / RRHH / ADMIN. El **jefe aprueba solo a su equipo** (campo "Jefe directo").
- **Faltas y permisos**: por días completos o **por horas** (permiso parcial). El empleado avisa desde su portal (entra PENDIENTE) o el admin las registra directo.
- **Horas extra**: el empleado **solo declara las horas**; el admin/jefe fija el recargo y **el valor a pagar** al aprobar (con sugerencia sueldo÷240 editable).
- **Vacaciones**: saldo automático por antigüedad (ley EC), solicitud y aprobación. En el portal del empleado el saldo va **discreto** (no destacado, por tema laboral).
- **Pagos**: registro (no calcula IESS/décimos), con **comprobante de transferencia** (bucket privado `rrhh-adjuntos`, enlace firmado 5 min). Cada pago tiene *fecha de pago* y *mes al que corresponde*.
- **Por pagar**: cuánto le debes a cada quien por mes, **arrastrando meses incompletos**. Resta anticipos y **descuentos por días/horas no trabajados** ("día no trabajado no se paga", el admin pone el monto).
- **Reporte**: acumulado histórico (pagado/pendiente) por empleado y mes a mes.
- **Bandeja de aprobaciones**: vacaciones + horas extra + ausencias, todo en un lugar.
- Bitácora de todo cambio. Textos con tildes correctas.

## Seguridad (ya cerrada, a diferencia del CRM)

RLS deny-by-default (la llave pública no lee nada), `service_role` solo en servidor, permisos centralizados en `lib/guard.js`, PIN nunca sale del servidor, bloqueo tras 5 intentos, cookie de sesión firmada (HMAC).

---

## ⚠️ Pendientes / cosas a saber

1. **Andrés Castillo ($0) y Xavier Castillo ($1)** tienen sueldos de prueba. Ponerles el sueldo real (en *Editar datos*) para que "Por pagar" y "Reporte" calculen bien.
2. **Faltan ~16 personas por cargar.** Al cargar cada una, revisar dos anclas que el sistema no adivina:
   - **Ajuste de vacaciones**: días que ya traía acumulados.
   - **La nómina cuenta desde**: mes desde el que se le empieza a sumar el sueldo adeudado (por defecto el mes en curso; moverlo atrás solo si se le arrastran meses).
   - **Ojo con la cédula**: es la llave de acceso; un dígito mal y no puede entrar.
3. Idea futura mencionada: nada bloqueante. La app funciona de punta a punta.

---

## Cómo correr / desplegar (desde la máquina local)

```powershell
cd C:\Users\RodrigoWork\Desktop\ind-rrhh
npm install        # solo la primera vez
npm run dev        # local en http://localhost:3000
```

Desplegar a producción (o simplemente `git push`, que Vercel despliega solo):
```powershell
npx vercel deploy --prod --yes
```

**Variables de entorno** (ya cargadas en Vercel y en `.env.local` local): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`. La `.env.local` NO está en GitHub (está en `.gitignore`).

> ⚠️ **Nota Windows/PowerShell**: al cargar variables en Vercel desde PowerShell se cuela un BOM invisible que rompe Supabase. Ya está resuelto: `lib/env.js` limpia el BOM al leer. Si algún día una clave nueva falla solo en producción con un error de "ByteString / 65279", es eso.

---

## Mapa rápido del código

```
app/
  login/            entrada + creación del primer admin
  panel/            vista ADMIN: resumen, empleados, expediente [id], aprobaciones, pagos, por-pagar, reporte
  mi/               portal EMPLEADO (móvil)
  api/
    data/[recurso]  CRUD único, con lista blanca de campos y permisos por rol
    dashboard/ mi/ por-pagar/ reporte/ archivos/ auth/ setup/
lib/
  guard.js          permisos (quién ve/toca qué)  ← el archivo clave
  supabase.js       cliente service_role + bitácora
  session.js        cookie firmada ; env.js  limpia variables ; fmt.js  formatos
```

Para el detalle técnico de cada decisión, ver también los archivos de memoria de Claude (`ind-rrhh-app.md`).
