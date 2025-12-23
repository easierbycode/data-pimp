import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input.tsx";
import { QrCode, Loader2 } from "lucide-react";
import { useTranslation } from "../i18n/translations.tsx";

export default function ScannerInput({ onScan, disabled = false }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const timeoutRef = useRef(null);

  // Handle keyboard-wedge scanner pattern
  const handleKeyDown = useCallback((e) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // If it's Enter and we have buffer content, process it
    if (e.key === 'Enter' && bufferRef.current.length > 0) {
      e.preventDefault();
      onScan(bufferRef.current);
      bufferRef.current = '';
      setValue('');
      return;
    }

    // Add printable characters to buffer
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      bufferRef.current += e.key;
      setValue(bufferRef.current);
    }

    // Set timeout to process after inactivity (for scanners that don't send Enter)
    timeoutRef.current = setTimeout(() => {
      if (bufferRef.current.length >= 3) { // Minimum code length
        onScan(bufferRef.current);
      }
      bufferRef.current = '';
      setValue('');
    }, 150); // 150ms threshold for scanner input
  }, [onScan]);

  // Keep input focused
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && !disabled) {
        inputRef.current.focus();
      }
    };

    focusInput();
    
    // Refocus on click anywhere in document
    const handleClick = () => focusInput();
    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('click', handleClick);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [disabled]);

  // Handle manual input
  const handleChange = (e) => {
    const newValue = e.target.value;
    bufferRef.current = newValue;
    setValue(newValue);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onScan(value.trim());
      bufferRef.current = '';
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div 
        className={`
          relative rounded-2xl border-2 transition-all duration-300
          ${focused 
            ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' 
            : 'border-slate-200 hover:border-slate-300'
          }
          ${disabled ? 'opacity-50' : ''}
        `}
      >
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          {disabled ? (
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          ) : (
            <QrCode className={`w-6 h-6 transition-colors ${focused ? 'text-indigo-500' : 'text-slate-400'}`} />
          )}
        </div>
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={t('checkout.scanPlaceholder')}
          className="h-16 pl-16 pr-6 text-lg border-0 bg-transparent focus-visible:ring-0 placeholder:text-slate-400"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
      {!focused && !disabled && (
        <p className="text-center text-sm text-slate-400 mt-3">
          {t('checkout.scanFocus')}
        </p>
      )}
    </form>
  );
}