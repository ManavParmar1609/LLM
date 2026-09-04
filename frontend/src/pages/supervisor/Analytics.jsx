import { useState, useEffect } from 'react';
import { api } from '../../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Area, AreaChart } from 'recharts';

const APPLE_BLUE = '#0071e3';
const APPLE_GREEN = '#34c759';
const APPLE_RED = '#ff3b30';
const APPLE_ORANGE = '#ff9500';
const APPLE_PURPLE = '#af52de';
const APPLE_TEAL = '#5ac8fa';

const tooltipStyle = {
  background: '#fff', border: 'none', borderRadius: 14,
  boxShadow: '0 4px 24px rgba(0,0,0,0.12)', padding: '10px 14px',
  fontSize: 13, color: '#1d1d1f'
};

const sevColors = { critical: APPLE_RED, high: APPLE_ORANGE, medium: '#ffcc00', low: APPLE_GREEN };

function MetricCard({ label, value, sub, trend, color }) {
  const bg = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    red: 'from-red-500 to-red-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
  };
  return (
    <div className={`bg-gradient-to-br ${bg[color] || bg.blue} rounded-2xl p-5 text-white`}>
      <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-2 tracking-tight">{value}</p>
      {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-black/[0.04] ${className}`}>
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500 text-sm">Loading analytics...</div>
    </div>
  );

  // Build gradient data for area chart
  const timeData = data.over_time.map(d => ({
    ...d,
    date: d.date.slice(5) // "08-03" instead of full date
  }));

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Analytics</h1>
        <p className="text-gray-500 mt-1">Operational intelligence across docks, operators, and customers</p>
      </div>

      {/* Hero Metrics — gradient cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total Issues" value={data.total_issues} color="blue" />
        <MetricCard label="Self-Resolved" value={data.self_resolved} sub={`${data.self_resolution_rate}% resolution rate`} color="green" />
        <MetricCard label="Escalated" value={data.escalated} color="orange" />
        <MetricCard label="Avg Resolution" value={`${data.avg_resolution_minutes}m`} sub="per issue" color="purple" />
        <MetricCard label="Cost Impact" value={`$${Math.round(data.total_cost_impact || 0).toLocaleString()}`} sub="estimated total" color="red" />
      </div>

      {/* Row 1: Area chart (full width) */}
      <ChartCard title="Issue Trend" subtitle="Last 30 days">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={APPLE_BLUE} stopOpacity={0.2} />
                <stop offset="100%" stopColor={APPLE_BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#86868b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#86868b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#e5e7eb' }} />
            <Area type="monotone" dataKey="count" stroke={APPLE_BLUE} strokeWidth={2.5} fill="url(#blueGrad)" dot={{ fill: APPLE_BLUE, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: APPLE_BLUE }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Row 2: Severity + Issues by Type */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Severity — custom donut */}
        <ChartCard title="Severity Breakdown" className="md:col-span-2">
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={data.by_severity} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={72} paddingAngle={3}
                  dataKey="count" nameKey="severity" strokeWidth={0}
                >
                  {data.by_severity.map((entry) => (
                    <Cell key={entry.severity} fill={sevColors[entry.severity] || '#ccc'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2.5 flex-1">
              {data.by_severity.map(s => (
                <div key={s.severity} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sevColors[s.severity] }} />
                    <span className="text-sm text-gray-900 capitalize">{s.severity}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* Issues by Type — horizontal bars */}
        <ChartCard title="Issues by Type" subtitle="Most common issue categories" className="md:col-span-3">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.by_type} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" tick={{ fill: '#86868b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="issue_type" type="category" tick={{ fill: '#1d1d1f', fontSize: 11 }} width={145} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f5f5f7' }} />
              <Bar dataKey="count" fill={APPLE_BLUE} radius={[0, 6, 6, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3: Dock Heatmap + Operator Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Issues by Dock */}
        <ChartCard title="Issues by Dock Door" subtitle="Identify problematic dock locations">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.by_dock} margin={{ left: -20, right: 10 }}>
              <XAxis dataKey="door_number" tick={{ fill: '#86868b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#86868b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f5f5f7' }} />
              <Bar dataKey="count" fill={APPLE_PURPLE} radius={[6, 6, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Operator Performance */}
        <ChartCard title="Operator Self-Resolution Rate" subtitle="Higher is better — reduces supervisor load">
          <div className="space-y-3">
            {data.by_operator.sort((a, b) => {
              const rateA = a.total > 0 ? a.self_resolved / a.total : 0;
              const rateB = b.total > 0 ? b.self_resolved / b.total : 0;
              return rateB - rateA;
            }).map((op, i) => {
              const rate = op.total > 0 ? Math.round((op.self_resolved / op.total) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-[10px] font-bold text-gray-500">
                    {op.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-xs text-gray-900 w-20 truncate font-medium">{op.name.split(' ')[0]}</span>
                  <div className="flex-1 bg-stone-50 rounded-full h-6 relative overflow-hidden">
                    <div
                      className="h-6 rounded-full transition-all duration-700"
                      style={{
                        width: `${rate}%`,
                        background: rate >= 70 ? APPLE_GREEN : rate >= 40 ? APPLE_ORANGE : APPLE_RED
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-900 w-16 text-right">{rate}% <span className="text-gray-500 font-normal">({op.total})</span></span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* Row 4: Customer + Carrier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Issues by Customer" subtitle="Which customers' orders cause the most issues">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.by_company} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" tick={{ fill: '#86868b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#1d1d1f', fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f5f5f7' }} />
              <Bar dataKey="count" fill={APPLE_ORANGE} radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Carrier Quality" subtitle="Fewer issues = better carrier performance">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.by_carrier} margin={{ left: -20, right: 10 }}>
              <XAxis dataKey="name" tick={{ fill: '#1d1d1f', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#86868b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f5f5f7' }} />
              <Bar dataKey="count" fill={APPLE_RED} radius={[6, 6, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
