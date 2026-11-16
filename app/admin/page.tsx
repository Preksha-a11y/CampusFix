'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  BarChart3,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Search,
  RefreshCw,
  Building2,
  Database,
  ThumbsUp,
  Cpu,
  Layers,
  ArrowRight,
  UserCheck,
  Activity,
  FileCode2,
  ChevronRight,
  TrendingUp,
  ExternalLink
} from 'lucide-react';

interface DeptAnalytics {
  department_id: number;
  department_name: string;
  total_complaints: number;
  pending_complaints: number;
  in_progress_complaints: number;
  resolved_complaints: number;
  avg_resolution_hours: number | null;
  avg_satisfaction_rating: number | null;
  sla_compliance_rate_pct: number;
  bottleneck_factor: number;
}

interface PendingComplaint {
  complaint_id: number;
  title: string;
  department_name: string;
  priority: string;
  status: string;
  target_hours: number;
  hours_open: number;
  is_overdue: boolean;
  assigned_staff_name?: string;
  assigned_staff_email?: string;
}

interface Complaint {
  complaint_id: number;
  title: string;
  description: string;
  location_text: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
  category_name: string;
  department_name: string;
  target_hours: number;
  reporter_name: string;
  reporter_email: string;
  created_at: string;
  resolved_at?: string;
  assigned_staff_id?: number;
  assigned_staff_name?: string;
  upvote_count?: number;
  affected_users?: number[];
  upvote_locations?: string[];
}

interface StaffMember {
  user_id: number;
  full_name: string;
  email: string;
  department_id: number;
  specialization: string;
}

