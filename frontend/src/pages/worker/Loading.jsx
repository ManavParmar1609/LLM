import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { LoadPatternVisual, ProgressBar } from '../../components/Shared';
import { Package, AlertTriangle, CheckCircle, BookOpen } from 'lucide-react';

export default function Loading() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSOP, setShowSOP] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [sealNumber, setSealNumber] = useState('');

  useEffect(() => {
    api.getOrders({ operator_id: user.id, status: 'in_progress' }).then(orders => {
      const outbound = orders.find(o => o.type === 'outbound');
      if (outbound) {
        api.getOrder(outbound.id).then(o => {
          setOrder(o);
          setItems(o.items.map(it => ({ ...it, loaded: it.actual_quantity || 0 })));
          setLoading(false);
        });
      } else setLoading(false);
    });
  }, [user.id]);

  const handleAddCount = (itemId, count) => {
    setItems(prev => prev.map(it => {
      if (it.id === itemId) {
        const newLoaded = Math.max(0, Math.min(it.loaded + count, it.expected_quantity));
        api.updateOrderItem(order.id, { product_id: it.product_id, actual_quantity: newLoaded });
        return { ...it, loaded: newLoaded };
      }
      return it;
    }));
  };

  const handleSetCount = (itemId, value) => {
    const v = parseInt(value);
    if (isNaN(v) || v < 0) return;
    setItems(prev => prev.map(it => {
      if (it.id === itemId) {
        const clamped = Math.min(v, it.expected_quantity);
        api.updateOrderItem(order.id, { product_id: it.product_id, actual_quantity: clamped });
        return { ...it, loaded: clamped };
      }
      return it;
    }));
  };

  const handleComplete = async () => {
    await api.completeOrder(order.id, { order_id: order.id, seal_number: sealNumber, notes: '' });
    navigate('/app');
  };

  const totalExpected = items.reduce((s, i) => s + i.expected_quantity, 0);
  const totalLoaded = items.reduce((s, i) => s + i.loaded, 0);
  const allDone = totalLoaded >= totalExpected;

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;
  if (!order) return (
    <div className="text-center py-16">
      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-lg">No active outbound (loading) assignment.</p>
      <p className="text-sm text-gray-400 mt-1">Your current order may be inbound — check the Unloading tab.</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" /> Loading — Dock {order.door_number}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{order.company_name} · {order.order_number} · Trailer {order.trailer_number}</p>
          <p className="text-xs text-gray-400">Carrier: {order.carrier_name} · Outbound shipment</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowSOP(!showSOP)} className="px-3 sm:px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm text-gray-900 flex items-center gap-1.5">
            <BookOpen size={14} /> SOP
          </button>
          <button onClick={() => navigate('/app/resolve/new')} className="px-3 sm:px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs sm:text-sm flex items-center gap-1.5">
            <AlertTriangle size={14} /> Report Issue
          </button>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="glass p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900">Overall Loading Progress</span>
          <span className="text-sm font-semibold text-gray-900">{Math.round(totalLoaded / totalExpected * 100)}%</span>
        </div>
        <ProgressBar current={totalLoaded} total={totalExpected} />
        <div className="flex justify-between text-xs text-gray-500 mt-1.5">
          <span>{totalLoaded} cases loaded</span>
          <span>Target: {totalExpected} cases</span>
        </div>
      </div>

      {/* Load Pattern */}
      {order.load_pattern && <LoadPatternVisual pattern={order.load_pattern} companyName={order.company_name} />}

      {/* SOP Panel */}
      {showSOP && order.sop_rules && (
        <div className="glass p-4 sm:p-5 border-l-4 border-l-blue-500 animate-in">
          <h3 className="text-sm font-semibold text-blue-600 mb-3">{order.company_name} — Standard Operating Procedures</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {Object.entries(order.sop_rules).map(([key, val]) => (
              <div key={key} className="p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-blue-600 font-semibold uppercase mb-1">{key.replace('_', ' ')}</p>
                <p className="text-gray-700">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Items */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Products to Load ({items.length})</h3>
        {items.map(item => {
          const done = item.loaded >= item.expected_quantity;
          return (
            <div key={item.id} className={`glass-sm p-4 sm:p-5 ${done ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div>
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    {done && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    {item.product_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    SKU: <span className="font-mono">{item.sku}</span> · {item.category} · {item.weight_per_case}lb/case · {item.cases_per_pallet}/pallet
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-bold ${done ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {item.loaded} <span className="text-sm font-normal text-gray-500">/ {item.expected_quantity}</span>
                  </p>
                  <p className="text-[10px] text-gray-500">cases</p>
                </div>
              </div>

              <ProgressBar current={item.loaded} total={item.expected_quantity} />

              {/* Tap counter */}
              {!done && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {[1, 5, 10, 25].map(n => (
                    <button
                      key={n}
                      onClick={() => handleAddCount(item.id, n)}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-900 text-sm font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors"
                    >
                      +{n}
                    </button>
                  ))}
                  <button
                    onClick={() => handleAddCount(item.id, -1)}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                  >−1</button>
                  <input
                    type="number"
                    placeholder="Set"
                    className="w-16 sm:w-20 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:border-blue-500"
                    onKeyDown={e => {
                      if (e.key === 'Enter') { handleSetCount(item.id, e.target.value); e.target.value = ''; }
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Complete Load */}
      {allDone && !showComplete && (
        <button
          onClick={() => setShowComplete(true)}
          className="w-full py-4 bg-emerald-500 rounded-2xl font-bold text-white text-lg hover:opacity-90 transition-opacity"
        >
          All Products Loaded — Complete Load
        </button>
      )}

      {showComplete && (
        <div className="glass p-5 sm:p-6 animate-in border-2 border-emerald-200">
          <h3 className="text-lg font-bold text-emerald-600 mb-4">Load Completion Sign-Off</h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-gray-50 text-sm">
              <p className="text-gray-500">All SKUs loaded and verified:</p>
              {items.map(it => (
                <p key={it.id} className="text-emerald-600 ml-4"><CheckCircle size={13} className="inline mr-1" />{it.sku} — {it.loaded} cases</p>
              ))}
            </div>
            <div>
              <label className="text-sm text-gray-700 block mb-1">Outbound Seal Number</label>
              <input
                value={sealNumber}
                onChange={e => setSealNumber(e.target.value)}
                placeholder="Enter seal number..."
                className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400"
              />
            </div>
            <button onClick={handleComplete} className="w-full py-3 bg-emerald-500 rounded-xl font-semibold text-white hover:opacity-90">
              Confirm Load Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
