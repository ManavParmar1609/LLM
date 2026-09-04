import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { SeverityBadge, QuickTapChips } from '../../components/Shared';
import { AlertTriangle, CheckCircle, ArrowUpCircle, Sparkles, RotateCcw, Package, Thermometer, Shuffle, ListChecks, ScanLine, Wrench, LockKeyhole, FileText, CalendarDays, Search, DollarSign, Repeat2, BookOpen } from 'lucide-react';

const ISSUE_TYPES = [
  { value: 'Damaged Pallet', icon: Package },
  { value: 'Temperature Deviation', icon: Thermometer },
  { value: 'SKU Mismatch', icon: Shuffle },
  { value: 'Count Shortage', icon: ListChecks },
  { value: 'Barcode Issue', icon: ScanLine },
  { value: 'Equipment Failure', icon: Wrench },
  { value: 'Seal/Trailer Condition', icon: LockKeyhole },
  { value: 'Paperwork Mismatch', icon: FileText },
  { value: 'Product Quality Concern', icon: AlertTriangle },
  { value: 'Lot/Expiry Issue', icon: CalendarDays },
];

const RESOLUTION_TYPES = [
  'Partial Accept', 'Full Reject', 'Manual Entry', 'Temp Re-check OK',
  'Equipment Swapped', 'Product Segregated', 'Corrected and Continued', 'Other'
];

