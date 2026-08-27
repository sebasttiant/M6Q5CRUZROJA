import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "M6Q5 · Cruz Roja Antioquia", template: "%s · M6Q5" },
  description: "Sistema institucional para análisis de causa raíz con metodología 6M y tres porqués.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
