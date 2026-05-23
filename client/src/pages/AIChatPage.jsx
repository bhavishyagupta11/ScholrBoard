/**
 * AIChatPage.jsx — AI Coach Chat Interface
 */
import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import aiApi from '../api/ai.api.js';
import { useProfile } from '../contexts/ProfileContext.jsx';
import ReactMarkdown from 'react-markdown';

export function AIChatPage() {
  const { profile } = useProfile();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initial greeting based on profile
    const greeting = {
      role: 'ai',
      text: `Hello${profile?.name ? ` ${profile.name}` : ''}! I am your ScholrMind AI Coach. I can help you analyze your academic progress, recommend activities, suggest learning roadmaps, or provide career advice based on your profile. What would you like to focus on today?`
    };
    setMessages([greeting]);
  }, [profile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await aiApi.chat(userMessage.text, conversationId);
      
      if (res.conversationId && !conversationId) {
        setConversationId(res.conversationId);
      }

      setMessages(prev => [...prev, { role: 'ai', text: res.response, degraded: res.degraded }]);
    } catch (err) {
      console.error(err);
      const msg = err?.message || 'Request failed';
      setError(msg.includes('Conversation not found')
        ? 'Chat session expired. Starting a new conversation.'
        : msg || 'Failed to get response from AI. Please try again.');
      if (msg.includes('Conversation not found')) {
        setConversationId(null);
      }
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I could not complete that request. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (text) => {
    setInput(text);
    sendDirectMessage(text);
  };

  const sendDirectMessage = async (text) => {
    if (!text.trim() || loading) return;

    const userMessage = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const res = await aiApi.chat(text.trim(), conversationId);
      
      if (res.conversationId && !conversationId) {
        setConversationId(res.conversationId);
      }

      setMessages(prev => [...prev, { role: 'ai', text: res.response, degraded: res.degraded }]);
    } catch (err) {
      console.error(err);
      const msg = err?.message || 'Request failed';
      setError(msg.includes('Conversation not found')
        ? 'Chat session expired. Starting a new conversation.'
        : msg || 'Failed to get response from AI. Please try again.');
      if (msg.includes('Conversation not found')) {
        setConversationId(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{color:'var(--text-primary)'}}>
          <Sparkles className="text-blue-500" /> AI Coach
        </h1>
        <p className="mt-1" style={{color:'var(--text-secondary)'}}>Personalized academic and career guidance</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg text-sm shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 card p-0 flex flex-col overflow-hidden gpu-accelerated">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: 'var(--primary-blue)', color: '#fff' }}>
                  <Bot size={18} />
                </div>
              )}
              
              <div 
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                    : 'rounded-tl-sm'
                }`}
                style={msg.role === 'ai' ? { background: 'var(--bg-medium)', color: 'var(--text-primary)' } : {}}
              >
                {msg.role === 'ai' ? (
                  <div className="prose prose-sm md:prose-base prose-invert max-w-none">
                    {msg.degraded && (
                      <p className="text-xs mb-2 opacity-80 not-prose" style={{ color: 'var(--text-secondary)' }}>
                        Note: response was generated in a limited mode (AI service may be busy or misconfigured).
                      </p>
                    )}
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm md:text-base whitespace-pre-wrap">{msg.text}</div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <User size={18} />
                </div>
              )}
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: 'var(--primary-blue)', color: '#fff' }}>
                <Bot size={18} />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm p-4 flex items-center gap-2" style={{ background: 'var(--bg-medium)', color: 'var(--text-primary)' }}>
                <Loader2 size={16} className="animate-spin text-blue-500" />
                <span className="text-sm subtle">Analyzing profile and generating response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions (only show if no user messages yet) */}
        {messages.length === 1 && (
          <div className="p-4 border-t flex flex-wrap gap-2 shrink-0" style={{ borderColor: 'var(--border-color)', background: 'var(--surface-card)' }}>
            {[
              "What skills should I learn next?",
              "Generate a 3-month roadmap for Full Stack Web Dev.",
              "Analyze my current GPA and activities.",
              "How can I improve my resume?"
            ].map(action => (
              <button 
                key={action}
                onClick={() => handleQuickAction(action)}
                className="text-xs px-3 py-1.5 rounded-full border hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--primary-blue)', color: 'var(--primary-blue)' }}
              >
                {action}
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-dark)' }}>
          <form onSubmit={handleSend} className="relative flex items-center">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask your AI coach anything..." 
              className="w-full input-dark pl-4 pr-12 py-3 rounded-xl border border-gray-700/50 focus:border-blue-500/50 bg-gray-900/50 transition-colors"
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || loading}
              className="absolute right-2 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
