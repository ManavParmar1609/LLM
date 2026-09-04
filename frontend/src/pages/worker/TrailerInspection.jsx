import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { CheckCircle, XCircle, Thermometer, LockKeyhole, Sparkles, ScanSearch, FileText } from 'lucide-react';

export default function TrailerInspection() {
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [form, setForm] = useState({
    seal_condition: '', interior_cleanliness: '', interior_temperature: '',
    visible_damage: '', notes: ''
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOrders({ operator_id: user.id, status: 'in_progress' }).then(orders => {
      setOrder(orders[0] || null);
      setLoading(false);
    });
  }, [user.id]);

  const handleSubmit = async () => {
    const data = {
      order_id: order?.id, dock_door_id: order?.dock_door_id,
      operator_id: user.id, ...form,
      interior_temperature: form.interior_temperature ? parseFloat(form.interior_temperature) : null,
    };
    const res = await api.createInspection(data);
    setResult(res);
  };

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;

  if (result) {
    return (
      <div className="max-w-xl mx-auto animate-in">
        <div className={`glass p-8 text-center ${result.overall_pass ? 'border-emerald-200' : 'border-red-300'} border-2`}>
          {result.overall_pass ? (
            <>
              <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-emerald-600">Inspection Passed</h2>
              <p className="text-gray-500 mt-2">Trailer is cleared for loading/unloading. Proceed to your assignment.</p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-red-600">Inspection Failed</h2>
              <p className="text-gray-500 mt-2">One or more checks did not pass. Review the issues and escalate to your supervisor if needed.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const opts = (field, options) => (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setForm(f => ({ ...f, [field]: opt.value }))}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            form[field] === opt.value
              ? opt.good ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trailer Inspection</h1>
        {order && <p className="text-gray-500 mt-1">Dock {order.door_number} · Trailer {order.trailer_number} · {order.company_name}</p>}
      </div>

      <div className="glass p-6 space-y-6">
        {/* Seal Condition */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2"><LockKeyhole size={16} className="inline mr-1" />Seal Condition</label>
          {opts('seal_condition', [
            { value: 'intact', label: 'Intact', good: true },
            { value: 'broken', label: 'Broken', good: false },
            { value: 'missing', label: 'Missing', good: false },
          ])}
        </div>

        {/* Interior Cleanliness */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2"><Sparkles size={16} className="inline mr-1" />Interior Cleanliness</label>
          {opts('interior_cleanliness', [
            { value: 'clean', label: 'Clean', good: true },
            { value: 'debris', label: 'Debris', good: false },
            { value: 'odor', label: 'Odor', good: false },
            { value: 'wet', label: 'Wet', good: false },
          ])}
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <Thermometer className="w-4 h-4 inline mr-1" /> Interior Temperature (°F)
          </label>
          <input
            type="number"
            value={form.interior_temperature}
            onChange={e => setForm(f => ({ ...f, interior_temperature: e.target.value }))}
            placeholder="Enter temperature reading..."
            className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-[#0071e3]/20"
          />
          <p className="text-xs text-gray-500 mt-1">Leave blank for dry goods trailers</p>
        </div>

        {/* Visible Damage */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2"><ScanSearch size={16} className="inline mr-1" />Visible Damage</label>
          {opts('visible_damage', [
            { value: 'none', label: 'None', good: true },
            { value: 'wall', label: 'Wall Damage', good: false },
            { value: 'floor', label: 'Floor Damage', good: false },
            { value: 'ceiling', label: 'Ceiling Damage', good: false },
          ])}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2"><FileText size={16} className="inline mr-1" />Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any additional observations..."
            className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-[#0071e3]/20 h-20 resize-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!form.seal_condition || !form.interior_cleanliness || !form.visible_damage}
          className="w-full py-3 bg-blue-600 rounded-xl font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Submit Inspection
        </button>
      </div>
    </div>
  );
}