export default function IssueResolution() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=select type, 2=details, 3=AI resolution, 4=outcome
  const [order, setOrder] = useState(null);
  const [issueType, setIssueType] = useState('');
  const [quickTags, setQuickTags] = useState([]);
  const [description, setDescription] = useState('');
  const [issueResult, setIssueResult] = useState(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    api.getOrders({ operator_id: user.id, status: 'in_progress' }).then(orders => {
      setOrder(orders[0] || null);
    });
  }, [user.id]);

  const toggleTag = (tag) => {
    setQuickTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSubmitIssue = async () => {
    setResolving(true);
    const firstItem = order?.items?.[0];
    const res = await api.createIssue({
      order_id: order?.id,
      dock_door_id: order?.dock_door_id || 1,
      operator_id: user.id,
      issue_type: issueType,
      description: [description, ...quickTags].filter(Boolean).join('. '),
      quick_tags: quickTags,
      product_id: firstItem?.product_id,
      company_id: order?.company_id,
      carrier_id: order?.carrier_id,
      quantity_affected: 1,
    });
    setIssueResult(res);
    setResolving(false);
    setStep(3);
  };

  const handleSelfResolve = async (resolutionType) => {
    await api.selfResolve(issueResult.id, {
      resolution_type: resolutionType,
      resolution_notes: `Self-resolved using AI guidance. Tags: ${quickTags.join(', ')}`,
    });
    setStep(4);
  };

  const handleEscalate = async () => {
    await api.escalateIssue(issueResult.id);
    setStep(4);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-600" /> Report & Resolve Issue
        </h1>
        {order && <p className="text-gray-500 mt-1">Dock {order.door_number} · {order.company_name} · {order.trailer_number}</p>}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              s <= step ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}>{s}</div>
            {s < 4 && <div className={`w-12 h-0.5 ${s < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-gray-500">
          {step === 1 && 'Select Issue Type'}
          {step === 2 && 'Add Details'}
          {step === 3 && 'AI Resolution'}
          {step === 4 && 'Complete'}
        </span>
      </div>

      {/* Step 1: Select Issue Type */}
      {step === 1 && (
        <div className="glass p-6 animate-in">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">What type of issue?</h3>
          <div className="grid grid-cols-2 gap-2">
            {ISSUE_TYPES.map(it => {
              const IssueIcon = it.icon;
              return (
              <button
                key={it.value}
                onClick={() => { setIssueType(it.value); setStep(2); }}
                className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all text-left group"
              >
                <IssueIcon size={21} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">{it.value}</span>
              </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="glass p-6 animate-in">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-900">←</button>
            <h3 className="text-sm font-semibold text-gray-700">{issueType} — Add Details</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-2 block">Quick describe (tap all that apply):</label>
              <QuickTapChips selected={quickTags} onToggle={toggleTag} />
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Additional notes (optional):</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Briefly describe what you see..."
                className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-[#0071e3]/20 h-20 resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-gray-50 text-sm text-gray-500">
              <p><strong className="text-gray-700">Auto-filled context:</strong></p>
              <p>Dock: {order?.door_number || 'N/A'} · Trailer: {order?.trailer_number || 'N/A'} · Customer: {order?.company_name || 'N/A'}</p>
            </div>

            <button
              onClick={handleSubmitIssue}
              disabled={resolving}
              className="w-full py-3 bg-blue-600 rounded-xl font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {resolving ? 'Analyzing and finding resolution...' : <><Search size={16} className="inline mr-2" />Submit and get resolution</>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: AI Resolution */}
      {step === 3 && issueResult && (
        <div className="space-y-4 animate-in">
          {/* Severity Classification */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">AI Severity Classification</h3>
              <SeverityBadge severity={issueResult.severity} />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{issueResult.severity_reason}</p>
            {issueResult.estimated_cost_impact > 0 && (
              <p className="text-xs text-amber-600 mt-2"><DollarSign size={13} className="inline" /> Estimated cost impact: ${issueResult.estimated_cost_impact.toFixed(2)}</p>
            )}
          </div>

          {/* Recurring Pattern Warning */}
          {issueResult.recurring_patterns?.length > 0 && (
            <div className="glass p-4 border-l-4 border-l-amber-400">
              <p className="text-sm font-semibold text-amber-600 mb-1"><Repeat2 size={15} className="inline mr-1" />Recurring Pattern Detected</p>
              {issueResult.recurring_patterns.map((p, i) => (
                <p key={i} className="text-xs text-gray-500">{p.message}</p>
              ))}
            </div>
          )}

          {/* AI Resolution Steps */}
          <div className="glass p-5 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-600">AI Resolution — {issueResult.ai_resolution?.scenario || issueType}</h3>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                issueResult.ai_resolution?.confidence === 'high' ? 'bg-emerald-50 text-emerald-600' :
                issueResult.ai_resolution?.confidence === 'medium' ? 'bg-amber-50 text-amber-600' :
                'bg-red-50 text-red-600'
              }`}>
                {issueResult.ai_resolution?.confidence?.toUpperCase()} confidence
              </span>
            </div>
            <div className="space-y-2">
              {(issueResult.ai_resolution?.steps || []).map((s, i) => (
                <div key={i} className="flex gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <span className="text-blue-600 font-bold text-sm min-w-[24px]">{i + 1}.</span>
                  <p className="text-sm text-gray-700">{s}</p>
                </div>
              ))}
            </div>
            {issueResult.ai_resolution?.source && (
              <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-200"><BookOpen size={13} className="inline mr-1" />Source: {issueResult.ai_resolution.source}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="glass p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Did you resolve it?</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-emerald-600 mb-2"><CheckCircle size={14} className="inline mr-1" />Yes, I resolved it (select how):</p>
                <div className="flex flex-wrap gap-2">
                  {RESOLUTION_TYPES.map(rt => (
                    <button
                      key={rt}
                      onClick={() => handleSelfResolve(rt)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-sm hover:bg-emerald-100 border border-emerald-200"
                    >
                      {rt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <button
                  onClick={handleEscalate}
                  className="w-full py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-semibold hover:bg-red-100 flex items-center justify-center gap-2"
                >
                  <ArrowUpCircle size={18} />
                  No — Escalate to Supervisor
                </button>
                <p className="text-xs text-gray-500 mt-1 text-center">Supervisor will be notified with full context + what AI recommended + what you tried</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 4 && (
        <div className="glass p-8 text-center animate-in">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Issue Logged</h2>
          <p className="text-gray-500 mt-2">
            {issueResult?.severity === 'critical' || issueResult?.severity === 'high'
              ? 'Your supervisor has been notified and will follow up.'
              : 'The issue has been recorded in the system.'}
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => navigate('/app')} className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200">
              Back to Dashboard
            </button>
            <button onClick={() => { setStep(1); setIssueType(''); setQuickTags([]); setDescription(''); setIssueResult(null); }}
              className="px-6 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-2">
              <RotateCcw size={14} /> Report Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
