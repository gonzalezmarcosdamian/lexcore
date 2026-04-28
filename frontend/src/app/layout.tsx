import type { Metadata } from "next";
import { EB_Garamond, Lato } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { GoogleAnalytics } from "@next/third-parties/google";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-garamond",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  weight: ["300", "400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LexCore",
  description: "Gestión para estudios de abogados",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${garamond.variable} ${lato.variable}`}>
        <Providers>{children}</Providers>
        {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      </body>
    </html>
  );
}
