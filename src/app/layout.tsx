import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
// GeistMono import and usage were removed in a previous step due to a "Module not found" error.
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/modules/theme/ThemeContext";

export const metadata: Metadata = {
  title: "InsightFlow",
  description: "AI-Powered Content Analysis and Q&A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground min-h-screen"
        suppressHydrationWarning
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
