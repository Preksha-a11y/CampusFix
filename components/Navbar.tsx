'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserCheck, LogIn, LogOut, ShieldCheck, Wrench, GraduationCap, ChevronRight } from 'lucide-react';

interface UserSession {
  user_id: number;
  full_name: string;
  email: string;
  role_id: number;
  role_name: 'REPORTER' | 'STAFF' | 'ADMIN';
}

export default function Navbar() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const fetchSession = () => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSession();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">ESTATE ADMIN</span>;
      case 'STAFF':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">MAINTENANCE STAFF</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">STUDENT / FACULTY</span>;
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
            CF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                CampusFix
              </span>
              <span className="hidden md:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                DBMS Level 3
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Intelligent Complaint Resolution Platform</p>
          </div>
        </Link>

        {/* RBAC-Enforced Navigation Links */}
        <nav className="flex items-center gap-2 sm:gap-3">
          {loading ? (
            <div className="w-32 h-8 bg-slate-100 animate-pulse rounded-xl" />
          ) : user ? (
            <>
              {/* If REPORTER: Only show Reporter Portal */}
              {user.role_name === 'REPORTER' && (
                <Link
                  href="/reporter"
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-1.5 ${
                    pathname === '/reporter'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>My Reporter Portal</span>
                </Link>
              )}

              {/* If STAFF: Only show Staff Portal */}
              {user.role_name === 'STAFF' && (
                <Link
                  href="/staff"
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-1.5 ${
                    pathname === '/staff'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  <span>My Work Orders</span>
                </Link>
              )}

              {/* If ADMIN: Show Admin Console */}
              {user.role_name === 'ADMIN' && (
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-1.5 ${
                    pathname === '/admin'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Console</span>
                </Link>
              )}

              {/* User Identity Pill & Switch Role */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {user.full_name}
                  </span>
                  <div className="mt-0.5">{getRoleBadge(user.role_name)}</div>
                </div>

                <Link
                  href="/login"
                  title="Switch Role or Account"
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-medium transition flex items-center gap-1"
                >
                  <span>Switch Role</span>
                </Link>

                <button
                  onClick={handleLogout}
                  title="Log Out"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Select Role to Login</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
