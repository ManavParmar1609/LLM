import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { SeverityBadge } from '../../components/Shared';
import { Clock, CheckCircle, ArrowUpCircle, AlertTriangle, Check } from 'lucide-react';

const RESOLVE_OPTIONS = ['Partial Accept', 'Full Reject', 'Manual Entry', 'Temp Re-check OK', 'Equipment Swapped', 'Product Segregated', 'Corrected and Continued'];

export default function MyIssues() {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);

  const refresh = () => api.getIssues({ operator_id: user.id }).then(iss => { setIssues(iss); setLoading(false); });

  useEffect(() => { refresh(); }, [user.id]);

  const handleResolve = async (issueId, resolutionType) => {
    await api.selfResolve(issueId, { resolution_type: resolutionType, resolution_notes: 'Resolved by worker from My Issues' });
    setResolvingId(null);
    refresh();
  };

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;

  const statusConfig = {
    self_resolved: { label: 'Self-Resolved', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    supervisor_resolved: { label: 'Supervisor Resolved', icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    escalated: { label: 'Escalated — Waiting', icon: ArrowUpCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
    resolution_in_progress: { label: 'In Progress', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Issues</h1>
        <p className="text-gray-500 mt-1">Track status and resolutions for all your reported issues</p>
      </div>

      {issues.length === 0 ? (
        <div className="glass p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No issues reported yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map(issue => {
            const sc = statusConfig[issue.status] || statusConfig.resolution_in_progress;
            const Icon = sc.icon;
            return (
              <div key={issue.id} className="glass-sm p-5 animate-in">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${sc.bg}`}>
                      <Icon className={`w-5 h-5 ${sc.color}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{issue.issue_type}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Dock {issue.door_number} · {issue.company_name || 'N/A'} · #{issue.id}
                      </p>
                    </div>
                  </div>
                  <SeverityBadge severity={issue.severity} size="sm" />
                </div>

                {issue.description && (
                  <p className="text-sm text-gray-500 mb-2">{issue.description}</p>
                )}

                {issue.quick_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {issue.quick_tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-500">{tag}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className={`text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                  <div className="flex items-center gap-2">
                    {(issue.status === 'escalated' || issue.status === 'resolution_in_progress') && (
                      <button
                        onClick={() => setResolvingId(resolvingId === issue.id ? null : issue.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-medium flex items-center gap-1"
                      >
                        <Check size={12} /> Mark Resolved
                      </button>
                    )}
                    <span className="text-xs text-gray-400">{new Date(issue.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {resolvingId === issue.id && (
                  <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 animate-in">
                    <p className="text-xs text-emerald-700 font-semibold mb-2">How did you resolve it?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {RESOLVE_OPTIONS.map(opt => (
                        <button key={opt} onClick={() => handleResolve(issue.id, opt)} className="text-xs px-2.5 py-1 rounded-full bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100">
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {issue.supervisor_notes && (
                  <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                    <p className="text-xs text-blue-600 font-semibold mb-1">Supervisor Resolution</p>
                    {issue.resolution_type && <p className="text-xs text-blue-700 font-medium">Action: {issue.resolution_type}</p>}
                    <p className="text-blue-600">{issue.supervisor_notes}</p>
                    {issue.supervisor_name && <p className="text-[10px] text-blue-400 mt-1">Resolved by {issue.supervisor_name}</p>}
                  </div>
                )}

                {issue.estimated_cost_impact > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Estimated impact: ${issue.estimated_cost_impact.toFixed(2)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
