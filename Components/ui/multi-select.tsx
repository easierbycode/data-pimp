import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X, Flame, TrendingDown } from "lucide-react";

export interface StatusOption {
  value: string;
  label: string;
  type: 'status' | 'badge';
}

// Status styles matching their respective badges
const optionStyles: Record<string, { bg: string; text: string; border: string; selected: string }> = {
  available: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    selected: 'bg-emerald-100'
  },
  checked_out: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    selected: 'bg-amber-100'
  },
  reserved: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    selected: 'bg-blue-100'
  },
  discontinued: {
    bg: 'bg-slate-50',
    text: 'text-slate-800',
    border: 'border-slate-200',
    selected: 'bg-slate-100'
  },
  fire_sale: {
    bg: 'bg-gradient-to-r from-orange-50 to-red-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    selected: 'bg-gradient-to-r from-orange-100 to-red-100'
  },
  lowest_price: {
    bg: 'bg-gradient-to-r from-emerald-50 to-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    selected: 'bg-gradient-to-r from-emerald-100 to-green-100'
  }
};

// Pill/chip styles for selected items in trigger
const pillStyles: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  checked_out: 'bg-amber-100 text-amber-800 border-amber-200',
  reserved: 'bg-blue-100 text-blue-800 border-blue-200',
  discontinued: 'bg-slate-100 text-slate-800 border-slate-200',
  fire_sale: 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-0',
  lowest_price: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0'
};

interface StatusMultiSelectProps {
  options: StatusOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function StatusMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Filter by status...",
  className = ""
}: StatusMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const getOptionLabel = (optionValue: string) => {
    return options.find(o => o.value === optionValue)?.label || optionValue;
  };

  const renderIcon = (optionValue: string) => {
    if (optionValue === 'fire_sale') {
      return <Flame className="w-3 h-3" />;
    }
    if (optionValue === 'lowest_price') {
      return <TrendingDown className="w-3 h-3" />;
    }
    return null;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {value.length === 0 ? (
            <span className="text-slate-500">{placeholder}</span>
          ) : (
            value.map(v => (
              <span
                key={v}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${pillStyles[v] || 'bg-slate-100 text-slate-800'}`}
              >
                {renderIcon(v)}
                {getOptionLabel(v)}
                <X
                  className="w-3 h-3 cursor-pointer hover:opacity-70"
                  onClick={(e) => removeOption(v, e)}
                />
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {value.length > 0 && (
            <X
              className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer"
              onClick={clearAll}
            />
          )}
          <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown content */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {options.map(option => {
            const isSelected = value.includes(option.value);
            const styles = optionStyles[option.value] || optionStyles.available;

            return (
              <div
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={`
                  relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm
                  transition-colors
                  ${isSelected ? styles.selected : 'hover:' + styles.bg}
                  ${styles.text}
                `}
              >
                {/* Checkbox indicator */}
                <div className={`
                  flex h-4 w-4 items-center justify-center rounded border
                  ${isSelected
                    ? (option.value === 'fire_sale'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-500'
                        : option.value === 'lowest_price'
                          ? 'bg-gradient-to-r from-emerald-500 to-green-600 border-emerald-500'
                          : `${styles.selected} ${styles.border}`)
                    : `border-slate-300 bg-white`
                  }
                `}>
                  {isSelected && (
                    <Check className={`w-3 h-3 ${option.value === 'fire_sale' || option.value === 'lowest_price' ? 'text-white' : ''}`} />
                  )}
                </div>

                {/* Icon for special badges */}
                {renderIcon(option.value)}

                {/* Label */}
                <span className="font-medium">{option.label}</span>

                {/* Badge preview for special items */}
                {option.value === 'fire_sale' && (
                  <span className="ml-auto text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white px-1.5 py-0.5 rounded-full">
                    badge
                  </span>
                )}
                {option.value === 'lowest_price' && (
                  <span className="ml-auto text-xs bg-gradient-to-r from-emerald-500 to-green-600 text-white px-1.5 py-0.5 rounded-full">
                    badge
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StatusMultiSelect;
