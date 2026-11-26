/**
 * AdminEvents.jsx — Dynamic event management with creation & editing
 */
import { useState, useEffect, useCallback } from 'react';
import eventsApi from '../api/events.api.js';
import { AlertCircle, Search, Plus, CalendarDays, Users, Clock, CheckCircle, X, RefreshCw } from 'lucide-react';

export function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Registrations Modal state
  const [regModalEvent, setRegModalEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [regSummary, setRegSummary] = useState({ totalRegistrations: 0, filteredCount: 0, maxAttendees: null, departments: [] });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regSearch, setRegSearch] = useState('');
  const [regDeptFilter, setRegDeptFilter] = useState('All');
  const [regStatusFilter, setRegStatusFilter] = useState('all');

  // Modal & form state
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const defaultFormState = {
    title: '',
    description: '',
    category: 'Technical',
    venue: '',
    startDate: '',
    endDate: '',
    startTime: '',
    maxAttendees: '',
    requiresRegistration: true,
    targetRoles: ['student'],
    targetDepartments: '',
    isPublished: false,
  };
  const [formState, setFormState] = useState(defaultFormState);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Lock background page scroll cleanly while either modal is open
  useEffect(() => {
    const isAnyModalOpen = showModal || Boolean(regModalEvent);
    if (!isAnyModalOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showModal, regModalEvent]);

  const fetchEventRegistrations = useCallback(async (eventId, filters = {}) => {
    setRegLoading(true);
    setRegError(null);
    try {
      const res = await eventsApi.getRegistrations(eventId, {
        search: filters.search !== undefined ? filters.search : regSearch,
        department: filters.department !== undefined ? filters.department : (regDeptFilter === 'All' ? '' : regDeptFilter),
        status: filters.status !== undefined ? filters.status : regStatusFilter,
      });
      setRegistrations(res.registrations || []);
      setRegSummary(res.summary || { totalRegistrations: 0, filteredCount: 0, maxAttendees: null, departments: [] });
    } catch (err) {
      setRegError(err.message || 'Failed to load registered students');
    } finally {
      setRegLoading(false);
    }
  }, [regSearch, regDeptFilter, regStatusFilter]);

  const handleOpenRegistrations = (event) => {
    setRegModalEvent(event);
    setRegistrations([]);
    setRegError(null);
    setRegSearch('');
    setRegDeptFilter('All');
    setRegStatusFilter('all');
    fetchEventRegistrations(event._id, { search: '', department: '', status: 'all' });
  };

  useEffect(() => {
    if (!regModalEvent) return;
    fetchEventRegistrations(regModalEvent._id);
  }, [regModalEvent, regSearch, regDeptFilter, regStatusFilter, fetchEventRegistrations]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await eventsApi.getAll();
      setEvents(res.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setFormState(defaultFormState);
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (event) => {
    setEditingEvent(event);
    setFormState({
      title: event.title || '',
      description: event.description || '',
      category: event.category || 'Technical',
      venue: event.venue || '',
      startDate: event.startDate ? event.startDate.substring(0, 10) : '',
      endDate: event.endDate ? event.endDate.substring(0, 10) : '',
      startTime: event.startTime || '',
      maxAttendees: event.maxAttendees || '',
      requiresRegistration: event.requiresRegistration !== false,
      targetRoles: event.targetRoles || ['student'],
      targetDepartments: event.targetDepartments ? event.targetDepartments.join(', ') : '',
      isPublished: !!event.isPublished,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRoleCheckboxChange = (role) => {
    setFormState(prev => {
      const currentRoles = [...prev.targetRoles];
      if (currentRoles.includes(role)) {
        return {
          ...prev,
          targetRoles: currentRoles.filter(r => r !== role)
        };
      } else {
        return {
          ...prev,
          targetRoles: [...currentRoles, role]
        };
      }
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formState.title.trim() || !formState.startDate) {
      setFormError('Title and Start Date are required fields.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload = {
      title: formState.title.trim(),
      description: formState.description.trim(),
      category: formState.category,
      venue: formState.venue.trim(),
      startDate: new Date(formState.startDate),
      endDate: formState.endDate ? new Date(formState.endDate) : undefined,
      startTime: formState.startTime.trim() || undefined,
      maxAttendees: formState.maxAttendees ? Number(formState.maxAttendees) : null,
      requiresRegistration: Boolean(formState.requiresRegistration),
      targetRoles: formState.targetRoles.length > 0 ? formState.targetRoles : ['all'],
      targetDepartments: formState.targetDepartments ? formState.targetDepartments.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [],
      isPublished: Boolean(formState.isPublished),
    };

    try {
      if (editingEvent) {
        await eventsApi.update(editingEvent._id, payload);
      } else {
        await eventsApi.create(payload);
      }
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const term = searchTerm.toLowerCase();
    const matchSearch = (event.title?.toLowerCase() || '').includes(term) || 
                        (event.type?.toLowerCase() || '').includes(term) ||
                        (event.category?.toLowerCase() || '').includes(term);
    
    const now = new Date();
    const eventDate = new Date(event.startDate);
    const isCompleted = eventDate < now;
    const status = isCompleted ? 'Completed' : 'Upcoming';
    
    const matchType = filterType === 'All' || event.category === filterType;
    const matchStatus = filterStatus === 'All' || status === filterStatus;

    return matchSearch && matchType && matchStatus;
  });

  const totalEvents = events.length;
  const upcomingEvents = events.filter(e => new Date(e.startDate) >= new Date()).length;
  const totalRegistrations = events.reduce((acc, e) => acc + (e.attendees?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Events & Activities</h1>
          <p className="mt-2" style={{color:'var(--text-secondary)'}}>Manage university events and student activities</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Create New Event
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>{totalEvents}</div>
            <CalendarDays size={20} className="text-blue-500 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Total Events</div>
        </div>
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-green-400">{totalRegistrations}</div>
            <Users size={20} className="text-green-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Total Registrations</div>
        </div>
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-blue-400">{upcomingEvents}</div>
            <Clock size={20} className="text-blue-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Upcoming Events</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search events..."
            className="input-dark pl-9 py-2 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="input-dark px-3 py-2"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="All">All Categories</option>
          <option value="Technical">Technical</option>
          <option value="Cultural">Cultural</option>
          <option value="Sports">Sports</option>
          <option value="Workshop">Workshop</option>
          <option value="Seminar">Seminar</option>
          <option value="Hackathon">Hackathon</option>
          <option value="Placement">Placement</option>
          <option value="Guest Lecture">Guest Lecture</option>
          <option value="Other">Other</option>
        </select>
        <select
          className="input-dark px-3 py-2"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Upcoming">Upcoming</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Events Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{borderColor:'var(--border-color)', background: 'var(--bg-medium)'}}>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Event</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Date</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Venue</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Category</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Registrations</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Status</th>
                <th className="text-right py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i}>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-32" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-24" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-20" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-20" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-10" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-6 w-16 rounded-full" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-8 w-20 float-right" /></td>
                  </tr>
                ))
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center subtle">No events found.</td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const isCompleted = new Date(event.startDate) < new Date();
                  const status = isCompleted ? 'Completed' : 'Upcoming';
                  return (
                    <tr key={event._id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6 font-medium" style={{color:'var(--text-primary)'}}>
                        <div>{event.title}</div>
                        {!event.isPublished && (
                          <span className="text-[10px] uppercase font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 mt-1 inline-block">Draft</span>
                        )}
                      </td>
                      <td className="py-4 px-6 subtle">
                        <div className="flex items-center gap-1.5"><CalendarDays size={14} /> {new Date(event.startDate).toLocaleDateString()}</div>
                        {event.startTime && <div className="flex items-center gap-1.5 mt-1"><Clock size={14} /> {event.startTime}</div>}
                      </td>
                      <td className="py-4 px-6">{event.venue || 'TBA'}</td>
                      <td className="py-4 px-6">{event.category}</td>
                      <td className="py-4 px-6 font-medium">
                        <button
                          type="button"
                          onClick={() => handleOpenRegistrations(event)}
                          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 hover:underline font-semibold cursor-pointer"
                          title="Inspect registered students"
                        >
                          <Users size={14} />
                          <span>
                            {event.attendees?.length || 0}
                            {event.maxAttendees ? ` / ${event.maxAttendees}` : ''}
                          </span>
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`badge ${status === 'Upcoming' ? 'badge-yellow' : 'badge-green'}`}> 
                          {status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            data-testid={`event-registrations-btn-${event._id}`}
                            onClick={() => handleOpenRegistrations(event)}
                            className="btn btn-outline px-3 py-1 text-xs inline-flex items-center gap-1"
                          >
                            <Users size={13} /> Registrations ({event.attendees?.length || 0})
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleOpenEdit(event)}
                            className="btn btn-outline px-3 py-1 text-xs"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EVENT REGISTRATIONS MODAL */}
      {regModalEvent && (
        <div
          data-testid="event-registrations-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setRegModalEvent(null); }}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl border shadow-2xl"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            {/* Sticky Header */}
            <div className="shrink-0 flex justify-between items-start gap-4 px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users size={20} className="text-blue-400" />
                  Registered Students — {regModalEvent.title}
                </h2>
                <div className="text-xs subtle mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Category: {regModalEvent.category}</span>
                  <span>Date: {new Date(regModalEvent.startDate).toLocaleDateString()}</span>
                  {regModalEvent.venue && <span>Venue: {regModalEvent.venue}</span>}
                  <span className="font-semibold text-blue-400">
                    Total Registered: {regSummary.totalRegistrations}
                    {regSummary.maxAttendees ? ` / ${regSummary.maxAttendees}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fetchEventRegistrations(regModalEvent._id)}
                  className="btn btn-outline px-2.5 py-1.5 text-xs inline-flex items-center gap-1"
                  title="Refresh registrations"
                >
                  <RefreshCw size={13} className={regLoading ? 'animate-spin' : ''} /> Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setRegModalEvent(null)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10"
                  aria-label="Close registrations modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="shrink-0 px-6 py-3 border-b flex flex-wrap gap-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-medium)' }}>
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  data-testid="reg-search-input"
                  placeholder="Search by name, email, roll/ID, or department..."
                  value={regSearch}
                  onChange={(e) => setRegSearch(e.target.value)}
                  className="w-full input-dark pl-9 py-1.5 px-3 text-xs"
                />
              </div>
              <select
                data-testid="reg-dept-filter"
                value={regDeptFilter}
                onChange={(e) => setRegDeptFilter(e.target.value)}
                className="input-dark py-1.5 px-3 text-xs"
              >
                <option value="All">All Departments</option>
                {(regSummary.departments || []).map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select
                data-testid="reg-status-filter"
                value={regStatusFilter}
                onChange={(e) => setRegStatusFilter(e.target.value)}
                className="input-dark py-1.5 px-3 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="registered">Registered</option>
                <option value="attended">Attended</option>
                <option value="absent">Absent</option>
              </select>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-6 custom-scrollbar">
              {regError ? (
                <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{regError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchEventRegistrations(regModalEvent._id)}
                    className="btn btn-outline text-xs px-3 py-1"
                  >
                    Retry
                  </button>
                </div>
              ) : regLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 w-full rounded" />)}
                </div>
              ) : registrations.length === 0 ? (
                <div className="py-12 text-center subtle">
                  <Users size={38} className="mx-auto mb-2 opacity-35" />
                  <p className="text-sm font-medium">
                    {regSummary.totalRegistrations === 0
                      ? 'No students registered for this event yet.'
                      : 'No registrations match your search or filters.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th className="py-3 px-4 font-semibold">Student</th>
                        <th className="py-3 px-4 font-semibold">Email</th>
                        <th className="py-3 px-4 font-semibold">Enrollment / ID</th>
                        <th className="py-3 px-4 font-semibold">Department</th>
                        <th className="py-3 px-4 font-semibold">Registered At</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                      {registrations.map((reg) => (
                        <tr key={reg.userId} className="hover:bg-white/5">
                          <td className="py-3 px-4 font-semibold">{reg.name}</td>
                          <td className="py-3 px-4 subtle">{reg.email}</td>
                          <td className="py-3 px-4 font-mono">{reg.studentId}</td>
                          <td className="py-3 px-4">
                            {reg.department}{reg.semester ? ` · Sem ${reg.semester}` : ''}
                          </td>
                          <td className="py-3 px-4 subtle">
                            {reg.registeredAt ? new Date(reg.registeredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`badge ${
                              reg.status === 'Attended' ? 'badge-green' :
                              reg.status === 'Absent' ? 'badge-red' : 'badge-yellow'
                            }`}>
                              {reg.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 flex justify-between items-center px-6 py-3 border-t text-xs subtle" style={{ borderColor: 'var(--border-color)' }}>
              <span>
                Showing {registrations.length} of {regSummary.filteredCount} matching ({regSummary.totalRegistrations} total)
              </span>
              <button
                type="button"
                onClick={() => setRegModalEvent(null)}
                className="btn btn-primary px-4 py-1.5 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT FORM MODAL */}
      {showModal && (
        <div
          data-testid="event-form-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            data-testid="event-form-modal"
            className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl border shadow-2xl"
            style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            
            {/* Modal Header */}
            <div className="shrink-0 flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                {editingEvent ? 'Edit Event Details' : 'Create New Event'}
              </h2>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
                aria-label="Close event modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body & Sticky Footer inside flex column */}
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div
                data-testid="event-form-scroll-body"
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-4 space-y-4 custom-scrollbar"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {formError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Title */}
                  <div className="md:col-span-2">
                    <label className="block text-sm subtle mb-1">Event Title *</label>
                    <input
                      type="text"
                      name="title"
                      value={formState.title}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., CodeRush Hackathon 2026"
                      className="w-full input-dark py-2 px-3 text-sm"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm subtle mb-1">Category *</label>
                    <select
                      name="category"
                      value={formState.category}
                      onChange={handleInputChange}
                      className="w-full input-dark py-2 px-3 text-sm"
                    >
                      <option value="Technical">Technical</option>
                      <option value="Cultural">Cultural</option>
                      <option value="Sports">Sports</option>
                      <option value="Workshop">Workshop</option>
                      <option value="Seminar">Seminar</option>
                      <option value="Hackathon">Hackathon</option>
                      <option value="Placement">Placement</option>
                      <option value="Guest Lecture">Guest Lecture</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Venue */}
                  <div>
                    <label className="block text-sm subtle mb-1">Venue (or Link) *</label>
                    <input
                      type="text"
                      name="venue"
                      value={formState.venue}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Auditorium Hall B / Online"
                      className="w-full input-dark py-2 px-3 text-sm"
                    />
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-sm subtle mb-1">Start Date *</label>
                    <input
                      type="date"
                      name="startDate"
                      value={formState.startDate}
                      onChange={handleInputChange}
                      required
                      className="w-full input-dark py-2 px-3 text-sm"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-sm subtle mb-1">End Date (Optional)</label>
                    <input
                      type="date"
                      name="endDate"
                      value={formState.endDate}
                      onChange={handleInputChange}
                      className="w-full input-dark py-2 px-3 text-sm"
                    />
                  </div>

                  {/* Start Time */}
                  <div>
                    <label className="block text-sm subtle mb-1">Start Time (Optional)</label>
                    <input
                      type="text"
                      name="startTime"
                      value={formState.startTime}
                      onChange={handleInputChange}
                      placeholder="e.g., 09:30 AM"
                      className="w-full input-dark py-2 px-3 text-sm"
                    />
                  </div>

                  {/* Max Attendees */}
                  <div>
                    <label className="block text-sm subtle mb-1">Max Capacity (Optional)</label>
                    <input
                      type="number"
                      name="maxAttendees"
                      value={formState.maxAttendees}
                      onChange={handleInputChange}
                      placeholder="e.g., 100"
                      className="w-full input-dark py-2 px-3 text-sm"
                    />
                  </div>

                  {/* Target Departments */}
                  <div>
                    <label className="block text-sm subtle mb-1">Target Departments (Comma-separated)</label>
                    <input
                      type="text"
                      name="targetDepartments"
                      value={formState.targetDepartments}
                      onChange={handleInputChange}
                      placeholder="e.g., CSE, IT (Leave blank for all)"
                      className="w-full input-dark py-2 px-3 text-sm"
                    />
                  </div>

                  {/* Registration Switch */}
                  <div className="flex items-center gap-2 mt-4">
                    <input
                      type="checkbox"
                      id="requiresRegistration"
                      name="requiresRegistration"
                      checked={formState.requiresRegistration}
                      onChange={handleInputChange}
                      className="h-4 w-4 bg-slate-800 border-slate-700 rounded text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="requiresRegistration" className="text-sm font-medium subtle">Requires Student Registration</label>
                  </div>

                  {/* Target Roles */}
                  <div className="md:col-span-2 pt-2">
                    <span className="block text-sm subtle mb-2">Target Audience Roles</span>
                    <div className="flex gap-4">
                      {['student', 'faculty', 'admin'].map(role => (
                        <label key={role} className="flex items-center gap-1.5 text-sm cursor-pointer uppercase font-semibold">
                          <input
                            type="checkbox"
                            checked={formState.targetRoles.includes(role)}
                            onChange={() => handleRoleCheckboxChange(role)}
                            className="h-4 w-4 bg-slate-800 border-slate-700 rounded text-blue-500 focus:ring-blue-500"
                          />
                          {role}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-sm subtle mb-1">Description (Optional)</label>
                    <textarea
                      name="description"
                      value={formState.description}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Describe the event contents, eligibility, rules..."
                      className="w-full input-dark py-2 px-3 text-sm"
                    />
                  </div>

                  {/* Publish Switch */}
                  <div className="flex items-center gap-2 mt-2 md:col-span-2">
                    <input
                      type="checkbox"
                      id="isPublished"
                      name="isPublished"
                      checked={formState.isPublished}
                      onChange={handleInputChange}
                      className="h-4 w-4 bg-slate-800 border-slate-700 rounded text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="isPublished" className="text-sm font-medium text-blue-400">Publish Event notice immediately (makes visible to students)</label>
                  </div>

                </div>
              </div>

              {/* Sticky Modal Footer */}
              <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)', background: 'var(--surface-card)' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline py-2 px-4 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary py-2 px-4 text-sm font-semibold flex items-center gap-2"
                >
                  {submitting ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
