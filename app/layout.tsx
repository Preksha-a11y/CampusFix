import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CampusFix | Intelligent Complaint Resolution Platform',
  description: 'DBMS Level 3 Experiential Learning Project - PES University',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-sky-500/20">
                CF
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  CampusFix
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                  PostgreSQL + pgvector + MongoDB
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/reporter"
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-700 hover:text-sky-600 hover:bg-slate-100 transition-colors"
              >
                Reporter Portal
              </Link>
              <Link
                href="/staff"
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-700 hover:text-sky-600 hover:bg-slate-100 transition-colors"
              >
                Staff Portal
              </Link>
              <Link
                href="/admin"
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-700 hover:text-sky-600 hover:bg-slate-100 transition-colors"
              >
                Admin Console
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          CampusFix: Intelligent Campus Complaint Management and Resolution System | DBMS Level 3
        </footer>
      </body>
    </html>
  );
}
