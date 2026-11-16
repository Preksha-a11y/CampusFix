'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  RefreshCw,
  MapPin,
  FileText,
  User,
  History,
  XCircle,
  PlayCircle,
  ThumbsUp,
  MessageSquare,
  ShieldCheck,
  Building2,
  Calendar
} from 'lucide-react';

interface StaffUser {
  user_id: number;
  full_name: string;
  email: string;
  role?: string;
  role_name?: 'REPORTER' | 'STAFF' | 'ADMIN';
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
  hours_open?: number;
  is_overdue?: boolean;
  assigned_staff_id?: number;
  assigned_staff_name?: string;
  assigned_at?: string;
  upvote_count?: number;
  affected_users?: number[];
  upvote_locations?: string[];
  feedback_rating?: number;
  feedback_comment?: string;
}

interface StatusHistoryItem {
  history_id: number;
  old_status: string;
  new_status: string;
  changed_at: string;
  remarks: string;
  changed_by_name: string;
}

export default function StaffPortal() {
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filterTab, setFilterTab] = useState<'assigned' | 'all' | 'in_progress' | 'resolved'>('assigned');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected complaint for modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Status update form state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<'IN_PROGRESS' | 'RESOLVED' | 'REJECTED'>('IN_PROGRESS');
  const [technicianRemarks, setTechnicianRemarks] = useState('');

  // 1. Fetch current logged-in user
  const fetchCurrentUser = async () => {
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
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Quick switch / login handler for staff demo
  const handleQuickLogin = async (email: string) => {
    try {
      setAuthLoading(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setSuccessMsg(`Switched profile to ${data.user.full_name}`);
      } else {
        setErrorMsg(data.error || 'Failed to switch profile');
      }
    } catch {
      setErrorMsg('Login network error');
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. Fetch Complaints
  const fetchComplaints = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/complaints');
      const data = await res.json();
      if (data.success) {
        setComplaints(data.complaints || []);
      } else {
        setErrorMsg(data.error || 'Failed to fetch complaints');
      }
    } catch {
      setErrorMsg('Network error fetching work orders');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchComplaints();
    }
  }, [currentUser, fetchComplaints]);

  // 3. Fetch complaint details and history
  const openComplaintModal = async (c: Complaint) => {
    setSelectedComplaint(c);
    setNewStatus(c.status === 'ASSIGNED' ? 'IN_PROGRESS' : c.status === 'IN_PROGRESS' ? 'RESOLVED' : 'IN_PROGRESS');
    setTechnicianRemarks('');
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/complaints/${c.complaint_id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedComplaint(data.complaint);
        setStatusHistory(data.history || []);
      }
    } catch {
      // Keep selectedComplaint as is
    } finally {
      setHistoryLoading(false);
    }
  };

  // 4. Update Complaint Status (triggers Postgres trigger + Mongo document sync)
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (!technicianRemarks.trim()) {
      setErrorMsg('Please enter technician remarks explaining the action taken.');
      return;
    }

    try {
      setUpdatingStatus(true);
      setErrorMsg('');
      const res = await fetch(`/api/complaints/${selectedComplaint.complaint_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          remarks: technicianRemarks.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Complaint #${selectedComplaint.complaint_id} updated to ${newStatus}!`);
        setSelectedComplaint(null);
        await fetchComplaints();
      } else {
        setErrorMsg(data.error || 'Failed to update complaint status');
      }
    } catch {
      setErrorMsg('Network error while updating status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter(c => {
    const isAssignedToMe = Number(c.assigned_staff_id) === Number(currentUser?.user_id);
    if (filterTab === 'assigned') {
      return isAssignedToMe;
    }
    if (filterTab === 'in_progress') {
      return c.status === 'IN_PROGRESS' && (isAssignedToMe || currentUser?.role === 'ADMIN');
    }
    if (filterTab === 'resolved') {
      return (c.status === 'RESOLVED' || c.status === 'REJECTED') && (isAssignedToMe || currentUser?.role === 'ADMIN');
    }
    return true; // 'all'
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse"><Flame className="w-3 h-3" /> URGENT</span>;
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
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200"><User className="w-3 h-3" /> ASSIGNED</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"><PlayCircle className="w-3 h-3" /> IN PROGRESS</span>;
      case 'RESOLVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 className="w-3 h-3" /> RESOLVED</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border border-rose-300"><XCircle className="w-3 h-3" /> REJECTED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-100">{status}</span>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium">Verifying Staff Credentials...</p>
        </div>
      </div>
    );
  }

  const role = currentUser?.role_name || currentUser?.role;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
            <Wrench className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Staff Login Required</h2>
          <p className="text-sm text-slate-600 mb-6">
            Please log in with a Maintenance Staff or Administrator profile to view and update work orders.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium text-sm transition"
          >
            Go to Role Login &rarr;
          </Link>
        </div>
      </div>
    );
  }

  if (role === 'REPORTER') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted (RBAC)</h2>
          <p className="text-sm text-slate-600 mb-6">
            You are currently logged in as a <strong>Reporter / Student</strong> ({currentUser.full_name}). The Technician Work Orders Portal is restricted to Maintenance Staff and Estate Admins.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/reporter"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition text-center"
            >
              Go to Student / Reporter Portal
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
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Banner / User Switcher */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">Maintenance Technician Portal</h1>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  STAFF WORKSPACE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Active Worker: <span className="text-slate-200 font-semibold">{currentUser?.full_name || 'Not signed in'}</span> ({currentUser?.email})
              </p>
            </div>
          </div>

          {/* Quick Staff Persona Switcher */}
          <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400 px-2 font-medium">Switch Staff:</span>
            <button
              onClick={() => handleQuickLogin('suresh.plumber@pes.edu')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                currentUser?.email === 'suresh.plumber@pes.edu'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              Suresh (Plumber)
            </button>
            <button
              onClick={() => handleQuickLogin('anand.network@pes.edu')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                currentUser?.email === 'anand.network@pes.edu'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              Anand (Network)
            </button>
            <Link
              href="/login"
              className="px-2.5 py-1.5 rounded-md text-sky-400 hover:text-sky-300 hover:bg-slate-700 transition font-medium"
            >
              All Profiles &rarr;
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

        {/* Action Header & Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-xs border border-slate-200">
            <button
              onClick={() => setFilterTab('assigned')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filterTab === 'assigned'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Assigned to Me ({complaints.filter(c => Number(c.assigned_staff_id) === Number(currentUser?.user_id)).length})
            </button>
            <button
              onClick={() => setFilterTab('in_progress')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filterTab === 'in_progress'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setFilterTab('resolved')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filterTab === 'resolved'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Resolved History
            </button>
            <button
              onClick={() => setFilterTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filterTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              All Campus Orders ({complaints.length})
            </button>
          </div>

          <button
            onClick={fetchComplaints}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-xs transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Refresh Feed
          </button>
        </div>

        {/* Work Orders List */}
        {loading && complaints.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Loading Assigned Work Orders from Cloud PostgreSQL...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Complaints in this view</h3>
            <p className="text-sm text-slate-500 mt-1">
              {filterTab === 'assigned'
                ? "You currently have no active work orders assigned. Check 'All Campus Orders' or request an assignment from the Administrator."
                : "No matching complaints found."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredComplaints.map((c) => {
              const isAssignedToMe = Number(c.assigned_staff_id) === Number(currentUser?.user_id);
              return (
                <div
                  key={c.complaint_id}
                  className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md p-6 ${
                    c.priority === 'URGENT'
                      ? 'border-red-300 ring-1 ring-red-100'
                      : isAssignedToMe
                      ? 'border-blue-200 bg-gradient-to-r from-blue-50/20 to-white'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Main Ticket Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          #{c.complaint_id}
                        </span>
                        {getPriorityBadge(c.priority)}
                        {getStatusBadge(c.status)}

                        {/* Idea 1: Upvote community signal badge */}
                        {(c.upvote_count ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <ThumbsUp className="w-3 h-3 text-indigo-600" />
                            {c.upvote_count} students affected (Idea 1 Merged)
                          </span>
                        )}

                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {c.department_name} &bull; {c.category_name}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{c.title}</h3>
                      <p className="text-sm text-slate-600 line-clamp-2">{c.description}</p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {c.location_text}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Reported by: <strong className="text-slate-700">{c.reporter_name}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          SLA Target: <strong>{c.target_hours} hrs</strong>
                        </span>
                      </div>
                    </div>

                    {/* Action Column */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="text-right hidden sm:block">
                        <span className="text-xs text-slate-400 block">Assigned Technician:</span>
                        <span className="text-xs font-bold text-slate-800">
                          {c.assigned_staff_name ? (
                            isAssignedToMe ? (
                              <span className="text-blue-600 font-bold">You ({c.assigned_staff_name})</span>
                            ) : (
                              c.assigned_staff_name
                            )
                          ) : (
                            <span className="text-amber-600 italic">Unassigned</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openComplaintModal(c)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-xs ${
                            isAssignedToMe && c.status !== 'RESOLVED' && c.status !== 'REJECTED'
                              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <Wrench className="w-4 h-4" />
                          {isAssignedToMe && c.status !== 'RESOLVED' && c.status !== 'REJECTED'
                            ? 'Update Status'
                            : 'View Details'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPLAINT MODAL & STATUS UPDATE DRAWER */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Complaint #{selectedComplaint.complaint_id}
                  </span>
                  {getPriorityBadge(selectedComplaint.priority)}
                  {getStatusBadge(selectedComplaint.status)}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedComplaint.title}</h2>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto py-4 space-y-6 flex-1 pr-1">
              {/* Core Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Department</span>
                  <span className="font-semibold text-slate-800">{selectedComplaint.department_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Category</span>
                  <span className="font-semibold text-slate-800">{selectedComplaint.category_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Location</span>
                  <span className="font-semibold text-slate-800">{selectedComplaint.location_text}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Reporter</span>
                  <span className="font-semibold text-slate-800">{selectedComplaint.reporter_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">SLA Target</span>
                  <span className="font-semibold text-slate-800">{selectedComplaint.target_hours} Hours</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Reported At</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedComplaint.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Full Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Description
                </h4>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 leading-relaxed">
                  {selectedComplaint.description}
                </div>
              </div>

              {/* Idea 1: Upvoted / Merged Community Incident Info */}
              {(selectedComplaint.upvote_count ?? 0) > 0 && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200">
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                      Idea 1: Intelligent Duplicate Incident Merging
                    </h4>
                  </div>
                  <p className="text-xs text-indigo-800">
                    <strong>{selectedComplaint.upvote_count} other campus members</strong> clicked &ldquo;I&apos;m Facing This Too&rdquo;.
                    Rather than creating clutter in the database, their reports were merged here via MongoDB atomic updates.
                  </p>
                  {selectedComplaint.upvote_locations && selectedComplaint.upvote_locations.length > 0 && (
                    <div className="mt-2 text-xs text-indigo-700">
                      <strong>Reported affected locations:</strong> {selectedComplaint.upvote_locations.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* User Feedback (if submitted) */}
              {selectedComplaint.feedback_rating && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block mb-1">
                    Student / Reporter Feedback:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 font-bold">
                      {'★'.repeat(selectedComplaint.feedback_rating)}{'☆'.repeat(5 - selectedComplaint.feedback_rating)}
                    </span>
                    <span className="text-xs font-semibold text-amber-800">
                      ({selectedComplaint.feedback_rating} / 5 stars)
                    </span>
                  </div>
                  {selectedComplaint.feedback_comment && (
                    <p className="text-xs text-amber-800 mt-1 italic">&ldquo;{selectedComplaint.feedback_comment}&rdquo;</p>
                  )}
                </div>
              )}

              {/* Status Audit Trail */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  PostgreSQL Audit Trail (trg_complaint_status_audit)
                </h4>
                {historyLoading ? (
                  <p className="text-xs text-slate-400">Loading audit trail...</p>
                ) : statusHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No previous status transitions recorded.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {statusHistory.map((h) => (
                      <div key={h.history_id} className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center justify-between text-slate-500 mb-0.5">
                          <span className="font-semibold text-slate-700">
                            {h.old_status} &rarr; <span className="text-blue-600">{h.new_status}</span>
                          </span>
                          <span>{new Date(h.changed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                        <p className="text-slate-600">{h.remarks || 'No remarks recorded'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Update Form (Active for Staff) */}
              <form onSubmit={handleStatusSubmit} className="pt-4 border-t border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  Update Work Order Progress
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewStatus('IN_PROGRESS')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                      newStatus === 'IN_PROGRESS'
                        ? 'border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-amber-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <PlayCircle className="w-4 h-4 text-amber-600" />
                    IN PROGRESS
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStatus('RESOLVED')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                      newStatus === 'RESOLVED'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    MARK RESOLVED
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStatus('REJECTED')}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                      newStatus === 'REJECTED'
                        ? 'border-rose-400 bg-rose-50 text-rose-800 ring-2 ring-rose-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    REJECT / DUPLICATE
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Technician Remarks / Action Taken <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={technicianRemarks}
                    onChange={(e) => setTechnicianRemarks(e.target.value)}
                    placeholder="e.g. Replaced faulty washer and tightened main tap valve. Tested for 10 minutes with zero leakage."
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800"
                  />
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Remarks are recorded into PostgreSQL `status_history` audit table & synced live to MongoDB `complaint_documents`.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedComplaint(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingStatus}
                    className="px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold shadow-md shadow-blue-500/20 transition flex items-center gap-2"
                  >
                    {updatingStatus ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Confirm Status Change
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
