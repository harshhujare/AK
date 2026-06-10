import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/lib/query-provider";
import Navbar from "@/components/layout/Navbar";
import BottomNav from "@/components/layout/BottomNav";
import AuthProvider from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/lib/theme";

import Script from "next/script";

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
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`} data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="offline" href="/offline.html" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="theme-color" content="#0f0f13" />
      </head>
      <body className="min-h-full flex flex-col">
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('theme');
                if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', t);
              } catch(e) {}
            `,
          }}
        />
        <Script
          id="sw-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  var swUrl = ${process.env.NEXT_PUBLIC_DISABLE_SW === 'true' ? "'/sw-kill.js'" : "'/sw.js'"};
                  navigator.serviceWorker.register(swUrl)
                    .catch(function() { /* SW registration failed */ });
                });
              }
            `,
          }}
        />
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <Navbar />
              <div style={{ paddingTop: "64px" }}>
                {children}
              </div>
              <BottomNav />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