interface EvalQueryResult {
  query_id: string;
  title: string;
  sql: string;
  description: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

export default function AdminPortal() {
  const [currentUser, setCurrentUser] = useState<{ user_id: number; full_name: string; email: string; role_name: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'analytics' | 'overdue' | 'complaints' | 'idea1' | 'syllabus'>('analytics');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Analytics State
  const [analytics, setAnalytics] = useState<DeptAnalytics[]>([]);
  const [pendingComplaints, setPendingComplaints] = useState<PendingComplaint[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Assignment Modal State
  const [assigningComplaint, setAssigningComplaint] = useState<Complaint | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Syllabus Evaluation Queries State
  const [evalResult, setEvalResult] = useState<EvalQueryResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [selectedQueryId, setSelectedQueryId] = useState('q1');

  // 1. Fetch Analytics & Overdue Data
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.department_analytics || []);
        setPendingComplaints(data.pending_complaints || []);
      } else {
        setErrorMsg(data.error || 'Failed to load analytics');
      }
    } catch {
      setErrorMsg('Network error connecting to Supabase analytics view');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch All Complaints
  const fetchAllComplaints = useCallback(async () => {
    try {
      const res = await fetch('/api/complaints');
      const data = await res.json();
      if (data.success) {
        setComplaints(data.complaints || []);
      }
    } catch {
      // Ignored
    }
  }, []);

  // 3. Fetch Staff List
  const fetchStaffList = useCallback(async () => {
    try {
      const res = await fetch('/api/eval-queries?type=staff');
      const data = await res.json();
      if (data.success && data.staff) {
        setStaffList(data.staff);
      } else {
        // Fallback default staff
        setStaffList([
          { user_id: 4, full_name: 'Ramesh K (Electrician)', email: 'ramesh.electrician@pes.edu', department_id: 1, specialization: 'Electrical Maintenance' },
          { user_id: 5, full_name: 'Suresh Patel (Plumber)', email: 'suresh.plumber@pes.edu', department_id: 1, specialization: 'Estate & Plumbing' },
          { user_id: 6, full_name: 'Anand V (Network Admin)', email: 'anand.network@pes.edu', department_id: 2, specialization: 'IT & Network' },
          { user_id: 7, full_name: 'Mariyappa (Housekeeping Lead)', email: 'mariyappa.clean@pes.edu', department_id: 1, specialization: 'Housekeeping' }
        ]);
      }
    } catch {
      setStaffList([
        { user_id: 4, full_name: 'Ramesh K (Electrician)', email: 'ramesh.electrician@pes.edu', department_id: 1, specialization: 'Electrical Maintenance' },
        { user_id: 5, full_name: 'Suresh Patel (Plumber)', email: 'suresh.plumber@pes.edu', department_id: 1, specialization: 'Estate & Plumbing' },
        { user_id: 6, full_name: 'Anand V (Network Admin)', email: 'anand.network@pes.edu', department_id: 2, specialization: 'IT & Network' },
        { user_id: 7, full_name: 'Mariyappa (Housekeeping Lead)', email: 'mariyappa.clean@pes.edu', department_id: 1, specialization: 'Housekeeping' }
      ]);
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setAuthLoading(true);
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
    fetchAnalyticsData();
    fetchAllComplaints();
    fetchStaffList();
  }, [fetchCurrentUser, fetchAnalyticsData, fetchAllComplaints, fetchStaffList]);

  // 4. Run Syllabus Query Handler
  const handleRunEvalQuery = async (queryId: string) => {
    setSelectedQueryId(queryId);
    setEvalLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/eval-queries?query=${queryId}`);
      const data = await res.json();
      if (data.success) {
        setEvalResult(data);
      } else {
        setErrorMsg(data.error || 'Failed to execute evaluation query');
      }
    } catch {
      setErrorMsg('Network error executing query');
    } finally {
      setEvalLoading(false);
    }
  };

  // Run first query on tab open
  useEffect(() => {
    if (activeTab === 'syllabus' && !evalResult) {
      handleRunEvalQuery('q1');
    }
  }, [activeTab, evalResult]);

  // 5. Assign Complaint Handler
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningComplaint || !selectedStaffId) return;

    try {
      setAssignSubmitting(true);
      setErrorMsg('');
      const res = await fetch(`/api/complaints/${assigningComplaint.complaint_id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: Number(selectedStaffId) })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Complaint #${assigningComplaint.complaint_id} successfully assigned to staff #${selectedStaffId}!`);
        setAssigningComplaint(null);
        setSelectedStaffId('');
        await fetchAllComplaints();
        await fetchAnalyticsData();
      } else {
        setErrorMsg(data.error || 'Assignment failed');
      }
    } catch {
      setErrorMsg('Network error during assignment');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Upvoted complaints for Idea 1 Tab
  const upvotedComplaints = complaints.filter(c => (c.upvote_count ?? 0) > 0);

  // Filtered complaints for All Complaints Tab
  const filteredComplaints = complaints.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.location_text.toLowerCase().includes(q) ||
      c.department_name.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q) ||
      String(c.complaint_id).includes(q)
    );
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300"><Flame className="w-3 h-3 text-red-600" /> URGENT</span>;
      case 'HIGH':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200"><AlertTriangle className="w-3 h-3" /> HIGH</span>;
      case 'MEDIUM':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">MEDIUM</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300"><Clock className="w-3 h-3" /> SUBMITTED</span>;
      case 'ASSIGNED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200"><Users className="w-3 h-3" /> ASSIGNED</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"><Activity className="w-3 h-3" /> IN PROGRESS</span>;
      case 'RESOLVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 className="w-3 h-3" /> RESOLVED</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border border-rose-300">REJECTED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-100">{status}</span>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-slate-600 font-medium">Verifying Administrator Credentials...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Administrator Login Required</h2>
          <p className="text-sm text-slate-600 mb-6">
            Please log in with the Campus Estate Administrator profile to access this console.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-sm transition"
          >
            Go to Role Login &rarr;
          </Link>
        </div>
      </div>
    );
  }

  if (currentUser.role_name !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted (RBAC)</h2>
          <p className="text-sm text-slate-600 mb-6">
            You are currently logged in as a <strong>{currentUser.role_name === 'STAFF' ? 'Maintenance Staff' : 'Student / Reporter'}</strong> ({currentUser.full_name}). The Campus Facilities Administration Console is strictly restricted to Campus Estate Administrators.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={currentUser.role_name === 'STAFF' ? '/staff' : '/reporter'}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-sm transition text-center"
            >
              Go to My Role Workspace ({currentUser.role_name === 'STAFF' ? 'Staff Portal' : 'Student Portal'})
            </Link>
            <Link
              href="/login"
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition text-center"
            >
              Switch Role &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">Campus Facilities Administration Console</h1>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  ESTATE ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Connected to Supabase PostgreSQL 17 + pgvector &amp; Local MongoDB 8.2 Replica Sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchAnalyticsData();
                fetchAllComplaints();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium rounded-lg text-slate-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              Refresh Dashboard
            </button>
            <Link
              href="/"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition shadow-xs"
            >
              Switch Role
            </Link>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Alerts */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 font-bold ml-2">x</button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2">x</button>
          </div>
        )}

        {/* Global Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Department Analytics &amp; Bottleneck Factor
          </button>

          <button
            onClick={() => setActiveTab('overdue')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'overdue'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            SLA Breach Monitor ({pendingComplaints.filter(p => p.is_overdue).length})
          </button>

          <button
            onClick={() => setActiveTab('idea1')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'idea1'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
            Idea 1: Upvoted &amp; Merged Incidents ({upvotedComplaints.length})
          </button>

          <button
            onClick={() => setActiveTab('complaints')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'complaints'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            All Complaints ({complaints.length})
          </button>

          <button
            onClick={() => setActiveTab('syllabus')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'syllabus'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            Syllabus SQL Query Console
          </button>
        </div>

        {/* TAB 1: DEPARTMENT ANALYTICS & BOTTLENECK FACTOR */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Bottleneck Factor Explanation Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-lg">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
                    <TrendingUp className="w-4 h-4" />
                    DBMS Originality Metric: Department Bottleneck Factor (BF)
                  </div>
                  <h3 className="text-lg font-bold text-white">How Department Bottleneck Factor Is Calculated</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                    Formula: <span className="font-mono text-amber-300">BF_d = 1.0 + ((Pending / Active_Techs) &times; 0.2) + max(0, (Avg_Hours - Target_Hours) / Target_Hours)</span>.
                    Calculated in real-time from PostgreSQL view <code className="text-indigo-300">view_department_analytics</code> and stored function <code className="text-indigo-300">fn_calculate_avg_resolution_hours()</code>.
                  </p>
                </div>
                <div className="bg-indigo-950/80 p-3 rounded-xl border border-indigo-700/50 text-right shrink-0">
                  <span className="text-xs text-indigo-300 block">Baseline Ideal:</span>
                  <span className="text-lg font-mono font-bold text-emerald-400">1.00x</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">&gt;1.5x = Needs Intervention</span>
                </div>
              </div>
            </div>

            {/* Department Analytics Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {analytics.map((dept) => {
                const isBottleneck = dept.bottleneck_factor > 1.3;
                return (
                  <div
                    key={dept.department_id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs transition hover:shadow-md ${
                      isBottleneck ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Dept #{dept.department_id}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-0.5">{dept.department_name}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block font-medium">Bottleneck Factor</span>
                        <span
                          className={`text-base font-mono font-black ${
                            dept.bottleneck_factor > 1.5
                              ? 'text-red-600'
                              : dept.bottleneck_factor > 1.2
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {dept.bottleneck_factor.toFixed(2)}x
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 py-3 border-y border-slate-100 text-center my-3">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Total</span>
                        <span className="text-sm font-bold text-slate-800">{dept.total_complaints}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Pending</span>
                        <span className="text-sm font-bold text-amber-600">{dept.pending_complaints}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Active</span>
                        <span className="text-sm font-bold text-blue-600">{dept.in_progress_complaints}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Resolved</span>
                        <span className="text-sm font-bold text-emerald-600">{dept.resolved_complaints}</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">SLA Compliance Rate:</span>
                        <span className="font-bold text-slate-800">{Number(dept.sla_compliance_rate_pct).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Avg Resolution Time:</span>
                        <span className="font-bold text-slate-800">
                          {dept.avg_resolution_hours ? `${Number(dept.avg_resolution_hours).toFixed(1)} hrs` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Student Satisfaction:</span>
                        <span className="font-bold text-amber-600">
                          {dept.avg_satisfaction_rating ? `${Number(dept.avg_satisfaction_rating).toFixed(1)} / 5.0 ★` : 'No ratings yet'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: OVERDUE SLA BREACH MONITOR */}
        {activeTab === 'overdue' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Live SLA Breach &amp; Overdue Monitor
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Active complaints exceeding their department category target SLA resolution hours (sourced from <code className="text-blue-600">view_pending_complaints</code>).
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                {pendingComplaints.filter(p => p.is_overdue).length} Breached Tickets
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">SLA Target</th>
                    <th className="py-3 px-4">Hours Open</th>
                    <th className="py-3 px-4">Assigned Staff</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingComplaints.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                        No pending complaints found.
                      </td>
                    </tr>
                  ) : (
                    pendingComplaints.map((p) => (
                      <tr key={p.complaint_id} className={`hover:bg-slate-50 ${p.is_overdue ? 'bg-red-50/40' : ''}`}>
                        <td className="py-3 px-4 font-mono font-bold text-xs text-slate-700">#{p.complaint_id}</td>
                        <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">{p.title}</td>
                        <td className="py-3 px-4 text-xs text-slate-600">{p.department_name}</td>
                        <td className="py-3 px-4">{getPriorityBadge(p.priority)}</td>
                        <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600">{p.target_hours}h</td>
                        <td className="py-3 px-4 text-xs font-mono">
                          <span className={p.is_overdue ? 'text-red-600 font-bold' : 'text-slate-700'}>
                            {Number(p.hours_open).toFixed(1)}h {p.is_overdue && '(BREACHED)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {p.assigned_staff_name ? (
                            <span className="text-slate-800 font-medium">{p.assigned_staff_name}</span>
                          ) : (
                            <span className="text-amber-600 font-bold italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              const pAny = p as any;
                              const found = complaints.find(c => Number(c.complaint_id) === Number(p.complaint_id)) || {
                                complaint_id: Number(p.complaint_id),
                                title: p.title,
                                description: pAny.description || '',
                                location_text: pAny.location_text || '',
                                priority: p.priority as any,
                                status: p.status as any,
                                category_name: pAny.category_name || '',
                                department_name: p.department_name || '',
                                target_hours: p.target_hours || 8,
                                reporter_name: pAny.reporter_name || '',
                                reporter_email: pAny.reporter_email || '',
                                created_at: pAny.created_at || '',
                                assigned_staff_id: pAny.assigned_staff_id,
                                assigned_staff_name: p.assigned_staff_name
                              };
                              setAssigningComplaint(found as any);
                              setSelectedStaffId(found.assigned_staff_id ? Number(found.assigned_staff_id) : '');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition"
                          >
                            Assign Staff
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: IDEA 1 - COMMUNITY INCIDENTS & DUPLICATE UPVOTE RADAR */}
        {activeTab === 'idea1' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <ThumbsUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Idea 1: Intelligent Duplicate Incident Upvoting &amp; Merge Monitor</h3>
                  <p className="text-xs text-slate-300">
                    Live synchronization between <strong>Supabase pgvector</strong> and <strong>Local MongoDB 8.2</strong>.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-4xl">
                When students enter a complaint, real-time cosine similarity search (<code className="text-blue-300">&lt;=&gt;</code>) runs in PostgreSQL via pgvector.
                If a duplicate match is flagged, users can click <em>&ldquo;I&apos;m Facing This Too&rdquo;</em>.
                Instead of dirtying the relational DB with duplicate ticket rows, MongoDB executes an atomic <code className="text-blue-300">$inc: &#123; &quot;metadata.upvote_count&quot;: 1 &#125;</code> and appends the student ID into <code className="text-blue-300">affected_users</code>.
                When upvotes &ge; 3, PostgreSQL automatically escalates priority to <strong>HIGH / URGENT</strong>.
              </p>
            </div>

            {upvotedComplaints.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <ThumbsUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-700">No Upvoted Incidents Yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Try filing a complaint on the <Link href="/reporter" className="text-blue-600 underline font-semibold">Student Portal</Link> with similar keywords (e.g. &ldquo;tap leak&rdquo; or &ldquo;wifi down&rdquo;) and click &ldquo;I&apos;m Facing This Too&rdquo; on the duplicate radar!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {upvotedComplaints.map((c) => (
                  <div key={c.complaint_id} className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-xs">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                            Ticket #{c.complaint_id}
                          </span>
                          {getPriorityBadge(c.priority)}
                          {getStatusBadge(c.status)}
                        </div>
                        <h4 className="text-base font-bold text-slate-900">{c.title}</h4>
                      </div>
                      <div className="text-right bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl shrink-0">
                        <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {c.upvote_count} Upvotes
                        </span>
                        <span className="text-[10px] text-indigo-500 font-medium">Idea 1 Merged</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mb-4 line-clamp-2">{c.description}</p>

                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-1.5 text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Department:</span>
                        <span className="font-semibold text-slate-800">{c.department_name} ({c.category_name})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Assigned Technician:</span>
                        <span className="font-semibold text-slate-800">{c.assigned_staff_name || 'Unassigned'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">MongoDB Affected Users:</span>
                        <span className="font-mono font-semibold text-indigo-700">
                          {c.affected_users && c.affected_users.length > 0 ? `[User IDs: ${c.affected_users.join(', ')}]` : 'None'}
                        </span>
                      </div>
                      {c.upvote_locations && c.upvote_locations.length > 0 && (
                        <div>
                          <span className="text-slate-400 block">Reported Locations:</span>
                          <span className="font-medium text-slate-700">{c.upvote_locations.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-indigo-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">Idea 1 Action</span>
                      <button
                        onClick={() => {
                          setAssigningComplaint(c);
                          setSelectedStaffId(c.assigned_staff_id ? Number(c.assigned_staff_id) : '');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition flex items-center gap-1.5 shadow-sm"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {c.assigned_staff_name ? 'Reassign Staff' : 'Assign Staff'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ALL COMPLAINTS TABLE */}
        {activeTab === 'complaints' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">All Registered Campus Complaints</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete repository of tickets across all academic, hostel, and utility departments.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search tickets, dept, status..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reporter</th>
                    <th className="py-3 px-4">Assigned Staff</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredComplaints.map((c) => (
                    <tr key={c.complaint_id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-xs text-slate-700">#{c.complaint_id}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">{c.title}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{c.department_name}</td>
                      <td className="py-3 px-4">{getPriorityBadge(c.priority)}</td>
                      <td className="py-3 px-4">{getStatusBadge(c.status)}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{c.reporter_name}</td>
                      <td className="py-3 px-4 text-xs">
                        {c.assigned_staff_name ? (
                          <span className="text-slate-800 font-medium">{c.assigned_staff_name}</span>
                        ) : (
                          <span className="text-amber-600 font-bold italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setAssigningComplaint(c);
                            setSelectedStaffId(c.assigned_staff_id ? Number(c.assigned_staff_id) : '');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition"
                        >
                          {c.assigned_staff_name ? 'Reassign' : 'Assign'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: SYLLABUS SQL QUERY CONSOLE */}
        {activeTab === 'syllabus' && (
          <div className="space-y-6">
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Interactive Syllabus Query Demonstration Engine</h3>
                  <p className="text-xs text-slate-300">
                    Direct execution of the mandatory syllabus SQL patterns against Supabase PostgreSQL 17.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Demonstrates 5-table JOIN, correlated subquery with outer reference, aggregation with GROUP BY &amp; HAVING, and analytical Window Function CTE with RANK().
              </p>
            </div>

            {/* Query Selector Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'q1', label: '1. 5-Table JOIN', desc: 'Complaint + Reporter + Category + Dept + Staff' },
                { id: 'q2', label: '2. Correlated Subquery', desc: 'Tickets exceeding Department Avg Resolution Time' },
                { id: 'q3', label: '3. GROUP BY & HAVING', desc: 'Departments with high incident volume' },
                { id: 'q4', label: '4. CTE & Window RANK()', desc: 'Rank departments by complaint workload' }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => handleRunEvalQuery(btn.id)}
                  className={`p-4 rounded-2xl border text-left transition ${
                    selectedQueryId === btn.id
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">{btn.label}</span>
                  <span className="text-[11px] text-slate-500 mt-1 block">{btn.desc}</span>
                </button>
              ))}
            </div>

            {/* Query Execution Display */}
            {evalLoading ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
                <p className="text-slate-600 font-medium text-sm">Executing SQL on Supabase PostgreSQL...</p>
              </div>
            ) : evalResult ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-6 border-b border-slate-200 bg-slate-50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">{evalResult.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{evalResult.description}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Rows: <strong className="text-slate-800">{evalResult.rowCount}</strong></span>
                      <span>Execution: <strong className="text-emerald-600">{evalResult.executionTimeMs} ms</strong></span>
                    </div>
                  </div>

                  {/* Raw SQL Box */}
                  <div className="mt-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Executed SQL Query
                    </span>
                    <pre className="p-3 bg-slate-900 text-emerald-400 text-xs rounded-xl font-mono overflow-x-auto">
                      {evalResult.sql}
                    </pre>
                  </div>
                </div>

                {/* Query Result Table */}
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider sticky top-0">
                      <tr>
                        {evalResult.columns.map((col) => (
                          <th key={col} className="py-2.5 px-4 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {evalResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          {evalResult.columns.map((col) => (
                            <td key={col} className="py-2.5 px-4 whitespace-nowrap text-slate-700 font-mono">
                              {row[col] !== null && row[col] !== undefined ? String(row[col]) : 'NULL'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ASSIGNMENT MODAL (calls sp_assign_complaint) */}
      {assigningComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Assign Staff Technician (Stored Procedure sp_assign_complaint)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Select maintenance personnel to resolve Ticket #{assigningComplaint.complaint_id} ({assigningComplaint.title}).
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Available Staff Member <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
                >
                  <option value="">-- Choose Technician --</option>
                  {staffList.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.full_name} ({s.specialization}) - {s.email}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Automatically updates complaint status to ASSIGNED and logs an assignment record in PostgreSQL.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningComplaint(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting || !selectedStaffId}
                  className="px-6 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold shadow-md shadow-indigo-500/20 transition flex items-center gap-2"
                >
                  {assignSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  Dispatch Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
