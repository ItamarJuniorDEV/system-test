import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Studio · Gestão da loja", template: "%s · Studio" },
  description:
    "Gestão de projetos, ambientes, contratos e operação para uma loja de móveis.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
