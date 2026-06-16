import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CustomSelect({ options, value, onChange, className = '', placeholder = 'Select an option' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val) => {
    onChange({ target: { value: val } });
    setIsOpen(false);
  };

  const currentLabel = options.find(opt => 
    typeof opt === 'string' ? opt === value : opt.value === value
  );
  
  const displayLabel = typeof currentLabel === 'string' ? currentLabel : (currentLabel?.label || placeholder);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className="input w-full flex items-center justify-between cursor-pointer border border-transparent hover:border-[var(--accent)] transition-colors"
        style={{ 
          background: 'rgba(255,255,255,0.05)', 
          color: '#fff',
          border: '1px solid var(--accent)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{displayLabel}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div 
          className="absolute left-0 right-0 mt-1 z-50 rounded-lg shadow-xl overflow-hidden border border-slate-700"
          style={{ background: '#1e293b' }}
        >
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((opt, idx) => {
              const optVal = typeof opt === 'string' ? opt : opt.value;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              const isSelected = optVal === value;
              
              return (
                <div
                  key={idx}
                  onClick={() => handleSelect(optVal)}
                  className="px-4 py-2 cursor-pointer transition-colors text-sm"
                  style={{
                    color: isSelected ? 'var(--accent)' : '#f8fafc',
                    background: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(255, 255, 255, 0.1)' : 'transparent'}
                >
                  {optLabel}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
