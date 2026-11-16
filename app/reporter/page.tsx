'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  ThumbsUp, 
  Send, 
  PlusCircle, 
  Clock, 
  CheckCircle, 
  Star, 
  Search, 
  RefreshCw,
  Sparkles,
  MapPin,
  Building2,
  X,
  FileText,
  UserCheck,
  LogIn
} from 'lucide-react';

interface Category {
  category_id: number;
  category_name: string;
  target_hours: number;
  department_name: string;
}

interface Complaint {
  complaint_id: number;
  title: string;
  description: string;
  location_text: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  category_name: string;
  target_hours: number;
  department_name: string;
  reporter_id?: number;
  reporter_name?: string;
  reporter_email?: string;
  staff_name: string | null;
  feedback_rating: number | null;
  feedback_comment: string | null;
  upvote_count?: number;
}

interface DuplicateMatch {
  complaint_id: number;
  title: string;
  description: string;
  location: string;
  status: string;
  priority: string;
  category_name: string;
  department_name: string;
  similarity_pct: number;
  upvote_count: number;
}

export default function ReporterPage() {
  const [user, setUser] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'my'>('all');

  // New complaint form state
  const [showModal, setShowModal] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  // Duplicate detection radar state (Idea 1)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [upvotingId, setUpvotingId] = useState<number | null>(null);

  // Feedback modal
  const [feedbackComplaint, setFeedbackComplaint] = useState<Complaint | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Details drawer
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    setLoading(true);
    try {
      // 1. Get user session
      const authRes = await fetch('/api/auth/me');
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.authenticated && authData.user) {
          setUser(authData.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }

      // 2. Fetch categories
      const catRes = await fetch('/api/categories');
      const catData = await catRes.json();
      setCategories(catData.categories || []);

      // 3. Fetch complaints
      loadComplaints();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadComplaints = async () => {
    try {
      const res = await fetch('/api/complaints');
      const data = await res.json();
      setComplaints(data.complaints || []);
    } catch (err) {
      console.error('Error loading complaints:', err);
    }
  };

  // Debounced duplicate radar using pgvector
  useEffect(() => {
    if (!title || title.trim().length < 4) {
      setDuplicateMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicates(true);
      try {
        const res = await fetch('/api/complaints/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, location_text: locationText }),
        });
        const data = await res.json();
        setDuplicateMatches(data.duplicates || []);
      } catch (err) {
        console.error('Duplicate radar error:', err);
      } finally {
        setCheckingDuplicates(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, description, locationText]);

  // Handle Idea 1: Upvote & Merge existing issue
  const handleUpvote = async (match: DuplicateMatch) => {
    setUpvotingId(match.complaint_id);
    try {
      const res = await fetch(`/api/complaints/${match.complaint_id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: locationText || 'Mess / Hostel area' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upvote');

      setFormMsg(`Incident merged! You upvoted Complaint #${match.complaint_id} (Total Community Upvotes: ${data.upvote_count}). A redundant ticket was prevented.`);
      setTimeout(() => {
        setShowModal(false);
        resetForm();
        loadComplaints();
      }, 2000);
    } catch (err: any) {
      setFormMsg(`Error: ${err.message}`);
    } finally {
      setUpvotingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !title || !locationText) return;

    setSubmitting(true);
    setFormMsg('');
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: Number(categoryId),
          title,
          description,
          location_text: locationText,
          priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create complaint');

      setFormMsg(`Complaint #${data.complaint_id} registered and synchronized in PostgreSQL & MongoDB!`);
      setTimeout(() => {
        setShowModal(false);
        resetForm();
        loadComplaints();
      }, 1500);
    } catch (err: any) {
      setFormMsg(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocationText('');
    setCategoryId('');
    setPriority('MEDIUM');
    setDuplicateMatches([]);
    setFormMsg('');
  };

  const openDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/complaints/${id}`);
      const data = await res.json();
      setSelectedComplaint(data.complaint);
      setHistory(data.history || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackComplaint) return;
    try {
      const res = await fetch(`/api/complaints/${feedbackComplaint.complaint_id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      if (res.ok) {
        setFeedbackComplaint(null);
        setComment('');
        loadComplaints();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Student &amp; Faculty Reporter Portal</h1>
            {user ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                Active: {user.role_name}
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                Not Signed In
              </span>
            )}
          </div>
          {user ? (
            <p className="text-slate-500 text-sm mt-1">
              Logged in as <strong className="text-slate-800">{user.full_name}</strong> ({user.email})
            </p>
          ) : (
            <p className="text-slate-500 text-sm mt-1">
              You are currently viewing as guest. Please sign in to submit complaints or upvote tickets.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-600" />
            <span>{user ? 'Switch User / Profile' : 'Sign In'}</span>
          </Link>
          <button
            onClick={loadComplaints}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Complaints"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (!user) {
                window.location.href = '/login';
                return;
              }
              setShowModal(true);
              resetForm();
            }}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" /> File New Complaint
          </button>
        </div>
      </div>

      {/* Tab Filter */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Campus Complaints ({complaints.length})
        </button>
        {user && (
          <button
            onClick={() => setFilterTab('my')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterTab === 'my'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            My Reported Issues ({complaints.filter((c) => c.reporter_id === user.user_id).length})
          </button>
        )}
      </div>

      {/* Complaints List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {filterTab === 'my' ? 'My Reported Complaints' : 'All Campus Complaints & Live Status'}
            </h2>
            <p className="text-xs text-slate-500">Live synchronized with Supabase PostgreSQL and MongoDB</p>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Showing:{' '}
            {filterTab === 'my' && user
              ? complaints.filter((c) => c.reporter_id === user.user_id).length
              : complaints.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Title &amp; Category</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Community Upvotes</th>
                <th className="py-3.5 px-4">Technician</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(filterTab === 'my' && user
                ? complaints.filter((c) => c.reporter_id === user.user_id)
                : complaints
              ).map((c) => (
                <tr key={c.complaint_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-700">#{c.complaint_id}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900 line-clamp-1">{c.title}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{c.category_name}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.location_text}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-700">{c.department_name}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                      c.priority === 'URGENT' ? 'bg-rose-100 text-rose-800' :
                      c.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                      c.priority === 'MEDIUM' ? 'bg-sky-100 text-sky-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {c.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      c.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' :
                      c.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                      c.status === 'ASSIGNED' ? 'bg-indigo-100 text-indigo-800' :
                      c.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                      <ThumbsUp className="w-3 h-3 text-sky-600" /> {c.upvote_count || 1}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">
                    {c.staff_name || <span className="text-slate-400 italic">Unassigned</span>}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => openDetails(c.complaint_id)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      Details
                    </button>
                    {c.status === 'RESOLVED' && (
                      <button
                        onClick={() => {
                          setFeedbackComplaint(c);
                          setRating(c.feedback_rating || 5);
                          setComment(c.feedback_comment || '');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                      >
                        {c.feedback_rating ? `Rated ${c.feedback_rating}★` : 'Give Feedback'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Complaint Modal with IDEA 1 Duplicate Radar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> pgvector Semantic Radar Enabled
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Submit Campus Complaint</h2>
              <p className="text-xs text-slate-500">Real-time duplicate detection will alert you if your issue is already registered</p>
            </div>

            {formMsg && (
              <div className={`p-4 rounded-xl text-sm font-medium ${formMsg.includes('Error') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                {formMsg}
              </div>
            )}

            {user ? (
              <div className="p-3 bg-sky-50 rounded-xl text-xs text-sky-800 border border-sky-200 flex items-center justify-between">
                <span>
                  Filing complaint as: <strong>{user.full_name}</strong> ({user.email})
                </span>
                <Link href="/login" className="text-sky-600 underline font-semibold">
                  Switch Account
                </Link>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200 flex items-center justify-between">
                <span>You must be signed in to submit a complaint.</span>
                <Link href="/login" className="px-2.5 py-1 rounded bg-amber-600 text-white font-semibold">
                  Sign In Now
                </Link>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Category & SLA</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="">Select an Issue Category</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name} ({cat.department_name} - Target: {cat.target_hours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Complaint Title</label>
                <input
                  type="text"
                  placeholder="e.g. Water leaking from washroom pipe"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              {/* Duplicate Detection Alert Banner (Idea 1) */}
              {checkingDuplicates && (
                <div className="text-xs text-sky-600 flex items-center gap-2 py-1">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" /> Scanning campus knowledge base for similar tickets...
                </div>
              )}

              {duplicateMatches.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Similar Active Issue Already Reported!
                  </div>
                  <p className="text-xs text-amber-800">
                    Instead of creating a duplicate work order, you can upvote the existing ticket. This increases its community urgency in MongoDB and notifies technicians immediately:
                  </p>

                  <div className="space-y-2">
                    {duplicateMatches.map((m) => (
                      <div key={m.complaint_id} className="p-3 bg-white rounded-lg border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <span>#{m.complaint_id}: {m.title}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                              {m.similarity_pct}% Match
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            Location: {m.location} | Status: <span className="font-semibold text-slate-700">{m.status}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUpvote(m)}
                          disabled={upvotingId === m.complaint_id}
                          className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {upvotingId === m.complaint_id ? 'Upvoting...' : `I'm Facing This Too (${m.upvote_count})`}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  rows={3}
                  placeholder="Provide details about the issue..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Campus Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Hostel Block B, Floor 3"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Urgency Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-sky-600 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                >
                  <Send className="w-4 h-4" /> {submitting ? 'Registering...' : 'Submit Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Details Drawer */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedComplaint(null)}
              className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-mono font-bold text-slate-400">COMPLAINT #{selectedComplaint.complaint_id}</span>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedComplaint.title}</h2>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span>{selectedComplaint.category_name}</span>
                <span>•</span>
                <span>{selectedComplaint.department_name}</span>
                <span>•</span>
                <span>SLA: {selectedComplaint.target_hours}h</span>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="text-xs font-bold uppercase text-slate-500">Full Description</label>
                <p className="text-slate-800 bg-slate-50 p-3 rounded-xl mt-1">{selectedComplaint.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">Location</label>
                  <p className="text-slate-800 font-medium">{selectedComplaint.location_text}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">Assigned Technician</label>
                  <p className="text-slate-800 font-medium">{selectedComplaint.staff_name || 'Unassigned'}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Status History (Audit Trail)</label>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  {history.map((h) => (
                    <div key={h.history_id} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">{h.old_status} ➔ {h.new_status}</span>
                        <div className="text-slate-500 mt-0.5">{h.remarks}</div>
                      </div>
                      <div className="text-right text-slate-400">
                        <div>{h.changed_by}</div>
                        <div>{new Date(h.changed_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setFeedbackComplaint(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900">Resolution Feedback</h3>
            <p className="text-xs text-slate-500">Rate your resolution experience for #{feedbackComplaint.complaint_id}: {feedbackComplaint.title}</p>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-2">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className={`p-2 rounded-xl transition-all ${rating >= star ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                  <span className="text-sm font-bold text-slate-700 ml-2">{rating} / 5 Stars</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Comment</label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was the resolution turnaround and technician work?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFeedbackComplaint(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
