import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { Send, Sparkles, Bot, User, Lightbulb, Thermometer, MapPin, Package, AlertTriangle, HelpCircle, BookOpen } from 'lucide-react';

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [order, setOrder] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.getChatHistory(user.id),
      api.getOrders({ operator_id: user.id, status: 'in_progress' }),
    ]).then(([history, orders]) => {
      setMessages(history);
      setOrder(orders[0] || null);
    });
  }, [user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', message: msg, created_at: new Date().toISOString() }]);
    setSending(true);

    try {
      const res = await api.sendChat({
        user_id: user.id,
        message: msg,
        company_id: order?.company_id,
        product_category: order?.items?.[0]?.category,
      });

      setMessages(prev => [...prev, {
        role: 'assistant', message: res.response,
        source_reference: res.source, created_at: new Date().toISOString()
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant', message: "Sorry, I couldn't process that right now. Try again or ask your supervisor for help.",
        created_at: new Date().toISOString()
      }]);
    }
    setSending(false);
  };

  // Context-aware quick questions based on current assignment
  const quickCategories = [
    {
      label: 'Procedures',
      icon: Lightbulb,
      color: 'text-amber-500 bg-amber-50',
      questions: [
        order ? `What's the SOP for ${order.company_name}?` : "What are the standard procedures?",
        "What do I do with a damaged pallet?",
        "How do I handle a paperwork mismatch?",
      ]
    },
    {
      label: 'Temperature',
      icon: Thermometer,
      color: 'text-blue-500 bg-blue-50',
      questions: [
        "What are the temperature thresholds?",
        "What if the reefer isn't running?",
        "Temp is borderline — what do I do?",
      ]
    },
    {
      label: 'Locations',
      icon: MapPin,
      color: 'text-emerald-500 bg-emerald-50',
      questions: [
        "Where are the slip sheets?",
        "Where's the scanner charging station?",
        "Where's the damage quarantine area?",
      ]
    },
    {
      label: 'Loading',
      icon: Package,
      color: 'text-purple-500 bg-purple-50',
      questions: [
        order ? `What's the load pattern for ${order.company_name}?` : "Show me the load pattern",
        order ? `What's the count tolerance for ${order.company_name}?` : "What's the count tolerance?",
        "How high can I stack pallets?",
      ]
    },
    {
      label: 'Troubleshooting',
      icon: AlertTriangle,
      color: 'text-red-500 bg-red-50',
      questions: [
        "Barcode won't scan — help",
        "BOL doesn't match the product",
        "Product looks thawed/refrozen",
      ]
    },
  ];

  return (
    <div className="apple-chat flex flex-col h-[calc(100vh-7rem)] animate-in">
      {/* Header */}
      <div className="apple-chat-header flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">AI Assistant</h1>
          <p className="text-xs text-gray-500">
            {order ? `Helping with ${order.company_name} - Dock ${order.door_number}` : 'Ask about SOPs, procedures, locations & more'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="apple-chat-scroll flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 && (
          <div className="apple-chat-empty py-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">What can I help with?</h3>
              <p className="text-sm text-gray-400 mt-1">
                {order ? `I know you're working on the ${order.company_name} order. Ask me anything.` : 'Tap a topic below or type your question.'}
              </p>
            </div>
            <div className="space-y-4 max-w-lg mx-auto">
              {quickCategories.map(cat => (
                <div key={cat.label} className="apple-chat-category">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-6 h-6 rounded-lg ${cat.color} flex items-center justify-center`}>
                      <cat.icon size={14} />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.questions.map(q => (
                      <button
                        key={q}
                        onClick={() => handleSend(q)}
                        className="apple-prompt px-3 py-1.5 border text-gray-600 text-xs transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''} animate-in`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div className={`apple-message max-w-[75%] px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'glass-sm'
            }`}>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.message.split(/(\*\*.*?\*\*)/g).map((part, j) =>
                  part.startsWith('**') && part.endsWith('**')
                    ? <strong key={j} className="text-blue-600">{part.slice(2, -2)}</strong>
                    : <span key={j}>{part}</span>
                )}
              </div>
              {msg.source_reference && (
                <p className="text-xs text-gray-500 mt-2 pt-1 border-t border-gray-200"><BookOpen size={13} className="inline mr-1" />{msg.source_reference}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                <User size={16} className="text-gray-700" />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex gap-3 animate-in">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="glass-sm rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="apple-composer mt-4">
        <div className="apple-composer-box flex gap-2 items-center px-4 py-2 transition-all">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={order ? `Ask about ${order.company_name}, procedures, locations...` : 'Ask anything...'}
            className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none text-sm py-1"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-30 transition-all disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1.5 text-center">Responses are based on company SOPs and the knowledge base. Verify critical decisions with your supervisor.</p>
      </div>
    </div>
  );
}
