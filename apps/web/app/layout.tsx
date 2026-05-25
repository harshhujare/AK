import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/lib/query-provider";
import Navbar from "@/components/layout/Navbar";

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "AjitSir Academy — Maharashtra TET Exam Preparation",
  description:
    "Practice with real TET question papers, download expert notes, and track your progress — all in one place built for Maharashtra TET aspirants.",
  keywords: "Maharashtra TET, TET preparation, TET notes, TET practice tests, Ajit Kambale",
  openGraph: {
    title: "AjitSir Academy — Maharashtra TET Exam Preparation",
    description: "Expert TET preparation platform for Maharashtra students.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-white">
        <QueryProvider>
          <Navbar />
          <div style={{ paddingTop: "64px" }}>{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}
