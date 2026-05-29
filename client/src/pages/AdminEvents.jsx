/**
 * AdminEvents.jsx — Dynamic event management
 */
import { useState, useEffect } from 'react';
import eventsApi from '../api/events.api.js';
import { AlertCircle, Search, Plus, CalendarDays, Users, Clock, CheckCircle } from 'lucide-react';

export function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

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

  const filteredEvents = events.filter(event => {
    const term = searchTerm.toLowerCase();
    const matchSearch = (event.title?.toLowerCase() || '').includes(term) || 
                        (event.type?.toLowerCase() || '').includes(term);
    
    const now = new Date();
    const eventDate = new Date(event.startDate);
    const isCompleted = eventDate < now;
    const status = isCompleted ? 'Completed' : 'Upcoming';
    
    const matchType = filterType === 'All' || event.type === filterType;
    const matchStatus = filterStatus === 'All' || status === filterStatus;

    return matchSearch && matchType && matchStatus;
  });

  const totalEvents = events.length;
  const upcomingEvents = events.filter(e => new Date(e.startDate) >= new Date()).length;
  const totalRegistrations = events.reduce((acc, e) => acc + (e.registeredStudents?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Events & Activities</h1>
          <p className="mt-2" style={{color:'var(--text-secondary)'}}>Manage university events and student activities</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
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
          <option value="All">All Types</option>
          <option value="Technical">Technical</option>
          <option value="Cultural">Cultural</option>
          <option value="Sports">Sports</option>
          <option value="Career">Career</option>
          <option value="Seminar">Seminar</option>
          <option value="Workshop">Workshop</option>
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
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Type</th>
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
                      <td className="py-4 px-6 font-medium" style={{color:'var(--text-primary)'}}>{event.title}</td>
                      <td className="py-4 px-6 subtle">
                        <div className="flex items-center gap-1.5"><CalendarDays size={14} /> {new Date(event.startDate).toLocaleDateString()}</div>
                        {event.startTime && <div className="flex items-center gap-1.5 mt-1"><Clock size={14} /> {event.startTime}</div>}
                      </td>
                      <td className="py-4 px-6">{event.venue || 'TBA'}</td>
                      <td className="py-4 px-6">{event.type}</td>
                      <td className="py-4 px-6 font-medium">
                        {event.registeredStudents?.length || 0}
                        {event.capacity ? ` / ${event.capacity}` : ''}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`badge ${status === 'Upcoming' ? 'badge-warning' : 'badge-success'}`}> 
                          {status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="btn btn-outline px-3 py-1 text-xs">Edit</button>
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
    </div>
  );
}
