import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Circle, MessageSquare, User } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function AgentControl() {
  const { user } = useAuth();
  const token = localStorage.getItem('admin_token');
  const isAdmin = user?.role === 'Super Admin' || user?.department === 'admin';

  const [agents, setAgents]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState({}); // agentId → true while toggling

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/support/admin/agents/availability`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleAgent = async (agentId, currentlyOnline) => {
    if (!isAdmin) return;
    setToggling(p => ({ ...p, [agentId]: true }));
    try {
      await fetch(`${API_BASE}/support/admin/agents/${agentId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_online: !currentlyOnline }),
      });
      setAgents(prev => prev.map(a => {
        if (a.id !== agentId) return a;
        return {
          ...a,
          agent_availability: { ...a.agent_availability, is_online: !currentlyOnline },
        };
      }));
    } catch { /* silent */ }
    setToggling(p => ({ ...p, [agentId]: false }));
  };

  const onlineCount  = agents.filter(a => a.agent_availability?.is_online).length;
  const offlineCount = agents.length - onlineCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agent Availability Control</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {onlineCount} online · {offlineCount} offline · {agents.length} total agents
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-amber-700 font-medium">
            ⚠️ Only admin accounts can toggle agent availability.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Agent','Agent ID','Department','Active Chats','Last Toggle','Status'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.map(agent => {
                const avail    = agent.agent_availability || {};
                const isOnline = avail.is_online;
                const isMe     = agent.id === user?.id;

                return (
                  <tr key={agent.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Agent name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                            {agent.name?.charAt(0) || '?'}
                          </div>
                          {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {agent.name}
                            {isMe && <span className="ml-1.5 text-[10px] text-blue-600 font-medium">(you)</span>}
                          </p>
                          <p className="text-xs text-gray-400">{agent.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Agent ID */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500">{agent.id?.slice(0, 8)}...</span>
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3">
                      <span className="capitalize text-gray-700 text-xs">{agent.department || agent.role || '—'}</span>
                    </td>

                    {/* Active chats */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-gray-400" />
                        <span className={`font-semibold ${avail.active_chat_count > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                          {avail.active_chat_count || 0}
                        </span>
                        <span className="text-gray-300 text-xs">/ 5</span>
                      </div>
                    </td>

                    {/* Last toggle */}
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {timeAgo(avail.toggled_at)}
                    </td>

                    {/* Toggle switch */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleAgent(agent.id, isOnline)}
                          disabled={!isAdmin || toggling[agent.id]}
                          title={isAdmin ? (isOnline ? 'Set Offline' : 'Set Online') : 'Admin only'}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none
                            ${!isAdmin ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                            ${isOnline ? 'bg-green-500' : 'bg-gray-300'}
                            ${toggling[agent.id] ? 'opacity-60' : ''}
                          `}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200
                            ${isOnline ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`}
                          />
                        </button>
                        <span className={`text-xs font-semibold ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                          {toggling[agent.id] ? '...' : isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {agents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <User size={28} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No agents found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
