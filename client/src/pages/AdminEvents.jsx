/**
 * AdminEvents.jsx — Dynamic event management with creation & editing
 */
import { useState, useEffect } from 'react';
import eventsApi from '../api/events.api.js';
import { AlertCircle, Search, Plus, CalendarDays, Users, Clock, CheckCircle, X } from 'lucide-react';

export function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

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
                        {event.attendees?.length || 0}
                        {event.maxAttendees ? ` / ${event.maxAttendees}` : ''}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`badge ${status === 'Upcoming' ? 'badge-yellow' : 'badge-green'}`}> 
                          {status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
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

      {/* EVENT FORM MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col p-6 space-y-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)' }}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                {editingEvent ? 'Edit Event Details' : 'Create New Event'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertCircle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Body */}
            <form onSubmit={handleFormSubmit} className="space-y-4 flex-1">
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

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
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
