'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Wrench, Sparkles, Database, CheckCircle2, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const quickLogin = async (email: string, redirectTo: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 py-6">
      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-12 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.15),transparent_50%)]" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-semibold border border-sky-400/30">
            <Sparkles className="w-3.5 h-3.5" /> PES University DBMS Level 3 Project
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Intelligent Campus Complaint Management & Resolution
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Eliminating duplicate campus maintenance work orders with dense vector embeddings (<code className="text-sky-400">pgvector</code>), ACID transactional workflow tracking in PostgreSQL, and dynamic document updates in MongoDB.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <Database className="w-4 h-4 text-emerald-400" /> PostgreSQL 17 (Supabase)
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <Sparkles className="w-4 h-4 text-sky-400" /> pgvector 384-d Cosine Radar
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-amber-400" /> MongoDB 8.2 (Live Upvotes & Docs)
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* 1-Click Role Login Cards */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Select Role to Launch Portal</h2>
            <p className="text-slate-500 text-sm">Choose an authorized campus profile for instant evaluation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Reporter */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                  Student / Faculty
                </h3>
                <p className="text-xs text-slate-500 font-mono">aarav.sharma@pes.edu</p>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Submit complaints with AI duplicate radar
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Upvote existing issues to prevent duplicates
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Rate resolution (1–5 stars)
                </li>
              </ul>
            </div>
            <button
              onClick={() => quickLogin('aarav.sharma@pes.edu', '/reporter')}
              disabled={loading}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-sky-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            >
              Enter Reporter Portal <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 2: Maintenance Staff */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                  Maintenance Staff
                </h3>
                <p className="text-xs text-slate-500 font-mono">suresh.plumber@pes.edu</p>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> View assigned department work orders
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Update progress (In Progress / Resolved)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Trigger database audit log remarks
                </li>
              </ul>
            </div>
            <button
              onClick={() => quickLogin('suresh.plumber@pes.edu', '/staff')}
              disabled={loading}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            >
              Enter Staff Portal <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 3: Administrator */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Campus Administrator
                </h3>
                <p className="text-xs text-slate-500 font-mono">admin.campusfix@pes.edu</p>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> View Department Analytics KPIs View
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Overdue SLA breach monitor table
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Execute Level 3 Evaluation SQL Queries
                </li>
              </ul>
            </div>
            <button
              onClick={() => quickLogin('admin.campusfix@pes.edu', '/admin')}
              disabled={loading}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            >
              Enter Admin Console <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
