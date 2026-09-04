import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { SeverityBadge, DockStatusDot } from '../../components/Shared';
import { Bell, Megaphone, Send, Clock, MapPin, Coffee, Sun, Moon, CheckCircle2 } from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(dateStr) {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [docks, setDocks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastDuration, setBroadcastDuration] = useState(30);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    Promise.all([
      api.getIssues({ status: 'active' }),
      api.getDocks(),
      api.getRequests('pending'),
    ]).then(([iss, dk, req]) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      iss.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
      setIssues(iss);
      setDocks(dk);
      setRequests(req);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    await api.createBroadcast({ supervisor_id: user.id, message: broadcastMsg });
    setBroadcastMsg('');
    setShowBroadcast(false);
  };

  const handleFulfillRequest = async (id) => {
    await api.fulfillRequest(id);
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 border-3 border-stone-200 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-stone-400 text-sm">Loading floor overview…</p>
    </div>
  );

  const escalated = issues.filter(i => i.status === 'escalated');
  const critical = escalated.filter(i => i.severity === 'critical');
  const firstName = user.name.split(' ')[0];

  return (
    <div className="space-y-7 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-stone-500 mt-1.5 text-[15px]">
            Here's what needs your attention across the floor.
          </p>
        </div>
        <button
          onClick={() => setShowBroadcast(!showBroadcast)}
          className={`px-5 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
            showBroadcast
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200/60 hover:shadow-amber-200/50'
          }`}
        >
          <Megaphone size={16} /> Broadcast
        </button>
      </div>

      {/* Broadcast Panel */}
      {showBroadcast && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-4 animate-in space-y-3">
          <div className="flex gap-3">
            <input
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBroadcast()}
              placeholder="Type a message to send to all workers on the floor…"
              className="flex-1 bg-white border border-amber-200/80 rounded-xl px-4 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
            />
            <button onClick={handleBroadcast} className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 shadow-sm hover:shadow-md transition-all duration-200">
              <Send size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 font-medium">Auto-dismiss after:</span>
            {[15, 30, 60].map(sec => (
              <button
                key={sec}
                onClick={() => setBroadcastDuration(sec)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                  broadcastDuration === sec
                    ? 'bg-amber-500 text-white'
                    : 'bg-white border border-amber-200 text-amber-600 hover:bg-amber-50'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats — gradient cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-2xl p-5 border transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 ${
          escalated.length > 0
            ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/60'
            : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/60'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-stone-500 text-xs font-medium">Escalated</p>
              <p className="text-3xl font-bold text-stone-900 mt-1">{escalated.length}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{escalated.length === 0 ? 'Floor is clear' : 'Awaiting your action'}</p>
            </div>
          </div>
        </div>
        <div className={`rounded-2xl p-5 border transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 ${
          critical.length > 0
            ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200/60'
            : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-stone-500 text-xs font-medium">Critical</p>
              <p className="text-3xl font-bold text-stone-900 mt-1">{critical.length}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{critical.length === 0 ? 'Nothing urgent' : 'Immediate attention'}</p>
            </div>
            <span className="text-2xl">⚡</span>
          </div>
        </div>
        <div className="rounded-2xl p-5 border bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/60 transition-all hover:shadow-md hover:-translate-y-0.5 duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-stone-500 text-xs font-medium">Docks active</p>
              <p className="text-3xl font-bold text-stone-900 mt-1">{docks.filter(d => d.status !== 'idle').length}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">of {docks.length} total doors</p>
            </div>
            <span className="text-2xl">🚪</span>
          </div>
        </div>
        <div className={`rounded-2xl p-5 border transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 ${
          requests.length > 0
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60'
            : 'bg-gradient-to-br from-stone-50 to-zinc-50 border-stone-200/60'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-stone-500 text-xs font-medium">Requests</p>
              <p className="text-3xl font-bold text-stone-900 mt-1">{requests.length}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{requests.length === 0 ? 'All fulfilled' : 'Pending from workers'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Queue — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
            <Bell size={14} /> Priority Alert Queue
          </h2>

          {escalated.length === 0 ? (
            <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-emerald-700 text-lg font-semibold">All clear on the floor</p>
              <p className="text-stone-400 text-sm mt-1.5 max-w-xs mx-auto">No escalated issues right now. Your team is handling things smoothly. 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {escalated.map(issue => {
                const elapsed = issue.escalated_at
                  ? Math.round((Date.now() - new Date(issue.escalated_at).getTime()) / 60000)
                  : Math.round((Date.now() - new Date(issue.created_at).getTime()) / 60000);
                return (
                  <div
                    key={issue.id}
                    onClick={() => navigate(`/app/issue/${issue.id}`)}
                    className={`rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border ${
                      issue.severity === 'critical'
                        ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200/80 hover:border-red-300'
                        : issue.severity === 'high'
                        ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200/80 hover:border-orange-300'
                        : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200/60 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-center gap-3">
                        <SeverityBadge severity={issue.severity} size="sm" />
                        <h3 className="font-semibold text-stone-900">{issue.issue_type}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-400 bg-white/60 px-2.5 py-1 rounded-full">
                        <Clock size={12} /> {elapsed < 60 ? `${elapsed}m` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
                      <span className="flex items-center gap-1.5"><MapPin size={13} /> <strong className="text-stone-700">Dock {issue.door_number}</strong></span>
                      <span>👤 {issue.operator_name}</span>
                      {issue.company_name && <span>🏢 {issue.company_name}</span>}
                      {issue.product_name && <span>{issue.product_name}</span>}
                    </div>
                    {issue.description && (
                      <p className="text-sm text-stone-400 mt-2 truncate">{issue.description}</p>
                    )}
                    {issue.estimated_cost_impact > 0 && (
                      <p className="text-xs text-amber-600 mt-2 font-medium">Estimated impact: ${issue.estimated_cost_impact.toFixed(2)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Operational Requests */}
          {requests.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mt-6 mb-3 flex items-center gap-2">Operational Requests</h2>
              <div className="space-y-2.5">
                {requests.map(req => (
                  <div key={req.id} className="rounded-2xl bg-white border border-stone-200/80 p-4 flex items-center justify-between hover:shadow-sm transition-all duration-150">
                    <div>
                      <p className="text-sm font-medium text-stone-900">{req.request_type}</p>
                      <p className="text-xs text-stone-400">{req.operator_name} · Dock {req.door_number} · {timeAgo(req.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleFulfillRequest(req.id); }}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-600 text-sm font-medium border border-emerald-200/60 hover:shadow-sm hover:border-emerald-300 transition-all duration-150"
                    >Fulfill</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dock Floor Overview */}
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4 flex items-center gap-2">🚪 Dock Floor</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {docks.map(dock => (
              <div key={dock.id} className={`rounded-2xl p-3.5 text-center border transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 ${
                dock.status === 'critical' ? 'bg-gradient-to-b from-red-50 to-rose-50 border-red-200/80' :
                dock.status === 'issue' ? 'bg-gradient-to-b from-amber-50 to-yellow-50 border-amber-200/80' :
                dock.status === 'active' ? 'bg-gradient-to-b from-emerald-50 to-green-50 border-emerald-200/60' :
                'bg-white border-stone-200/60'
              }`}>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <DockStatusDot status={dock.status} />
                  <span className="text-xl font-black text-stone-900">{dock.door_number}</span>
                </div>
                <p className="text-[11px] text-stone-500 truncate font-medium">{dock.operator_name || 'Empty'}</p>
                <p className="text-[10px] text-stone-400 truncate">{dock.company_name || '—'}</p>
                {dock.lifecycle_phase && dock.lifecycle_phase !== 'idle' && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-full mt-1.5 inline-block font-medium ${
                    dock.lifecycle_phase === 'loading' ? 'bg-blue-100/80 text-blue-600' :
                    dock.lifecycle_phase === 'unloading' ? 'bg-emerald-100/80 text-emerald-600' :
                    dock.lifecycle_phase === 'inspection' ? 'bg-blue-100/80 text-blue-600' :
                    dock.lifecycle_phase === 'complete' ? 'bg-stone-100 text-stone-500' :
                    'bg-amber-100/80 text-amber-600'
                  }`}>
                    {dock.lifecycle_phase}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-stone-400">
            <span className="flex items-center gap-1.5"><DockStatusDot status="active" /> Active</span>
            <span className="flex items-center gap-1.5"><DockStatusDot status="issue" /> Issue</span>
            <span className="flex items-center gap-1.5"><DockStatusDot status="critical" /> Critical</span>
            <span className="flex items-center gap-1.5"><DockStatusDot status="idle" /> Idle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
