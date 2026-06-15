/**
 * StudentSupportPage.jsx — Student support ticket portal
 *
 * Students can:
 *  - View their support tickets with status
 *  - Create new tickets directed to faculty or admin
 *  - View ticket thread and reply
 *
 * Designed to fail gracefully — if ticket API fails, page shows empty state.
 */
import { useState, useEffect, useCallback } from 'react';
import { LifeBuoy, Plus, X, ChevronRight, MessageSquare, Clock, CheckCircle2, AlertCircle, RefreshCw, Send, Tag } from 'lucide-react';
import ticketsApi from '../api/tickets.api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const STATUS_CONFIG = {
  open:                  { label: 'Open',               color: 'var(--primary-blue)',   bg: 'rgba(59,130,246,0.15)',  icon: '🔵' },
  in_progress:           { label: 'In Progress',         color: 'var(--warning-color)',  bg: 'rgba(234,179,8,0.15)',   icon: '🟡' },
  waiting_for_response:  { label: 'Waiting for Response',color: '#f97316',               bg: 'rgba(249,115,22,0.15)', icon: '🟠' },
  resolved:              { label: 'Resolved',            color: 'var(--success-color)',  bg: 'rgba(34,197,94,0.15)',  icon: '🟢' },
  closed:                { label: 'Closed',              color: 'var(--text-secondary)', bg: 'rgba(100,116,139,0.15)',icon: '⚫' },
};

const CATEGORIES = ['Academic', 'Technical', 'Administrative', 'Attendance', 'Scholarship', 'Placement', 'OD Request', 'Grievance', 'Other'];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function CreateTicketModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ subject: '', description: '', category: 'Academic', targetRole: 'admin', priority: 'medium' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      setError('Subject and description are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await ticketsApi.createTicket(form);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="card p-6 w-full max-w-lg relative" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>🎫 Create Support Ticket</h2>
        {error && (
          <div className="mb-3 flex items-center gap-2 text-sm p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Subject *</label>
            <input
              className="input w-full"
              placeholder="Brief description of your issue"
              value={form.subject}
              onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Category</label>
              <select className="input w-full" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Direct To</label>
              <select className="input w-full" value={form.targetRole} onChange={e => setForm(p => ({ ...p, targetRole: e.target.value }))}>
                <option value="faculty">My Faculty Advisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Priority</label>
            <select className="input w-full" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Description *</label>
            <textarea
              className="input w-full min-h-[120px] resize-y"
              placeholder="Describe your issue in detail..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              maxLength={5000}
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? <RefreshCw size={16} className="animate-spin inline mr-2" /> : <Send size={16} className="inline mr-2" />}
            {loading ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>
      </div>
    </div>
  );
}

function TicketDetailModal({ ticket: initialTicket, onClose }) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    ticketsApi.getTicketById(ticket._id)
      .then(res => {
        setTicket(res.ticket);
        setMessages(res.messages || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [ticket._id]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await ticketsApi.replyToTicket(ticket._id, { message: reply.trim() });
      setMessages(prev => [...prev, res.ticketMessage]);
      setReply('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="card p-6 w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{ticket.subject}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white flex-shrink-0 ml-4"><X size={20} /></button>
        </div>

        {error && <div className="mb-3 text-sm p-2 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)' }}>{error}</div>}

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 custom-scrollbar" style={{ minHeight: '200px', maxHeight: '400px' }}>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-16 w-full" />)}</div>
          ) : messages.map(msg => {
            const isMe = String(msg.senderId?._id) === String(user?._id);
            return (
              <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-xl text-sm ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                  style={{ background: isMe ? 'var(--accent)' : 'var(--surface-card)', color: isMe ? '#fff' : 'var(--text-primary)' }}>
                  {!isMe && <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{msg.senderId?.name}</div>}
                  <div className="whitespace-pre-wrap">{msg.message}</div>
                  <div className="text-xs mt-1 opacity-60">{new Date(msg.createdAt).toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply box */}
        {!isClosed ? (
          <div className="flex gap-2">
            <textarea
              className="input flex-1 resize-none"
              rows={2}
              placeholder="Type your reply..."
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            />
            <button onClick={sendReply} disabled={sending || !reply.trim()} className="btn btn-primary self-end">
              {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        ) : (
          <div className="text-center text-sm py-2" style={{ color: 'var(--text-secondary)' }}>
            This ticket is {ticket.status}. You cannot reply.
          </div>
        )}
      </div>
    </div>
  );
}

export function StudentSupportPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');

  const loadTickets = useCallback(() => {
    setLoading(true);
    setError('');
    ticketsApi.getMyTickets(filterStatus ? { status: filterStatus } : {})
      .then(res => setTickets(res.tickets || []))
      .catch(err => setError(err.message || 'Failed to load tickets'))
      .finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  return (
    <div className="space-y-6">
      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={loadTickets} />}
      {selectedTicket && <TicketDetailModal ticket={selectedTicket} onClose={() => { setSelectedTicket(null); loadTickets(); }} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <LifeBuoy size={28} style={{ color: 'var(--accent)' }} /> My Support Tickets
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Raise and track support requests with faculty or admin</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> New Ticket
        </button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {['', 'open', 'in_progress', 'waiting_for_response', 'resolved', 'closed'].map(s => (
          <button
            key={s || 'all'}
            onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: filterStatus === s ? 'var(--accent)' : 'var(--surface-card)',
              color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            {s ? STATUS_CONFIG[s]?.label : 'All Tickets'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Ticket list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}</div>
      ) : tickets.length === 0 ? (
        <div className="card p-12 text-center">
          <LifeBuoy size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No tickets found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {filterStatus ? `No ${STATUS_CONFIG[filterStatus]?.label || filterStatus} tickets` : 'Create your first support ticket to get help'}
          </p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={16} /> Create Ticket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
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
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-medium)', color: 'var(--text-secondary)' }}>
                      <Tag size={10} className="inline mr-1" />{ticket.category}
                    </span>
                  </div>
                  <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ticket.subject}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    <Clock size={10} className="inline mr-1" />
                    Last activity {new Date(ticket.lastActivityAt).toLocaleDateString()}
                    {ticket.assignedTo && ` · Assigned to ${ticket.assignedTo.name}`}
                  </p>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
