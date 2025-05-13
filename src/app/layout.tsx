import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
// GeistMono import and usage were removed in a previous step due to a "Module not found" error.
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'InsightFlow',
  description: 'AI-Powered Content Analysis and Q&A',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      {/*
        suppressHydrationWarning is added to html and body to prevent mismatches
        often caused by browser extensions modifying the DOM (e.g., adding attributes).
        The className for html tag now only includes GeistSans.variable as GeistMono was removed.
      */}
      <body className='antialiased' suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
