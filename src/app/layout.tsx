import type { Metadata } from "next";
import Script from 'next/script';
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { Coffee } from "lucide-react";

export const metadata: Metadata = {
  title: "Scrabblex",
  description: "A classic word game with a modern twist.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Literata:opsz@7..72&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      {/* Google tag (gtag.js) */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-2Y3VRVQ5RJ"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-2Y3VRVQ5RJ');
        `}
      </Script>
      <body className="font-body antialiased">
        {children}
        <Toaster />
        {/* App footer */}
        <footer className="m-8 pt-6 gap-2 flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
          <p>Scrabblex &copy; {new Date().getFullYear()}</p>
          <p>
            <a
              href="https://quantumbrackets.com/contact#:~:text=%2B1-,How%20Can%20We%20Help"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mr-2"
              aria-label="Quantum Brackets"
            >
              <img
                src="https://images.squarespace-cdn.com/content/v1/5bfbd1ad9d5abb4375832c87/1543230554854-YU54RXE45P4AAMT5G8RD/icon_512.png?format=2500w"
                alt="Quantum Brackets Logo"
                width={16}
                height={16}
              />
            </a>
            <a
              href="https://buymeacoffee.com/juju_bard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-muted-foreground hover:text-primary"
              aria-label="Buy Me A Coffee"
            >
              <Coffee className="h-4 w-4" data-ai-hint="coffee donation" />
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
