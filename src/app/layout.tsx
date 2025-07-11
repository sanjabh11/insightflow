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
        {/*
          Main app container: centers all content, provides responsive padding, and ensures glassmorphism and gradient background are visible.
          See globals.css for .centered-app-container and glass styles.
        */}
        <div className="centered-app-container">
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
