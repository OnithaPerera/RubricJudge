import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

import { ThemeProvider } from "@/components/theme-provider";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "RubricJudge - AI-Powered Assignment Evaluation",
  description:
    "Submit your assignment draft and evaluation rubric to receive instant multi-agent AI diagnostic feedback with actionable revision advice.",
  keywords: ["assignment evaluation", "AI grading", "rubric feedback", "academic writing"],
  openGraph: {
    title: "RubricJudge - AI-Powered Assignment Evaluation",
    description: "Multi-agent AI evaluation committee for academic assignments.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${inter.variable}`}>
      <body className="font-inter antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          <main className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
