import { useState, useEffect } from 'react';
import { api } from '../../api';
import { SeverityBadge } from '../../components/Shared';
import { Search, Filter, Download } from 'lucide-react';

export default function IssueLogs() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ severity: '', status: '', search: '' });

  useEffect(() => {
    api.getIssues({ limit: 200 }).then(iss => { setIssues(iss); setLoading(false); });
  }, []);

  const filtered = issues.filter(i => {
    if (filters.severity && i.severity !== filters.severity) return false;
    if (filters.status && i.status !== filters.status) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      return (
        (i.issue_type || '').toLowerCase().includes(s) ||
        (i.operator_name || '').toLowerCase().includes(s) ||
        (i.company_name || '').toLowerCase().includes(s) ||
        (i.description || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;

  const statusLabel = {
    self_resolved: { text: 'Self-Resolved', cls: 'bg-emerald-50 text-emerald-600' },
    supervisor_resolved: { text: 'Supervisor', cls: 'bg-blue-50 text-blue-600' },
    escalated: { text: 'Escalated', cls: 'bg-red-50 text-red-600' },
    resolution_in_progress: { text: 'In Progress', cls: 'bg-amber-50 text-amber-600' },
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Issue Logs</h1>
          <p className="text-gray-500 mt-1">Complete searchable history of all issues — self-resolved and escalated</p>
        </div>
        <span className="text-sm text-gray-500">{filtered.length} of {issues.length} issues</span>
      </div>

      {/* Filters */}
      <div className="glass p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-gray-500" />
          <input
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Search issues..."
            className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none text-sm"
          />
        </div>
        <select
          value={filters.severity}
          onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}
          className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700"
        >
          <option value="">All Statuses</option>
          <option value="self_resolved">Self-Resolved</option>
          <option value="supervisor_resolved">Supervisor Resolved</option>
          <option value="escalated">Escalated</option>
          <option value="resolution_in_progress">In Progress</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-semibold uppercase">#</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-semibold uppercase">Time</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-semibold uppercase">Severity</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-semibold uppercase">Type</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-semibold uppercase">Dock</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-semibold uppercase">Operator</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-semibold uppercase">Customer</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 font-semibold uppercase">Status</th>
                <th className="text-right py-3 px-4 text-xs text-gray-500 font-semibold uppercase">Cost</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(issue => {
                const sl = statusLabel[issue.status] || statusLabel.resolution_in_progress;
                return (
                  <tr key={issue.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-500 font-mono">{issue.id}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{new Date(issue.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4"><SeverityBadge severity={issue.severity} size="sm" /></td>
                    <td className="py-3 px-4 text-gray-900 font-medium">{issue.issue_type}</td>
                    <td className="py-3 px-4 text-gray-500">{issue.door_number}</td>
                    <td className="py-3 px-4 text-gray-500">{issue.operator_name}</td>
                    <td className="py-3 px-4 text-gray-500 truncate max-w-[120px]">{issue.company_name || '—'}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${sl.cls}`}>{sl.text}</span></td>
                    <td className="py-3 px-4 text-right text-amber-600 font-mono">${(issue.estimated_cost_impact || 0).toFixed(0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
