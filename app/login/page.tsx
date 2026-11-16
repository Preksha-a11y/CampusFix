'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  GraduationCap,
  Wrench,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  LogIn,
  UserPlus,
  KeyRound,
  Mail,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  ChevronRight
} from 'lucide-react';

interface CampusUser {
  user_id: number;
  full_name: string;
  email: string;
  role_id: number;
  role_name: 'REPORTER' | 'STAFF' | 'ADMIN';
}

type SelectedRole = 'REPORTER' | 'STAFF' | 'ADMIN' | null;

export default function LoginPage() {
  const router = useRouter();

  // Active session
  const [currentUser, setCurrentUser] = useState<CampusUser | null>(null);
  const [allUsers, setAllUsers] = useState<CampusUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Step 1: Role Selection ('REPORTER' | 'STAFF' | 'ADMIN' | null)
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null);

  // Sub-tabs for the chosen role: 'profiles' | 'manual' | 'register'
  const [subTab, setSubTab] = useState<'profiles' | 'manual' | 'register'>('profiles');

  // Manual login inputs
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('password123');
  const [submitting, setSubmitting] = useState(false);

  // Register inputs
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('password123');

  // Feedback banner
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

  // 1-Click Profile Login
  const handleSelectUser = async (targetUser: CampusUser) => {
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
      setMsg({ type: 'success', text: `Signed in as ${data.user.full_name} (${data.user.role_name}). Entering workspace...` });

      setTimeout(() => {
        router.push(getPortalUrl(data.user.role_name));
      }, 600);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  // Manual Login Handler
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid credentials');

      // Verify that user matches the selected role
      if (selectedRole && data.user.role_name !== selectedRole) {
        throw new Error(`This account has role '${data.user.role_name}'. Please select the '${data.user.role_name}' role on the main login screen.`);
      }

      setCurrentUser(data.user);
      setMsg({ type: 'success', text: `Welcome, ${data.user.full_name}! Entering workspace...` });

      setTimeout(() => {
        router.push(getPortalUrl(data.user.role_name));
      }, 700);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Register New User for the selected role
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setMsg(null);
    setSubmitting(true);

    const roleIdMap = { REPORTER: 1, STAFF: 2, ADMIN: 3 };
    const roleId = roleIdMap[selectedRole];

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: regName,
          email: regEmail,
          role_id: roleId,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setCurrentUser(data.user);
      setMsg({
        type: 'success',
        text: `Account created & persisted in database for ${data.user.full_name}! Redirecting...`,
      });

      await fetchUsers();

      setTimeout(() => {
        router.push(getPortalUrl(data.user.role_name));
      }, 900);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setSelectedRole(null);
      setMsg({ type: 'success', text: 'You have been logged out.' });
    } catch (err) {
      console.error(err);
    }
  };

  // Filter users by the selected role ONLY
  const filteredUsers = allUsers.filter((u) => u.role_name === selectedRole);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" /> CampusFix Role-Based Access Control
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Select Your Campus Role to Log In
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm max-w-lg mx-auto">
          Just like the terminal menu, first pick your role. You will only be granted access to RBAC tasks and data views for that role.
        </p>
      </div>

      {/* Active User Session Banner */}
      {currentUser && (
        <div className="mb-6 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
              {currentUser.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{currentUser.full_name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800">
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
              Resume Workspace &rarr;
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Log Out
            </button>
          </div>
        </div>
      )}

      {/* Alert Messages */}
      {msg && (
        <div
          className={`mb-6 p-4 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 shadow-xs transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{msg.text}</span>
        </div>
      )}

      {/* STEP 1: ROLE SELECTION (Terminal-Style 3 Options) */}
      {!selectedRole ? (
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Step 1: Choose Your Role
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Role 1: Student / Faculty */}
            <button
              onClick={() => {
                setSelectedRole('REPORTER');
                setSubTab('profiles');
                setMsg(null);
              }}
              className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-sky-400 hover:shadow-md transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-base group-hover:text-sky-600 transition-colors">
                      1. Student / Faculty (Complaint Reporter)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                      REPORTER
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Log new maintenance tickets, scan duplicate radar using pgvector, upvote community issues, rate service.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>

            {/* Role 2: Maintenance Staff */}
            <button
              onClick={() => {
                setSelectedRole('STAFF');
                setSubTab('profiles');
                setMsg(null);
              }}
              className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-md transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-base group-hover:text-amber-600 transition-colors">
                      2. Maintenance Staff (Field Technician)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      STAFF
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    View assigned departmental work orders, update progress to In Progress / Resolved, enter technician remarks.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>

            {/* Role 3: Campus Estate Admin */}
            <button
              onClick={() => {
                setSelectedRole('ADMIN');
                setSubTab('profiles');
                setMsg(null);
              }}
              className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-purple-400 hover:shadow-md transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-base group-hover:text-purple-600 transition-colors">
                      3. Campus Facilities Administration
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                      ADMIN
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Department Bottleneck Factor analytics, SLA breach alerts, assign staff technicians, interactive SQL evaluator.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>
          </div>
        </div>
      ) : (
        /* STEP 2: PROFILE LOGIN FOR THE CHOSEN ROLE ONLY */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          {/* Header with Back Button */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedRole(null);
                setMsg(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowLeft className="w-4 h-4" /> &larr; Change Role
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Selected Role:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  selectedRole === 'ADMIN'
                    ? 'bg-purple-100 text-purple-800'
                    : selectedRole === 'STAFF'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-800'
                }`}
              >
                {selectedRole === 'REPORTER' ? 'Student / Faculty' : selectedRole === 'STAFF' ? 'Maintenance Staff' : 'Campus Admin'}
              </span>
            </div>
          </div>

          {/* Sub-Navigation */}
          <div className="flex border-b border-slate-200 p-2 gap-2 text-xs font-semibold bg-white">
            <button
              onClick={() => setSubTab('profiles')}
              className={`flex-1 py-2 px-3 rounded-xl transition ${
                subTab === 'profiles' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Select Profile ({filteredUsers.length})
            </button>
            <button
              onClick={() => setSubTab('manual')}
              className={`flex-1 py-2 px-3 rounded-xl transition ${
                subTab === 'manual' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In with Email
            </button>
            {selectedRole === 'REPORTER' && (
              <button
                onClick={() => setSubTab('register')}
                className={`flex-1 py-2 px-3 rounded-xl transition ${
                  subTab === 'register' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Register New Student
              </button>
            )}
          </div>

          <div className="p-6">
            {/* Option A: Select from Authorized Profiles of this role */}
            {subTab === 'profiles' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Click any verified {selectedRole.toLowerCase()} account to log in and immediately access your RBAC workspace:
                </p>

                {loadingUsers ? (
                  <div className="text-center py-8 text-slate-400 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-sky-500" />
                    <p className="text-xs">Loading database accounts...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    No accounts found for this role. Use &quot;Sign In with Email&quot; or &quot;Register New Student&quot;.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredUsers.map((u) => (
                      <button
                        key={u.user_id}
                        onClick={() => handleSelectUser(u)}
                        className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between group hover:border-slate-400 hover:shadow-xs ${
                          currentUser?.user_id === u.user_id
                            ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-slate-900 group-hover:text-sky-600 transition">
                              {u.full_name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">ID #{u.user_id}</span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono truncate">{u.email}</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-semibold text-sky-600 flex items-center gap-1">
                            Sign In &rarr;
                          </span>
                          {currentUser?.user_id === u.user_id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-200 text-sky-800 font-bold">
                              CURRENT
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Option B: Manual Email & Password */}
            {subTab === 'manual' && (
              <form onSubmit={handleManualLogin} className="max-w-md mx-auto space-y-4 py-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {selectedRole === 'REPORTER' ? 'Student / Faculty' : selectedRole === 'STAFF' ? 'Technician' : 'Administrator'} Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder={`e.g. name@pes.edu`}
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    <span className="text-[11px] text-slate-400">Default: password123</span>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-sky-600 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Sign In as {selectedRole}
                </button>
              </form>
            )}

            {/* Option C: Register New User */}
            {subTab === 'register' && (
              <form onSubmit={handleRegister} className="max-w-md mx-auto space-y-4 py-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Harish Kumar (Student)"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                      placeholder="e.g. harish.kumar@pes.edu"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="Create password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Register &amp; Persist to Database
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
