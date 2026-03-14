import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";

/* Display / headings — geometric, modern, distinctive */
const syne = Syne({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

/* Body / UI — clean, readable */
const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Postable",
  description: "Social media content powered by competitive intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${syne.variable} ${dmSans.variable} antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
