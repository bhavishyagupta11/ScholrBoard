/**
 * AdminSupportPage.jsx — Admin support ticket management
 *
 * Admin can:
 *  - View all tickets with filtering
 *  - Assign tickets to faculty/staff
 *  - Change ticket status
 *  - Resolve and close tickets
 *  - View full message threads
 *  - View contact form messages (existing feature)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy, Users, CheckCircle, XCircle, ChevronRight, X, Send,
  RefreshCw, AlertCircle, Tag, Filter, UserCheck, Clock, MessageSquare
} from 'lucide-react';
import CustomSelect from '../components/common/CustomSelect';
import ticketsApi from '../api/tickets.api.js';
import supportApi from '../api/support.api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const STATUS_CONFIG = {
  open:                  { label: 'Open',               color: 'var(--primary-blue)',   bg: 'rgba(59,130,246,0.15)',  icon: '🔵' },
  in_progress:           { label: 'In Progress',         color: 'var(--warning-color)',  bg: 'rgba(234,179,8,0.15)',   icon: '🟡' },
  waiting_for_response:  { label: 'Waiting',             color: '#f97316',               bg: 'rgba(249,115,22,0.15)', icon: '🟠' },
  resolved:              { label: 'Resolved',            color: 'var(--success-color)',  bg: 'rgba(34,197,94,0.15)',  icon: '🟢' },
  closed:                { label: 'Closed',              color: 'var(--text-secondary)', bg: 'rgba(100,116,139,0.15)',icon: '⚫' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TicketDetailModal({ ticket: initialTicket, onClose, onUpdate }) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    ticketsApi.getTicketById(ticket._id)
      .then(res => { setTicket(res.ticket); setMessages(res.messages || []); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [ticket._id]);

  const sendReply = async (isInternal = false) => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await ticketsApi.replyToTicket(ticket._id, { message: reply.trim(), isInternal });
      setMessages(prev => [...prev, res.ticketMessage]);
      setReply('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status) => {
    setStatusUpdating(true);
    try {
      const res = await ticketsApi.updateTicketStatus(ticket._id, status, resolutionNote || undefined);
      setTicket(res.ticket);
      onUpdate?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="card p-6 w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
              {ticket.createdBy && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ticket.createdBy.name} ({ticket.createdBy.role})</span>}
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{ticket.subject}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Category: {ticket.category} · Priority: {ticket.priority} · Flow: {ticket.flow?.replace(/_/g, ' ')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white flex-shrink-0 ml-4"><X size={20} /></button>
        </div>

        {/* Admin actions */}
        {ticket.status !== 'closed' && (
          <div className="flex flex-wrap gap-2 mb-4">
            {ticket.status !== 'resolved' && (
              <>
                <button onClick={() => changeStatus('in_progress')} disabled={statusUpdating} className="btn btn-outline text-xs py-1">
                  Mark In Progress
                </button>
                <button onClick={() => changeStatus('resolved')} disabled={statusUpdating} className="btn btn-outline text-xs py-1" style={{ color: 'var(--success-color)', borderColor: 'var(--success-color)' }}>
                  <CheckCircle size={12} className="inline mr-1" /> Resolve
                </button>
              </>
            )}
            <button onClick={() => changeStatus('closed')} disabled={statusUpdating} className="btn btn-outline text-xs py-1" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}>
              <XCircle size={12} className="inline mr-1" /> Close
            </button>
          </div>
        )}

        {error && <div className="mb-3 text-sm p-2 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)' }}>{error}</div>}

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 custom-scrollbar" style={{ minHeight: '200px', maxHeight: '350px' }}>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-16 w-full" />)}</div>
          ) : messages.map(msg => {
            const isMe = String(msg.senderId?._id) === String(user?._id);
            return (
              <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-xl text-sm ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${msg.isInternal ? 'border-2 border-dashed' : ''}`}
                  style={{
                    background: msg.isInternal ? 'rgba(234,179,8,0.1)' : isMe ? 'var(--accent)' : 'var(--surface-card)',
                    color: isMe && !msg.isInternal ? '#fff' : 'var(--text-primary)',
                    borderColor: msg.isInternal ? 'var(--warning-color)' : 'transparent',
                  }}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-semibold" style={{ color: isMe && !msg.isInternal ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                      {msg.senderId?.name}
                    </span>
                    {msg.isInternal && <span className="text-xs px-1 py-0.5 rounded" style={{ background: 'var(--warning-color)', color: '#000' }}>Internal Note</span>}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.message}</div>
                  <div className="text-xs mt-1 opacity-60">{new Date(msg.createdAt).toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Admin reply box */}
        {ticket.status !== 'closed' && (
          <div className="space-y-2">
            <textarea
              className="input w-full resize-none"
              rows={2}
              placeholder="Type reply to send to ticket creator..."
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => sendReply(false)} disabled={sending || !reply.trim()} className="btn btn-primary flex-1 text-sm">
                {sending ? <RefreshCw size={14} className="animate-spin inline mr-1" /> : <Send size={14} className="inline mr-1" />} Send Reply
              </button>
              <button onClick={() => sendReply(true)} disabled={sending || !reply.trim()} className="btn btn-outline flex-1 text-sm" style={{ color: 'var(--warning-color)', borderColor: 'var(--warning-color)' }}>
                🔒 Internal Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminSupportPage() {
  const [activeTab, setActiveTab] = useState('tickets');
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({});
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFlow, setFilterFlow] = useState('');

  const loadTickets = useCallback(() => {
    setLoading(true);
    setError('');
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterFlow) params.flow = filterFlow;
    ticketsApi.getAllTickets(params)
      .then(res => {
        setTickets(res.tickets || []);
        setSummary(res.summary || {});
      })
      .catch(err => setError(err.message || 'Failed to load tickets'))
      .finally(() => setLoading(false));
  }, [filterStatus, filterFlow]);

  const loadMessages = useCallback(() => {
    setLoading(true);
    supportApi.getContactMessages()
      .then(res => setMessages(res.messages || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'tickets') loadTickets();
    else loadMessages();
  }, [activeTab, loadTickets, loadMessages]);

  const FLOWS = [
    { value: '', label: 'All Flows' },
    { value: 'student_to_faculty', label: 'Student → Faculty' },
    { value: 'student_to_admin',   label: 'Student → Admin' },
    { value: 'faculty_to_admin',   label: 'Faculty → Admin' },
    { value: 'coordinator_to_admin', label: 'Coordinator → Admin' },
  ];

  return (
    <div className="space-y-6">
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => { setSelectedTicket(null); loadTickets(); }}
          onUpdate={loadTickets}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
          <LifeBuoy size={28} style={{ color: 'var(--accent)' }} /> Support Management
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Manage all support tickets and contact form submissions</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open', value: summary.open, color: 'var(--primary-blue)' },
          { label: 'In Progress', value: summary.in_progress, color: 'var(--warning-color)' },
          { label: 'Resolved', value: summary.resolved, color: 'var(--success-color)' },
          { label: 'Total', value: summary.total, color: 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.label}</div>
            <div className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value ?? '–'}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {[{ id: 'tickets', label: '🎫 Tickets' }, { id: 'contact', label: '📩 Contact Messages' }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-sm font-semibold transition-colors -mb-px"
            style={{
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'tickets' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Filter:</span>
            </div>
            <CustomSelect
              className="w-40 text-sm"
              options={[
                { value: '', label: 'All Statuses' },
                ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))
              ]}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            />
            <CustomSelect
              className="w-48 text-sm"
              options={FLOWS.map(f => ({ value: f.value, label: f.label }))}
              value={filterFlow}
              onChange={e => setFilterFlow(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-20 w-full rounded-xl" />)}</div>
          ) : tickets.length === 0 ? (
            <div className="card p-12 text-center">
              <MessageSquare size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No tickets found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(ticket => (
                <div
                  key={ticket._id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="card p-4 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{ticket.ticketNumber}</span>
                        <StatusBadge status={ticket.status} />
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'var(--bg-medium)', color: 'var(--text-secondary)' }}>
                          {ticket.flow?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-medium)', color: 'var(--text-secondary)' }}>
                          <Tag size={10} className="inline mr-1" />{ticket.category}
                        </span>
                      </div>
                      <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ticket.subject}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {ticket.createdBy && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}><Users size={10} className="inline mr-1" />{ticket.createdBy.name}</span>}
                        {ticket.assignedTo && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}><UserCheck size={10} className="inline mr-1" />{ticket.assignedTo.name}</span>}
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}><Clock size={10} className="inline mr-1" />{new Date(ticket.lastActivityAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'contact' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 w-full rounded-xl" />)}</div>
          ) : messages.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No contact messages</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg._id} className="card p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{msg.name}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{msg.email} · {msg.subject}</p>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(msg.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm mt-2 p-3 rounded-lg" style={{ background: 'var(--bg-medium)', color: 'var(--text-secondary)' }}>{msg.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
