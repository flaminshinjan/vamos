import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vamos — Autonomous Financial Advisor",
  description:
    "Reasoning-first portfolio intelligence. News → Sector → Stock → Portfolio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                <span className="mr-2 rounded-md bg-accent-blue/15 px-2 py-1 text-accent-blue">
                  Vamos
                </span>
                Autonomous Financial Advisor
              </h1>
              <p className="mt-1 text-sm text-neutral-400">
                Causal reasoning across News → Sector → Stock → Portfolio
              </p>
            </div>
            <div className="text-right text-xs text-neutral-500">
              Indian markets · INR · Mock dataset
            </div>
          </header>
          {children}
          <footer className="mt-16 border-t border-ink-600 pt-6 text-center text-xs text-neutral-500">
            Built as a monorepo: <code className="text-neutral-400">apps/api</code>{" "}
            (FastAPI) · <code className="text-neutral-400">apps/web</code> (Next.js) ·{" "}
            <code className="text-neutral-400">packages/core</code> &{" "}
            <code className="text-neutral-400">packages/agents</code>
          </footer>
        </div>
      </body>
    </html>
  );
}
