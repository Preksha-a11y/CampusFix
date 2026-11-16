import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

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
        <Navbar />

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
