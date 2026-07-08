import type { Metadata } from "next";
import { Anton, Geist, Ubuntu_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const ubuntuMono = Ubuntu_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ubuntu-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.gym.stringwebs.com"),
  title: {
    default: "STRING GYM — CRM para gimnasios",
    template: "%s | STRING GYM",
  },
  description: "CRM y gestión operativa para gimnasios — STRING GYM",
  applicationName: "STRING GYM",
  openGraph: {
    title: "STRING GYM — CRM para gimnasios",
    description: "CRM y gestión operativa para gimnasios — STRING GYM",
    siteName: "STRING GYM",
    locale: "es_MX",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${anton.variable} ${geist.variable} ${ubuntuMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
