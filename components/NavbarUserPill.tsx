'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserCheck, LogIn, ChevronDown } from 'lucide-react';

interface UserSession {
  user_id: number;
  full_name: string;
  email: string;
  role_id: number;
  role_name: 'REPORTER' | 'STAFF' | 'ADMIN';
}

export default function NavbarUserPill() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return <div className="w-24 h-8 bg-slate-100 animate-pulse rounded-xl" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Sign In</span>
      </Link>
    );
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'STAFF':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  return (
    <Link
      href="/login"
      title="Click to switch profile or sign in with another account"
      className="inline-flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition group text-xs"
    >
      <div className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-[11px] shadow-xs">
        {user.full_name.charAt(0)}
      </div>
      <div className="flex flex-col text-left">
        <span className="font-semibold text-slate-800 truncate max-w-[120px] sm:max-w-[150px] leading-tight">
          {user.full_name.split(' ')[0]}
        </span>
        <span className="text-[10px] text-slate-400 leading-tight">Switch User</span>
      </div>
      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${getRoleColor(user.role_name)}`}>
        {user.role_name}
      </span>
    </Link>
  );
}
