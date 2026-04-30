import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MOIJEY | AI Sales Co-Pilot",
  description: "Enterprise knowledge assistant for MOIJEY sales representatives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${playfair.variable} antialiased selection:bg-accent/30`}>
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "!bg-surface !border !border-border/60 !text-foreground !rounded-2xl",
              title: "!font-medium",
              description: "!text-muted",
              success: "!border-green-500/40",
              error: "!border-red-500/40",
            },
          }}
        />
      </body>
    </html>
  );
}
