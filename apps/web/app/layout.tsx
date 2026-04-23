import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vamos — Autonomous Financial Advisor",
  description:
    "Ask why, not just how much. Reasoning across News → Sector → Stock → Portfolio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('vamos-theme') || 'light';
                document.documentElement.setAttribute('data-theme', t);
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
