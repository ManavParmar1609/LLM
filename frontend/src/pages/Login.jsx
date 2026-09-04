import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { BrandMark } from '../components/Shared';
import { Truck, Shield, ChevronLeft, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const doLogin = (u) => {
    login(u);
    navigate('/app');
  };

  useEffect(() => {
    if (!role) return;
    setLoading(true);
    api.getUsers(role).then(u => { setUsers(u); setLoading(false); });
  }, [role]);

  const roleGradients = {
    operator: 'from-blue-500 to-blue-600',
    supervisor: 'from-amber-500 to-orange-500',
  };

  return (
    <div className="apple-login min-h-screen flex items-center justify-center p-6">
      <div className="apple-login-panel w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6"><BrandMark subtitle="Operations intelligence" /></div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Welcome back</h1>
          <p className="text-stone-400 text-base mt-2">
            {!role ? "Choose how you'd like to sign in today" : `Signing in as ${role === 'operator' ? 'a dock worker' : 'a supervisor'}`}
          </p>
        </div>

        {!role ? (
          <div className="space-y-4 animate-in">
            {/* Worker role card */}
            <button
              onClick={() => setRole('operator')}
              className="apple-role-card w-full group cursor-pointer bg-white border border-stone-200/80 p-6 flex items-center gap-5 transition-all duration-200"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:shadow-lg group-hover:shadow-blue-500/30 transition-shadow duration-200">
                <Truck className="w-7 h-7 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-lg font-semibold text-stone-900">Dock Worker</h3>
                <p className="text-stone-400 text-sm mt-0.5">Inspect trailers, load & unload freight, report issues with AI assistance</p>
              </div>
              <ArrowRight className="w-5 h-5 text-stone-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200" />
            </button>

            {/* Supervisor role card */}
            <button
              onClick={() => setRole('supervisor')}
              className="apple-role-card w-full group cursor-pointer bg-white border border-stone-200/80 p-6 flex items-center gap-5 transition-all duration-200"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:shadow-lg group-hover:shadow-amber-500/30 transition-shadow duration-200">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-lg font-semibold text-stone-900">Supervisor</h3>
                <p className="text-stone-400 text-sm mt-0.5">Monitor the floor, manage escalated issues, review analytics & broadcast alerts</p>
              </div>
              <ArrowRight className="w-5 h-5 text-stone-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all duration-200" />
            </button>
          </div>
        ) : (
          <div className="animate-in">
            <button
              onClick={() => { setRole(null); setUsers([]); }}
              className="text-stone-400 hover:text-stone-700 text-sm mb-6 flex items-center gap-1.5 group transition-colors duration-150"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-150" />
              Back to role selection
            </button>
            <h2 className="text-xl font-semibold text-stone-900 mb-1">
              Who are you?
            </h2>
            <p className="text-sm text-stone-400 mb-5">Select your profile to jump in</p>

            {loading ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="w-7 h-7 border-3 border-stone-200 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-stone-400 text-sm">Loading team…</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => doLogin(u)}
                    className="apple-role-card w-full bg-white border border-stone-200/80 p-4 flex items-center justify-between transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${roleGradients[role] || 'from-blue-500 to-blue-600'} flex items-center justify-center text-sm font-bold text-white shadow-sm`}>
                        {u.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-stone-900">{u.name}</p>
                        <p className="text-xs text-stone-400">{u.employee_id} · {u.experience_level || u.zone || u.shift}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all duration-200" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-stone-300 mt-12">DockIQ.AI · Smarter docks, smoother shifts</p>
      </div>
    </div>
  );
}
