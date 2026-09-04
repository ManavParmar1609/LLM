import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { ProgressBar } from '../../components/Shared';
import { PackageOpen, Thermometer, AlertTriangle, CheckCircle, ClipboardCheck } from 'lucide-react';

export default function Unloading() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tempReading, setTempReading] = useState('');
  const [tempResult, setTempResult] = useState(null);
  const [checklist, setChecklist] = useState({
    pallet_condition: null, packaging_integrity: null, label_readability: null,
    product_matches_bol: null, lot_verified: null
  });

  useEffect(() => {
    api.getOrders({ operator_id: user.id, status: 'in_progress' }).then(orders => {
      const inbound = orders.find(o => o.type === 'inbound');
      if (inbound) {
        api.getOrder(inbound.id).then(o => {
          setOrder(o);
          setItems(o.items.map(it => ({ ...it, received: it.actual_quantity || 0 })));
          setLoading(false);
        });
      } else setLoading(false);
    });
  }, [user.id]);

  const handleTempCheck = () => {
    const temp = parseFloat(tempReading);
    if (isNaN(temp)) return;
    // Check against first product's threshold
    const product = items[0];
    if (!product || product.temp_max === null) {
      setTempResult({ status: 'na', message: 'No temperature requirement for dry goods.' });
      return;
    }
    const delta = temp - product.temp_max;
    if (delta > 10) {
      setTempResult({ status: 'critical', message: `CRITICAL — ${temp}°F is ${delta.toFixed(1)}°F above threshold (≤${product.temp_max}°F). DO NOT UNLOAD. Close trailer doors immediately.`, temp, delta });
    } else if (delta > 5) {
      setTempResult({ status: 'warning', message: `WARNING — ${temp}°F is ${delta.toFixed(1)}°F above threshold. Re-check in 10 minutes. Close doors to prevent further warming.`, temp, delta });
    } else if (delta > 0) {
      setTempResult({ status: 'marginal', message: `Marginal — ${temp}°F is slightly above threshold. Monitor closely and proceed with caution.`, temp, delta });
    } else {
      setTempResult({ status: 'ok', message: `Temperature OK — ${temp}°F is within acceptable range (≤${product.temp_max}°F).`, temp, delta: 0 });
    }
  };

  const handleAddCount = (itemId, count) => {
    setItems(prev => prev.map(it => {
      if (it.id === itemId) {
        const newCount = Math.max(0, it.received + count);
        api.updateOrderItem(order.id, { product_id: it.product_id, actual_quantity: newCount });
        return { ...it, received: newCount };
      }
      return it;
    }));
  };

  const handleComplete = async () => {
    // Check for count discrepancies
    const discrepancies = items.filter(it => {
      const tol = order.count_tolerance || 0.02;
      const diff = Math.abs(it.received - it.expected_quantity);
      return diff / it.expected_quantity > tol;
    });
    if (discrepancies.length > 0) {
      for (const d of discrepancies) {
        await api.createIssue({
          order_id: order.id, dock_door_id: order.dock_door_id, operator_id: user.id,
          issue_type: 'Count Shortage', description: `Expected ${d.expected_quantity}, received ${d.received} (${d.product_name})`,
          product_id: d.product_id, company_id: order.company_id, carrier_id: order.carrier_id,
          count_expected: d.expected_quantity, count_actual: d.received, quantity_affected: d.expected_quantity - d.received
        });
      }
    }
    await api.completeOrder(order.id, { order_id: order.id });
    navigate('/app');
  };

  const totalExpected = items.reduce((s, i) => s + i.expected_quantity, 0);
  const totalReceived = items.reduce((s, i) => s + i.received, 0);
  const allCounted = items.every(it => it.received > 0);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;
  if (!order) return (
    <div className="text-center py-16 animate-in">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <PackageOpen className="w-8 h-8 text-gray-300" />
      </div>
      <p className="text-lg font-semibold text-gray-400">No inbound shipment assigned</p>
      <p className="text-sm text-gray-400 mt-1">Your current order is outbound — head to the <strong>Loading</strong> tab instead.</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PackageOpen className="w-6 h-6 text-emerald-600" /> Unloading — Dock {order.door_number}
          </h1>
          <p className="text-gray-500 mt-1">{order.company_name} · {order.order_number} · Carrier: {order.carrier_name}</p>
        </div>
        <button onClick={() => navigate('/app/resolve/new')} className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> Report Issue
        </button>
      </div>

      {/* Temperature Check */}
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-blue-600" /> Temperature Check
        </h3>
        <div className="flex gap-3">
          <input
            type="number" step="0.1" value={tempReading}
            onChange={e => setTempReading(e.target.value)}
            placeholder="Enter probe reading (°F)..."
            className="flex-1 bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-[#0071e3]/20"
          />
          <button onClick={handleTempCheck} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors">
            Check
          </button>
        </div>
        {tempResult && (
          <div className={`mt-3 p-4 rounded-xl border animate-in ${
            tempResult.status === 'critical' ? 'bg-red-50 border-red-200 glow-red' :
            tempResult.status === 'warning' ? 'bg-orange-50 border-orange-200 glow-orange' :
            tempResult.status === 'marginal' ? 'bg-amber-50 border-amber-200' :
            'bg-emerald-50 border-emerald-200 glow-green'
          }`}>
            <p className={`text-sm font-medium ${
              tempResult.status === 'critical' ? 'text-red-600' :
              tempResult.status === 'warning' ? 'text-orange-600' :
              tempResult.status === 'marginal' ? 'text-amber-600' :
              'text-emerald-600'
            }`}>{tempResult.message}</p>
            {tempResult.status === 'critical' && (
              <button onClick={() => navigate('/app/resolve/new')} className="mt-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm hover:bg-red-100">
                Auto-Report Temperature Issue
              </button>
            )}
          </div>
        )}
      </div>

      {/* Receiving Inspection Checklist */}
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-blue-600" /> Receiving Inspection Checklist
        </h3>
        <div className="space-y-2">
          {[
            { key: 'pallet_condition', label: 'Pallet condition (intact?)' },
            { key: 'packaging_integrity', label: 'Packaging integrity (sealed, not punctured?)' },
            { key: 'label_readability', label: 'Labels readable and matching?' },
            { key: 'product_matches_bol', label: 'Product matches BOL?' },
            { key: 'lot_verified', label: 'Lot/expiry verified?' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <span className="text-sm text-gray-700">{item.label}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setChecklist(c => ({ ...c, [item.key]: true }))}
                  className={`px-3 py-1 rounded-lg text-sm ${checklist[item.key] === true ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                >Yes</button>
                <button
                  onClick={() => setChecklist(c => ({ ...c, [item.key]: false }))}
                  className={`px-3 py-1 rounded-lg text-sm ${checklist[item.key] === false ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                >No</button>
              </div>
            </div>
          ))}
        </div>
        {Object.values(checklist).some(v => v === false) && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm animate-in">
            One or more checks failed. Consider reporting an issue.
            <button onClick={() => navigate('/app/resolve/new')} className="ml-2 underline">Report Issue →</button>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="glass p-5">
        <ProgressBar current={totalReceived} total={totalExpected} label="Overall Receiving Progress" />
      </div>

      {/* Product Count */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Products to Receive</h3>
        {items.map(item => {
          const tol = order.count_tolerance || 0.02;
          const diffPct = item.received > 0 ? Math.abs(item.received - item.expected_quantity) / item.expected_quantity : 0;
          const withinTol = diffPct <= tol;
          return (
            <div key={item.id} className="glass-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    {item.received > 0 && item.received >= item.expected_quantity && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    {item.product_name}
                  </p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">SKU: {item.sku} · Expected: {item.expected_quantity} cases</p>
                </div>
                {item.received > 0 && !withinTol && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                    {item.received < item.expected_quantity ? 'SHORT' : 'OVER'} by {Math.abs(item.received - item.expected_quantity)}
                  </span>
                )}
              </div>

              <ProgressBar current={item.received} total={item.expected_quantity} />

              <div className="flex gap-2 mt-3">
                {[1, 5, 10, 25].map(n => (
                  <button key={n} onClick={() => handleAddCount(item.id, n)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200">+{n}</button>
                ))}
                <button onClick={() => handleAddCount(item.id, -1)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-red-600 text-sm font-medium hover:bg-gray-200">-1</button>
                <input
                  type="number" placeholder="Set total"
                  className="w-24 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-900 text-center"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = parseInt(e.target.value);
                      if (v >= 0) {
                        setItems(prev => prev.map(it => it.id === item.id ? { ...it, received: v } : it));
                        api.updateOrderItem(order.id, { product_id: item.product_id, actual_quantity: v });
                        e.target.value = '';
                      }
                    }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {allCounted && (
        <button onClick={handleComplete} className="w-full py-4 bg-emerald-500 rounded-2xl font-bold text-white text-lg hover:opacity-90 transition-opacity">
          Complete Receiving
        </button>
      )}
    </div>
  );
}
