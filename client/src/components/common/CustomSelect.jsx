import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({
  options = [],
  value = '',
  onChange,
  className = '',
  placeholder = 'Select an option',
  name,
  disabled = false,
  required = false,
  error = false,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const listboxRef = useRef(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Normalized options format: [{ value: 'val', label: 'Label' }]
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: String(opt), label: String(opt) };
      }
      return { value: String(opt.value ?? ''), label: String(opt.label ?? opt.value ?? '') };
    });
  }, [options]);

  // Find currently selected option object
  const selectedOption = normalizedOptions.find((opt) => opt.value === String(value ?? ''));

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update highlighted index when dropdown opens or value changes
  useEffect(() => {
    if (isOpen) {
      const selectedIdx = normalizedOptions.findIndex((opt) => opt.value === String(value ?? ''));
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    }
  }, [isOpen, normalizedOptions, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const itemEl = listboxRef.current.children[highlightedIndex];
      if (itemEl) {
        itemEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (optionValue) => {
    if (disabled) return;
    if (onChange) {
      onChange({ target: { name, value: optionValue } });
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
          handleSelect(normalizedOptions[highlightedIndex].value);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => (prev < normalizedOptions.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : normalizedOptions.length - 1));
        }
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
        }
        break;
      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left select-none ${className}`}
    >
      {/* Trigger Control */}
      <div
        id={selectId}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        aria-required={required}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg text-sm transition-all border ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-[var(--primary-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]/30'
        }`}
        style={{
          background: 'var(--surface-card)',
          color: selectedOption ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderColor: error ? 'var(--danger-color)' : isOpen ? 'var(--primary-blue)' : 'var(--border-color)',
        }}
      >
        <span className="truncate font-medium">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-secondary)' }}
        />
      </div>

      {/* Options Listbox Popup */}
      {isOpen && (
        <div
          ref={listboxRef}
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-50 rounded-xl shadow-xl overflow-hidden border custom-scrollbar py-1 transition-all"
          style={{
            background: 'var(--surface-card)',
            borderColor: 'var(--border-color)',
            maxHeight: '15rem',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-4 py-2.5 text-xs subtle text-center">No options available</div>
          ) : (
            normalizedOptions.map((opt, idx) => {
              const isSelected = opt.value === String(value ?? '');
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={opt.value + idx}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className="px-3.5 py-2.5 cursor-pointer text-sm transition-colors flex items-center justify-between gap-2"
                  style={{
                    color: isSelected ? 'var(--primary-blue)' : 'var(--text-primary)',
                    background: isHighlighted || isSelected ? 'var(--accent-soft)' : 'transparent',
                    fontWeight: isSelected ? '600' : '400',
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="flex-shrink-0 text-blue-400" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
