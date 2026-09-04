import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { ArrowLeftRight, Send, Clock, AlertTriangle, CheckCircle, Truck } from 'lucide-react';

export default function ShiftHandoff() {
  const { user } = useAuth();
  const [handoffs, setHandoffs] = useState([]);
  const [notes, setNotes] = useState('');
  const [shift, setShift] = useState('day');
  const [unresolvedIssues, setUnresolvedIssues] = useState([]);
  const [docks, setDocks] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getHandoffs(),
      api.getIssues({ status: 'active' }),
      api.getDocks(),
    ]).then(([h, iss, dk]) => {
      setHandoffs(h);
      setUnresolvedIssues(iss);
      setDocks(dk);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async () => {
    await api.createHandoff({ supervisor_id: user.id, shift, notes });
    setSubmitted(true);
  };

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shift Handoff</h1>
        <p className="text-gray-500 mt-1">Summarize your shift for the incoming team</p>
      </div>

      {/* Shift Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{docks.filter(d => d.status !== 'idle').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active Docks</p>
        </div>
        <div className="glass-sm p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{unresolvedIssues.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Open Issues</p>
        </div>
        <div className="glass-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{docks.filter(d => d.lifecycle_phase === 'loading' || d.lifecycle_phase === 'unloading').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">In-Progress Loads</p>
        </div>
        <div className="glass-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-400">{docks.filter(d => d.status === 'idle').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Idle Docks</p>
        </div>
      </div>

      {/* Active Docks Status */}
      {docks.filter(d => d.status !== 'idle').length > 0 && (
        <div className="glass p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Truck size={14} className="text-blue-500" /> Active Dock Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {docks.filter(d => d.status !== 'idle').map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    d.status === 'critical' ? 'bg-red-100 text-red-600' :
                    d.status === 'issue' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>{d.door_number}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.operator_name || 'Unassigned'}</p>
                    <p className="text-xs text-gray-400">{d.company_name || 'No load'} · {d.lifecycle_phase || 'idle'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unresolved Issues */}
      {unresolvedIssues.length > 0 && (
        <div className="glass p-5 border-l-4 border-l-amber-400">
          <h3 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> {unresolvedIssues.length} Unresolved Issue{unresolvedIssues.length > 1 ? 's' : ''} to Hand Off
          </h3>
          <div className="space-y-2">
            {unresolvedIssues.map(iss => (
              <div key={iss.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 text-sm">
                <div>
                  <span className="font-medium text-gray-700">{iss.issue_type}</span>
                  <span className="text-gray-400 ml-2">Dock {iss.door_number} · {iss.operator_name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  iss.severity === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>{iss.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write Notes */}
      {!submitted ? (
        <div className="glass p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-500 mb-2 block">Shift:</label>
            <div className="flex gap-2">
              {['day', 'night'].map(s => (
                <button key={s} onClick={() => setShift(s)} className={`px-4 py-2 rounded-xl text-sm capitalize ${
                  shift === s ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-gray-100 text-gray-700'
                }`}>{s} Shift</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-2 block">Handoff Notes:</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Summarize the shift: key events, unresolved issues, pending trailers, equipment notes..."
              className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-[#0071e3]/20 h-32 resize-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!notes.trim()}
            className="w-full py-3 bg-blue-600 rounded-xl font-semibold text-white hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Send size={16} /> Submit Handoff
          </button>
        </div>
      ) : (
        <div className="glass p-8 text-center animate-in">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <p className="text-lg font-semibold text-gray-900">Handoff Submitted</p>
          <p className="text-gray-500 text-sm mt-1">The incoming shift will see your notes on their dashboard.</p>
        </div>
      )}

      {/* Previous Handoffs */}
      {handoffs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Previous Handoffs</h3>
          <div className="space-y-3">
            {handoffs.map(h => (
              <div key={h.id} className="glass-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-gray-500" />
                  <span className="text-sm text-gray-500">{h.supervisor_name} · {h.shift} shift · {new Date(h.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{h.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
