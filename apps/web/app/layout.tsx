import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/lib/query-provider";
import Navbar from "@/components/layout/Navbar";
import AuthProvider from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/lib/theme";

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
        {/* Prevent flash of wrong theme: read localStorage before first paint */}
        <script
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
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <Navbar />
              <div style={{ paddingTop: "64px" }}>{children}</div>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
