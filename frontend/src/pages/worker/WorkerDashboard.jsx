import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { DockStatusDot, SeverityBadge } from '../../components/Shared';
import { PackageCheck, PackageOpen, ClipboardList, AlertTriangle, MessageSquare, Wrench, Coffee, Sun, Moon, ArrowRight } from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', icon: <Coffee className="w-5 h-5 text-amber-500" /> };
  if (h < 17) return { text: 'Good afternoon', icon: <Sun className="w-5 h-5 text-amber-500" /> };
  return { text: 'Good evening', icon: <Moon className="w-5 h-5 text-indigo-400" /> };
}

function timeAgo(dateStr) {
  const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function WorkerDashboard() {
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [issues, setIssues] = useState([]);
  const [handoff, setHandoff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getOrders({ operator_id: user.id, status: 'in_progress' }),
      api.getIssues({ operator_id: user.id }),
      api.getHandoffs(),
    ]).then(([orders, iss, handoffs]) => {
      setOrder(orders[0] || null);
      setIssues(iss);
      setHandoff(handoffs[0] || null);
      setLoading(false);
    });
  }, [user.id]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 border-3 border-stone-200 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-stone-400 text-sm">Getting your shift ready…</p>
    </div>
  );

  const activeIssues = issues.filter(i => ['resolution_in_progress', 'escalated'].includes(i.status));
  const greeting = getGreeting();
  const firstName = user.name.split(' ')[0];

  return (
    <div className="space-y-7 animate-in">
      {/* Warm Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
          {greeting.text}, {firstName} 👋
        </h1>
        <p className="text-stone-500 mt-1.5 text-[15px] leading-relaxed">
          {order
            ? `You're ${order.type === 'outbound' ? 'loading' : 'unloading'} for ${order.company_name} at Dock ${order.door_number} today. Here's your shift overview.`
            : "You don't have an active assignment yet — sit tight, one's coming your way."}
        </p>
      </div>

      {/* Shift Handoff — warm callout */}
      {handoff && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100/40 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🌙</span>
              <h3 className="text-sm font-semibold text-amber-700">From last night's team</h3>
            </div>
            <p className="text-sm text-stone-700 leading-relaxed">{handoff.notes}</p>
            <p className="text-xs text-stone-400 mt-3">Handed off by {handoff.supervisor_name} · {timeAgo(handoff.created_at)}</p>
          </div>
        </div>
      )}

      {/* Current Assignment */}
      {order && (
        <div className="rounded-3xl bg-white border border-stone-200/80 shadow-sm overflow-hidden">
          {/* Dock hero */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-xs font-medium uppercase tracking-wider mb-1">Current Assignment</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black">Dock {order.door_number}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    order.type === 'outbound' ? 'bg-white/20 text-white' : 'bg-emerald-400/20 text-emerald-100'
                  }`}>
                    {order.type === 'outbound' ? '↑ Loading' : '↓ Unloading'}
                  </span>
                </div>
                <p className="text-blue-100 text-sm mt-1">{order.company_name} · Trailer {order.trailer_number}</p>
              </div>
              <DockStatusDot status="active" />
            </div>
          </div>

          {/* Order details strip */}
          <div className="px-6 py-3 bg-stone-50/80 border-b border-stone-100 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500">
            <span>{order.order_number}</span>
            <span>BOL {order.bol_number}</span>
            <span>🚚 {order.carrier_name}</span>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
            <Link to="/app/inspection" className="group flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-gradient-to-b from-emerald-50 to-stone-50 border border-emerald-100/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <ClipboardList className="w-7 h-7 text-emerald-600 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-sm font-medium text-stone-700">Inspect Trailer</span>
              <span className="text-[11px] text-stone-400 text-center leading-tight">Check condition before work</span>
            </Link>
            {order.type === 'outbound' ? (
              <Link to="/app/loading" className="group flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-gradient-to-b from-blue-50 to-stone-50 border border-blue-100/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <PackageCheck className="w-7 h-7 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-sm font-medium text-stone-700">Start Loading</span>
                <span className="text-[11px] text-stone-400 text-center leading-tight">Begin pallet loading</span>
              </Link>
            ) : (
              <Link to="/app/unloading" className="group flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-gradient-to-b from-blue-50 to-stone-50 border border-blue-100/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <PackageOpen className="w-7 h-7 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-sm font-medium text-stone-700">Start Unloading</span>
                <span className="text-[11px] text-stone-400 text-center leading-tight">Begin receiving freight</span>
              </Link>
            )}
            <Link to="/app/chat" className="group flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-gradient-to-b from-violet-50 to-stone-50 border border-violet-100/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <MessageSquare className="w-7 h-7 text-violet-600 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-sm font-medium text-stone-700">AI Assistant</span>
              <span className="text-[11px] text-stone-400 text-center leading-tight">Get help with anything</span>
            </Link>
            <Link to="/app/my-issues" className="group relative flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-gradient-to-b from-amber-50 to-stone-50 border border-amber-100/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <AlertTriangle className="w-7 h-7 text-amber-600 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-sm font-medium text-stone-700">My Issues</span>
              <span className="text-[11px] text-stone-400 text-center leading-tight">Track reported problems</span>
              {activeIssues.length > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 rounded-full text-[11px] flex items-center justify-center font-bold text-white shadow-sm">
                  {activeIssues.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      )}

      {/* Stats — gradient cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-2xl p-5 border transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 ${
          activeIssues.length > 0
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60'
            : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/60'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-stone-500 text-xs font-medium">Needs attention</p>
              <p className="text-3xl font-bold text-stone-900 mt-1">{activeIssues.length}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{activeIssues.length === 0 ? 'All clear!' : 'Open issues'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-5 border bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60 transition-all hover:shadow-md hover:-translate-y-0.5 duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-stone-500 text-xs font-medium">Fixed by you</p>
              <p className="text-3xl font-bold text-stone-900 mt-1">{issues.filter(i => i.status === 'self_resolved').length}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">Resolved on your own</p>
            </div>
          </div>
        </div>
        <div className={`rounded-2xl p-5 border transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 ${
          issues.filter(i => i.status === 'escalated').length > 0
            ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/60'
            : 'bg-gradient-to-br from-stone-50 to-zinc-50 border-stone-200/60'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-stone-500 text-xs font-medium">Sent to supervisor</p>
              <p className="text-3xl font-bold text-stone-900 mt-1">{issues.filter(i => i.status === 'escalated').length}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">Escalated issues</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-5 border bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/60 transition-all hover:shadow-md hover:-translate-y-0.5 duration-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-stone-500 text-xs font-medium">Your history</p>
              <p className="text-3xl font-bold text-stone-900 mt-1">{issues.length}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">Total issues logged</p>
            </div>
            <span className="text-2xl">📊</span>
          </div>
        </div>
      </div>

      {/* Recent Issues — timeline style */}
      {issues.length > 0 && (
        <div className="rounded-3xl bg-white border border-stone-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-stone-700">Recent activity</h3>
            <Link to="/app/my-issues" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {issues.slice(0, 5).map((issue, idx) => (
              <div key={issue.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-stone-50/80 transition-colors duration-150 group">
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    issue.status === 'escalated' ? 'bg-red-400' :
                    issue.status === 'self_resolved' || issue.status === 'supervisor_resolved' ? 'bg-emerald-400' :
                    'bg-amber-400'
                  }`} />
                  {idx < Math.min(issues.length, 5) - 1 && <div className="w-px h-8 bg-stone-200 mt-1" />}
                </div>
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{issue.issue_type}</p>
                    <p className="text-xs text-stone-400">Dock {issue.door_number} · {timeAgo(issue.created_at)}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
                    issue.status === 'self_resolved' ? 'bg-emerald-50 text-emerald-600' :
                    issue.status === 'escalated' ? 'bg-red-50 text-red-600' :
                    issue.status === 'supervisor_resolved' ? 'bg-blue-50 text-blue-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {issue.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friendly empty state */}
      {!order && (
        <div className="rounded-3xl bg-gradient-to-br from-stone-50 to-zinc-50 border border-stone-200/60 p-14 text-center">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-5">
            <Wrench className="w-8 h-8 text-stone-300" />
          </div>
          <h3 className="text-lg font-semibold text-stone-600">No assignment yet</h3>
          <p className="text-sm text-stone-400 mt-2 max-w-xs mx-auto">
            Hang tight — your dock assignment will show up here as soon as a load is ready for you. ☕
          </p>
        </div>
      )}
    </div>
  );
}
