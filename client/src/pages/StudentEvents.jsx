import { useEffect, useState, useCallback } from 'react';
import { Calendar, CalendarDays, CheckCircle2, MapPin, Clock, AlertCircle } from 'lucide-react';
import eventsApi from '../api/events.api.js';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';

export function StudentEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'registered'

  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const contentRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventsApi.getMyEvents();
      setEvents(res.events || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRegister = async (eventId) => {
    setError(null);
    setSuccess(null);
    try {
      await eventsApi.register(eventId);
      setSuccess('Successfully registered for the event!');
      fetchEvents();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to register for event');
    }
  };

  const filteredEvents = events.filter((e) => {
    if (activeTab === 'registered') {
      return e.isRegistered;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div ref={headerRef} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 gpu-accelerated">
        <div>
          <h1 className="headline">Campus Events &amp; Workshops</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Discover and register for personalized hackathons, guest lectures, and student workshops.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border p-1" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'all'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setActiveTab('registered')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'registered'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Registered ({events.filter(e => e.isRegistered).length})
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm border border-red-500/20 bg-red-500/10 text-red-400">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm border border-green-500/20 bg-green-500/10 text-green-400">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="gpu-accelerated">
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="card p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
            <CalendarDays size={40} className="mx-auto mb-2 opacity-40" />
            <div className="text-sm font-medium">No events found.</div>
            <div className="text-xs mt-1">Check back later for new workshops and competitions.</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <div
                key={event._id}
                className="card p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200"
                style={{ borderColor: 'var(--border-color)', background: 'var(--surface-card)' }}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {event.category}
                    </span>
                    {event.isRegistered && (
                      <span className="badge badge-green text-[10px] py-0.5 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Registered
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-[var(--text-primary)]">{event.title}</h3>
                    {event.description && (
                      <p className="text-xs subtle mt-1.5 line-clamp-3 leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <Calendar size={13} className="shrink-0" />
                      <span>{new Date(event.startDate).toLocaleDateString()}</span>
                    </div>
                    {event.startTime && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <Clock size={13} className="shrink-0" />
                        <span>{event.startTime}</span>
                      </div>
                    )}
                    {event.venue && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <MapPin size={13} className="shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    )}
                  </div>
                </div>

                {event.requiresRegistration && !event.isRegistered && (
                  <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <button
                      onClick={() => handleRegister(event._id)}
                      className="btn btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} /> Register Now
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
