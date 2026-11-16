'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UserCheck,
  Wrench,
  ShieldCheck,
  UserPlus,
  LogIn,
  KeyRound,
  Mail,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Building,
  GraduationCap
} from 'lucide-react';

interface CampusUser {
  user_id: number;
  full_name: string;
  email: string;
  role_id: number;
  role_name: 'REPORTER' | 'STAFF' | 'ADMIN';
}

export default function LoginPage() {
  const router = useRouter();

  // Active user session
  const [currentUser, setCurrentUser] = useState<CampusUser | null>(null);
  const [allUsers, setAllUsers] = useState<CampusUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Tabs: 'select' (1-click personas) | 'manual' (email + password) | 'register' (sign up)
  const [activeTab, setActiveTab] = useState<'select' | 'manual' | 'register'>('select');

  // Manual login form state
  const [manualEmail, setManualEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('password123');
  const [manualLoading, setManualLoading] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRoleId, setRegRoleId] = useState('1'); // 1: Reporter, 2: Staff, 3: Admin
  const [regPassword, setRegPassword] = useState('password123');
  const [regLoading, setRegLoading] = useState(false);

  // Feedback states
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSession();
    fetchUsers();
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/auth/users');
      const data = await res.json();
      if (data.success && data.users) {
        setAllUsers(data.users);
      }
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const getPortalUrl = (roleName: string) => {
    switch (roleName) {
      case 'STAFF':
        return '/staff';
      case 'ADMIN':
        return '/admin';
      default:
        return '/reporter';
    }
  };

  // 1-Click Login Handler
  const handleQuickLogin = async (targetUser: CampusUser) => {
    setMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetUser.email, password: 'password123' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      setCurrentUser(data.user);
      setMsg({ type: 'success', text: `Logged in as ${data.user.full_name} (${data.user.role_name})` });

      setTimeout(() => {
        router.push(getPortalUrl(data.user.role_name));
      }, 700);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  // Manual Login Handler
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setManualLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: manualEmail, password: manualPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid credentials');

      setCurrentUser(data.user);
      setMsg({ type: 'success', text: `Welcome back, ${data.user.full_name}!` });

      setTimeout(() => {
        router.push(getPortalUrl(data.user.role_name));
      }, 800);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setManualLoading(false);
    }
  };

  // Register New User Handler (Persists directly to database)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setRegLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: regFullName,
          email: regEmail,
          role_id: Number(regRoleId),
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setCurrentUser(data.user);
      setMsg({
        type: 'success',
        text: `Account created and persisted for ${data.user.full_name}! Redirecting to portal...`,
      });

      // Refresh users list so new account is visible
      await fetchUsers();

      setTimeout(() => {
        router.push(getPortalUrl(data.user.role_name));
      }, 1000);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setRegLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setMsg({ type: 'success', text: 'You have been successfully logged out.' });
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  // Group users by category
  const reporters = allUsers.filter((u) => u.role_name === 'REPORTER');
  const staffMembers = allUsers.filter((u) => u.role_name === 'STAFF');
  const admins = allUsers.filter((u) => u.role_name === 'ADMIN');

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Page Title & Intro */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" /> CampusFix User Access Control
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Select or Sign In to Your Campus Profile
        </h1>
        <p className="text-slate-500 text-sm max-w-xl mx-auto">
          Complaints, upvotes, and work orders will be attributed and persisted directly to your selected identity in real-time.
        </p>
      </div>

      {/* Currently Logged In Banner */}
      {currentUser && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {currentUser.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{currentUser.full_name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-200/70 text-sky-800">
                  {currentUser.role_name}
                </span>
              </div>
              <p className="text-xs text-slate-500">{currentUser.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={getPortalUrl(currentUser.role_name)}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition"
            >
              Open My Portal &rarr;
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" /> Log Out
            </button>
          </div>
        </div>
      )}

      {/* Alert Message */}
      {msg && (
        <div
          className={`mb-6 p-4 rounded-2xl text-sm flex items-center gap-2.5 shadow-xs transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{msg.text}</span>
        </div>
      )}

      {/* Main Tabs Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('select')}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'select'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-sky-600" /> 1-Click Campus Personas
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'manual'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <LogIn className="w-4 h-4 text-indigo-600" /> Manual Sign In
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'register'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <UserPlus className="w-4 h-4 text-emerald-600" /> Register New Account
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* TAB 1: 1-Click Database Personas */}
          {activeTab === 'select' && (
            <div className="space-y-8">
              {loadingUsers ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500" />
                  <p className="text-xs">Loading database accounts...</p>
                </div>
              ) : (
                <>
                  {/* Section 1: Students & Faculty */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <GraduationCap className="w-4 h-4 text-sky-600" />
                      <span>Students &amp; Faculty (Reporters)</span>
                      <span className="text-xs font-normal text-slate-400">({reporters.length} accounts in DB)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {reporters.map((u) => (
                        <button
                          key={u.user_id}
                          onClick={() => handleQuickLogin(u)}
                          className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between group relative hover:border-sky-400 hover:shadow-xs ${
                            currentUser?.user_id === u.user_id
                              ? 'bg-sky-50/70 border-sky-300 ring-2 ring-sky-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-slate-900 group-hover:text-sky-600 transition">
                                {u.full_name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">ID #{u.user_id}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono truncate">{u.email}</p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-medium text-sky-600">Select Profile &rarr;</span>
                            {currentUser?.user_id === u.user_id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-200 text-sky-800 font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Maintenance Staff */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      <span>Maintenance Staff (Technicians)</span>
                      <span className="text-xs font-normal text-slate-400">({staffMembers.length} accounts in DB)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {staffMembers.map((u) => (
                        <button
                          key={u.user_id}
                          onClick={() => handleQuickLogin(u)}
                          className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between group relative hover:border-amber-400 hover:shadow-xs ${
                            currentUser?.user_id === u.user_id
                              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-slate-900 group-hover:text-amber-600 transition">
                                {u.full_name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">ID #{u.user_id}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono truncate">{u.email}</p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-medium text-amber-600">Select Profile &rarr;</span>
                            {currentUser?.user_id === u.user_id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section 3: Campus Estate Admin */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      <span>Campus Estate Administration</span>
                      <span className="text-xs font-normal text-slate-400">({admins.length} account in DB)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {admins.map((u) => (
                        <button
                          key={u.user_id}
                          onClick={() => handleQuickLogin(u)}
                          className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between group relative hover:border-purple-400 hover:shadow-xs ${
                            currentUser?.user_id === u.user_id
                              ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-slate-900 group-hover:text-purple-600 transition">
                                {u.full_name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">ID #{u.user_id}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono truncate">{u.email}</p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-medium text-purple-600">Select Profile &rarr;</span>
                            {currentUser?.user_id === u.user_id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-200 text-purple-800 font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: Manual Login */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualLogin} className="max-w-md mx-auto space-y-4 py-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">PES Campus Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. sneha.rao@pes.edu"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Account Password</label>
                  <span className="text-[11px] text-slate-400">Demo: password123</span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={manualLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2"
              >
                {manualLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Sign In to CampusFix
              </button>
            </form>
          )}

          {/* TAB 3: Register New User */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="max-w-md mx-auto space-y-4 py-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name &amp; Title</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rohan Verma (Student)"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">PES Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. rohan.verma@pes.edu"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Campus Role</label>
                <select
                  value={regRoleId}
                  onChange={(e) => setRegRoleId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="1">Student / Faculty (Complaint Reporter)</option>
                  <option value="2">Maintenance Staff (Technician)</option>
                  <option value="3">Campus Estate Administrator</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Determines your access permissions and available dashboard features.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="Create a password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2"
              >
                {regLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Create &amp; Persist Account in Database
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
