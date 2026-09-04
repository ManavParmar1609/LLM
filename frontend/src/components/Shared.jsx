import { AlertTriangle, Warehouse } from 'lucide-react';

export function BrandMark({ compact = false, subtitle }) {
  return (
    <div className={`apple-brand ${compact ? 'is-compact' : ''}`}>
      <span className="apple-brand-symbol" aria-hidden="true"><Warehouse /></span>
      <span className="apple-brand-copy">
        <span className="apple-brand-name">DockIQ<span>.AI</span></span>
        {subtitle && <span className="apple-brand-subtitle">{subtitle}</span>}
      </span>
    </div>
  );
}

export function SeverityBadge({ severity, size = 'md' }) {
  const config = {
    critical: { label: 'CRITICAL', cls: 'severity-critical' },
    high: { label: 'HIGH', cls: 'severity-high' },
    medium: { label: 'MEDIUM', cls: 'severity-medium' },
    low: { label: 'LOW', cls: 'severity-low' },
  };
  const c = config[severity] || config.low;
  const sz = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${c.cls} ${sz}`}>
      <span className="severity-dot" aria-hidden="true" /> {c.label}
    </span>
  );
}

export function LoadPatternVisual({ pattern, companyName }) {
  if (!pattern) return null;
  const h = pattern.max_height || 2;
  const rows = 11;

  // Realistic pallet — 3 wide horizontal deck boards + 3 narrow vertical stringers
  const Pallet = ({ isHeavy, num }) => {
    const border = isHeavy ? '#92400e' : '#b45309';
    const deckBoard = isHeavy ? '#d97706' : '#f59e0b';
    const stringer = isHeavy ? '#78350f' : '#92400e';
    const bg = isHeavy ? '#fef3c7' : '#fffbeb';
    return (
      <div className="relative overflow-hidden rounded-[2px]" style={{ width: '100%', aspectRatio: '1.25/1', border: `2px solid ${border}`, background: bg }}>
        {/* 3 horizontal deck boards — prominent */}
        <div className="absolute inset-0 flex flex-col justify-between p-[2px]">
          {[0,1,2].map(i => (
            <div key={i} style={{ height: '28%', background: deckBoard, opacity: 0.35, borderRadius: 1 }} />
          ))}
        </div>
        {/* 3 vertical stringers — thinner, underneath */}
        <div className="absolute inset-0 flex justify-between p-[3px]">
          {[0,1,2].map(i => (
            <div key={i} style={{ width: '12%', height: '100%', background: stringer, opacity: 0.25, borderRadius: 1 }} />
          ))}
        </div>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold z-10" style={{ color: `${border}99` }}>{num}</span>
      </div>
    );
  };

  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">{companyName} Load Pattern</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">Straight · 22 pallets</span>
      </div>

      <div className="flex gap-6">
        {/* Trailer top-down view */}
        <div className="flex-1 bg-stone-50 rounded-2xl p-4">
          <div className="relative mx-auto" style={{ maxWidth: 220 }}>
            {/* Trailer walls */}
            <div className="border-2 border-gray-400 rounded-md bg-white p-2 relative">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Nose</div>
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Dock Door</div>

              <div className="space-y-1">
                {[...Array(rows)].map((_, row) => {
                  const isHeavy = row < 4;
                  return (
                    <div key={row} className="flex gap-1">
                      <Pallet isHeavy={isHeavy} num={row * 2 + 1} />
                      <Pallet isHeavy={isHeavy} num={row * 2 + 2} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Weight zone legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-700" /> Heavy (nose)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-600" /> Light (rear)</span>
          </div>
        </div>

        {/* Specs panel */}
        <div className="w-52 space-y-3 flex-shrink-0">
          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Stack Height</p>
            <div className="flex gap-0.5">
              {[...Array(h)].map((_, i) => (
                <div key={i} className="flex-1 h-6 rounded bg-amber-200 border border-amber-400 flex items-center justify-center text-[8px] font-bold text-amber-800">
                  {i + 1}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-900 font-semibold mt-1.5">Max {h} pallets high</p>
            {pattern.slip_sheets && <p className="text-[10px] text-amber-600 mt-0.5">↕ Slip sheets between layers</p>}
          </div>

          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Weight Rule</p>
            <p className="text-sm font-semibold text-gray-900">{(pattern.weight_placement || '').replace('_', ' ')}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Heavy pallets to the nose of the trailer</p>
          </div>

          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Labels</p>
            <p className="text-sm font-semibold text-gray-900">{(pattern.label_direction || '').replace('_', ' ')}</p>
          </div>

          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Slip Sheets</p>
            <p className="text-sm font-semibold">{pattern.slip_sheets ? <span className="text-emerald-600">Required</span> : <span className="text-gray-500">Not required</span>}</p>
          </div>
        </div>
      </div>

      {pattern.special && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertTriangle size={16} className="inline mr-1" aria-hidden="true" /> <strong>Special:</strong> {pattern.special}
        </div>
      )}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-emerald-50 border-emerald-200',
    red: 'bg-red-50 border-red-200',
    orange: 'bg-orange-50 border-orange-200',
    purple: 'bg-blue-50 border-blue-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  return (
    <div className={`${colors[color]} border rounded-2xl p-5 animate-in`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}

export function QuickTapChips({ selected, onToggle }) {
  const chips = [
    'Crushed', 'Wet / Water Damage', 'Torn Label', 'Wrong Product',
    'Short Count', 'Bad Odor', 'Punctured Packaging', 'Missing Label',
    'Pallet Unstable', 'Product Leaking', 'Mold / Discoloration', 'Expired'
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(chip => (
        <button
          key={chip}
          onClick={() => onToggle(chip)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            selected.includes(chip)
              ? 'bg-blue-600 text-white shadow-apple'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ current, total, label }) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  return (
    <div>
      {label && <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-900 font-semibold">{current} / {total}</span>
      </div>}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-600' : 'bg-amber-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DockStatusDot({ status }) {
  const colors = {
    idle: 'bg-gray-400',
    active: 'bg-emerald-400 animate-pulse',
    issue: 'bg-amber-400 animate-pulse',
    critical: 'bg-red-500 animate-pulse',
  };
  return <span className={`inline-block w-3 h-3 rounded-full ${colors[status] || colors.idle}`} />;
}
