import './globals.css';

export const metadata = {
  title: 'RRHH · INDFACTORY',
  description: 'Gestión de personal: pagos, horas extra, vacaciones y faltas.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
