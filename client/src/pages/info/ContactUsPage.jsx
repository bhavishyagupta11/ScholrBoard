import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';

export function ContactUsPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!form.subject.trim()) newErrors.subject = 'Subject is required';
    if (!form.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (form.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters long';
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    }, 1200);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 flex flex-col justify-between" style={{ background: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
      <header className="max-w-5xl mx-auto w-full flex justify-between items-center pb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <Link to="/" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--primary-blue)' }}>
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <img src="/assets/logo.png" alt="ScholrBoard Logo" className="w-8 h-8 object-contain" />
          <span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>
            <span style={{ color: 'var(--accent)' }}>Scholr</span>
            <span style={{ color: 'var(--text-primary)' }}>Board</span>
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full py-12 flex-1 grid md:grid-cols-[1fr_1.5fr] gap-12">
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight">Contact Us</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Have questions about ScholrBoard? Reach out to our campus implementation team.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <Mail size={18} />
              </div>
              <div>
                <h4 className="font-bold">Email Support</h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <a href="mailto:pathbullish@gmail.com" className="hover:text-amber-500 transition-colors">pathbullish@gmail.com</a>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                <Phone size={18} />
              </div>
              <div>
                <h4 className="font-bold">Phone Hotline</h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <a href="tel:+917339743084" className="hover:text-amber-500 transition-colors">+91-7339743084</a>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                <MapPin size={18} />
              </div>
              <div>
                <h4 className="font-bold">Campus Office</h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Jagatpura, Jaipur, Rajasthan
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="card p-6 md:p-8 space-y-6">
          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mx-auto">
                <CheckCircle size={36} />
              </div>
              <h3 className="text-2xl font-bold">Message Sent Successfully</h3>
              <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Thank you for contacting ScholrBoard. Our institutional response coordinator will respond to you within 24 hours.
              </p>
              <button onClick={() => setSubmitted(false)} className="btn btn-outline text-xs px-4 py-2 mt-4">
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Your Name</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-medium)', borderColor: errors.name ? '#ef4444' : 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="John Doe"
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-medium)', borderColor: errors.email ? '#ef4444' : 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="john@university.edu"
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Subject</label>
                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm"
                  style={{ background: 'var(--bg-medium)', borderColor: errors.subject ? '#ef4444' : 'var(--border-color)', color: 'var(--text-primary)' }}
                  placeholder="How can we help?"
                />
                {errors.subject && <p className="text-xs text-red-500">{errors.subject}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Message</label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm leading-relaxed"
                  style={{ background: 'var(--bg-medium)', borderColor: errors.message ? '#ef4444' : 'var(--border-color)', color: 'var(--text-primary)' }}
                  placeholder="Details of your inquiry..."
                />
                {errors.message && <p className="text-xs text-red-500">{errors.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                <Send size={16} />
                <span>{loading ? 'Sending Message...' : 'Send Message'}</span>
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto w-full text-center pt-8 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        <span>&copy; {new Date().getFullYear()} ScholrBoard. All rights reserved.</span>
      </footer>
    </div>
  );
}
