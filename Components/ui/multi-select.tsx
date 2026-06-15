import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Flame,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";
import { cn } from "@/utils";

export interface StatusOption {
  value: string;
  label: string;
  /** "status" renders as a tinted row; "badge" carries a special icon/preview. */
  type?: "status" | "badge";
  /** Optional emoji marker shown before the label (mirrors the Inventory app). */
  emoji?: string;
  /** Optional Tailwind text-color class applied to the option label. */
  color?: string;
}

// Status styles matching their respective badges (see StatusBadge).
const optionStyles: Record<
  string,
  { bg: string; text: string; border: string; selected: string }
> = {
  available: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    selected: "bg-emerald-100",
  },
  checked_out: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    selected: "bg-amber-100",
  },
  reserved: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    selected: "bg-blue-100",
  },
  discontinued: {
    bg: "bg-slate-50",
    text: "text-slate-800",
    border: "border-slate-200",
    selected: "bg-slate-100",
  },
  fire_sale: {
    bg: "bg-gradient-to-r from-orange-50 to-red-50",
    text: "text-orange-700",
    border: "border-orange-200",
    selected: "bg-gradient-to-r from-orange-100 to-red-100",
  },
  lowest_price: {
    bg: "bg-gradient-to-r from-emerald-50 to-green-50",
    text: "text-green-700",
    border: "border-green-200",
    selected: "bg-gradient-to-r from-emerald-100 to-green-100",
  },
};

// Pill/chip styles for selected items in the trigger (multi mode).
const pillStyles: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  checked_out: "bg-amber-100 text-amber-800 border-amber-200",
  reserved: "bg-blue-100 text-blue-800 border-blue-200",
  discontinued: "bg-slate-100 text-slate-800 border-slate-200",
  fire_sale: "bg-gradient-to-r from-orange-500 to-red-500 text-white border-0",
  lowest_price:
    "bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0",
};

// Fallback styling for custom statuses with no entry in the maps above.
const NEUTRAL_OPTION = {
  bg: "bg-slate-50",
  text: "text-slate-800",
  border: "border-slate-200",
  selected: "bg-slate-100",
};
const NEUTRAL_PILL = "bg-slate-100 text-slate-800 border-slate-200";

interface StatusSelectBaseProps {
  options: StatusOption[];
  placeholder?: string;
  className?: string;
  /** Leading element rendered inside the trigger (e.g. an icon). */
  icon?: React.ReactNode;
  disabled?: boolean;
  /**
   * Show the inline Add / Edit / Remove footer. Requires at least one of the
   * on* handlers below; without them the footer stays hidden. Mirrors the
   * editable status list in the Inventory app's StatusSelect.
   */
  editable?: boolean;
  /**
   * Create a status from a label. Return the created status `value` to have it
   * auto-selected in single mode (mirrors the Inventory app); return nothing to
   * skip auto-selection.
   */
  onAddStatus?: (label: string) => string | void;
  onRenameStatus?: (value: string, label: string) => void;
  onRemoveStatus?: (value: string) => void;
  /** Values that ship as built-ins: renameable but not removable. */
  builtInValues?: string[];
}

interface StatusSelectSingleProps extends StatusSelectBaseProps {
  multiple?: false;
  value: string;
  onValueChange: (value: string) => void;
  /** Prepend an "All" option (for filtering). */
  includeAll?: boolean;
  /** Label for the "All" option when {@link includeAll} is set. */
  allLabel?: string;
}

interface StatusSelectMultiProps extends StatusSelectBaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

export type StatusSelectProps = StatusSelectSingleProps | StatusSelectMultiProps;

/**
 * Unified status dropdown ported from the Inventory app (tiktok-sample-tracker)
 * StatusSelect. Each option is tinted with its status color and special
 * badges (fire sale, lowest price) carry an icon and preview chip.
 *
 * Two modes share one component:
 *   - single  (default): `value: string` + `onValueChange`, with an optional
 *     "All" entry via {@link StatusSelectSingleProps.includeAll}.
 *   - multiple: `value: string[]` + `onChange`, rendering removable chips in
 *     the trigger — used for the Samples status filter.
 *
 * When {@link StatusSelectBaseProps.editable} is set and the matching on*
 * handlers are supplied, an Add / Edit footer lets the user manage the list
 * inline (built-ins can be renamed but not removed).
 */
export function StatusSelect(props: StatusSelectProps) {
  const {
    options,
    placeholder = "Filter by status...",
    className = "",
    icon,
    disabled = false,
    editable = false,
    onAddStatus,
    onRenameStatus,
    onRemoveStatus,
    builtInValues = [],
  } = props;

  const isMultiple = props.multiple === true;
  const selected: string[] = isMultiple
    ? props.value
    : props.value
    ? [props.value]
    : [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  // Working copies of labels while editing, keyed by status value.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Reset transient edit state whenever the dropdown closes.
  useEffect(() => {
    if (!open) {
      setEditing(false);
      setAdding(false);
      setNewLabel("");
    }
  }, [open]);

  useEffect(() => {
    if (adding) {
      const id = window.setTimeout(() => addInputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [adding]);

  const canEdit = editable &&
    Boolean(onAddStatus || onRenameStatus || onRemoveStatus);

  const getOption = (value: string) => options.find((o) => o.value === value);
  const getOptionLabel = (value: string) => getOption(value)?.label || value;

  const renderIcon = (value: string) => {
    const opt = getOption(value);
    if (opt?.emoji) return <span aria-hidden>{opt.emoji}</span>;
    if (value === "fire_sale") return <Flame className="w-3 h-3" />;
    if (value === "lowest_price") return <TrendingDown className="w-3 h-3" />;
    return null;
  };

  const commitSingle = (value: string) => {
    if (isMultiple) return;
    (props as StatusSelectSingleProps).onValueChange(value);
    setOpen(false);
  };

  const toggleMulti = (value: string) => {
    if (!isMultiple) return;
    const p = props as StatusSelectMultiProps;
    if (p.value.includes(value)) {
      p.onChange(p.value.filter((v) => v !== value));
    } else {
      p.onChange([...p.value, value]);
    }
  };

  const handleOptionClick = (value: string) => {
    if (isMultiple) toggleMulti(value);
    else commitSingle(value);
  };

  const removeOne = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMultiple) return;
    const p = props as StatusSelectMultiProps;
    p.onChange(p.value.filter((v) => v !== value));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMultiple) (props as StatusSelectMultiProps).onChange([]);
  };

  // --- editable footer helpers ---
  const startEditing = () => {
    setDrafts(Object.fromEntries(options.map((o) => [o.value, o.label])));
    setEditing(true);
    setAdding(false);
  };

  const commitEdits = () => {
    if (onRenameStatus) {
      for (const o of options) {
        const next = drafts[o.value];
        if (next != null && next.trim() && next.trim() !== o.label) {
          onRenameStatus(o.value, next.trim());
        }
      }
    }
    setEditing(false);
  };

  const confirmAdd = () => {
    const label = newLabel.trim();
    if (label && onAddStatus) {
      // Mirror the Inventory app: if the handler reports the created value,
      // select it (single mode) so the new status is applied immediately.
      const created = onAddStatus(label);
      if (created && !isMultiple) commitSingle(created);
    }
    setNewLabel("");
    setAdding(false);
  };

  // Keep keystrokes inside the inline inputs from bubbling to the dropdown.
  const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();

  const single = props as StatusSelectSingleProps;
  const triggerLabel = (value: string) =>
    value === "all" ? single.allLabel ?? "All Status" : getOptionLabel(value);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className="flex min-h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex flex-wrap flex-1 items-center gap-1 text-left">
          {icon}
          {selected.length === 0
            ? <span className="text-slate-500">{placeholder}</span>
            : isMultiple
            ? (
              selected.map((v) => (
                <span
                  key={v}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                    pillStyles[v] || NEUTRAL_PILL,
                  )}
                >
                  {renderIcon(v)}
                  {getOptionLabel(v)}
                  <X
                    className="w-3 h-3 cursor-pointer hover:opacity-70"
                    onClick={(e) => removeOne(v, e)}
                  />
                </span>
              ))
            )
            : (
              <span className="inline-flex items-center gap-1.5">
                {renderIcon(selected[0])}
                {triggerLabel(selected[0])}
              </span>
            )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {isMultiple && selected.length > 0 && (
            <X
              className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-pointer"
              onClick={clearAll}
            />
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 opacity-50 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* Dropdown content */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {/* "All" option (single/filter mode) */}
          {!isMultiple && single.includeAll && !editing && (
            <div
              onClick={() => commitSingle("all")}
              className="relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <div className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white">
                {selected[0] === "all" && <Check className="w-3 h-3" />}
              </div>
              <span className="font-medium">
                {single.allLabel ?? "All Status"}
              </span>
            </div>
          )}

          {editing
            ? options.map((option) => (
              <div
                key={option.value}
                className="flex items-center gap-1 py-1 pl-2 pr-1"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {renderIcon(option.value)}
                <input
                  value={drafts[option.value] ?? option.label}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [option.value]: e.target.value,
                    }))}
                  onKeyDown={(e) => {
                    stopKeys(e);
                    if (e.key === "Enter") commitEdits();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-slate-950"
                  aria-label={`Rename ${option.label}`}
                />
                {builtInValues.includes(option.value)
                  ? <span className="h-8 w-8 shrink-0" aria-hidden />
                  : (
                    <button
                      type="button"
                      onClick={() => onRemoveStatus?.(option.value)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${option.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
              </div>
            ))
            : options.map((option) => {
              const isSelected = selected.includes(option.value);
              const styles = optionStyles[option.value] || NEUTRAL_OPTION;

              return (
                <div
                  key={option.value}
                  onClick={() => handleOptionClick(option.value)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm transition-colors",
                    isSelected ? styles.selected : `hover:${styles.bg}`,
                    option.color || styles.text,
                  )}
                >
                  {/* Checkbox indicator */}
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      isSelected
                        ? option.value === "fire_sale"
                          ? "bg-gradient-to-r from-orange-500 to-red-500 border-orange-500"
                          : option.value === "lowest_price"
                          ? "bg-gradient-to-r from-emerald-500 to-green-600 border-emerald-500"
                          : `${styles.selected} ${styles.border}`
                        : "border-slate-300 bg-white",
                    )}
                  >
                    {isSelected && (
                      <Check
                        className={cn(
                          "w-3 h-3",
                          (option.value === "fire_sale" ||
                            option.value === "lowest_price") && "text-white",
                        )}
                      />
                    )}
                  </div>

                  {/* Icon for special badges / emoji */}
                  {renderIcon(option.value)}

                  {/* Label */}
                  <span className="font-medium">{option.label}</span>

                  {/* Badge preview for special items */}
                  {option.value === "fire_sale" && (
                    <span className="ml-auto text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white px-1.5 py-0.5 rounded-full">
                      badge
                    </span>
                  )}
                  {option.value === "lowest_price" && (
                    <span className="ml-auto text-xs bg-gradient-to-r from-emerald-500 to-green-600 text-white px-1.5 py-0.5 rounded-full">
                      badge
                    </span>
                  )}
                </div>
              );
            })}

          {/* Inline "add status" input */}
          {adding && (
            <div
              className="flex items-center gap-1 py-1 pl-2 pr-1"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                ref={addInputRef}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  stopKeys(e);
                  if (e.key === "Enter") confirmAdd();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewLabel("");
                  }
                }}
                placeholder="New status name…"
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-slate-950"
                aria-label="New status name"
              />
              <button
                type="button"
                onClick={confirmAdd}
                disabled={!newLabel.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                aria-label="Save new status"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewLabel("");
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Editable footer */}
          {canEdit && (
            <>
              <div className="my-1 h-px bg-slate-200" />
              <div
                className="flex items-center gap-1 p-1"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {editing
                  ? (
                    <button
                      type="button"
                      onClick={commitEdits}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                    >
                      <Check className="h-4 w-4" />
                      Done
                    </button>
                  )
                  : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setAdding((v) => !v);
                          setNewLabel("");
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={startEditing}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                    </>
                  )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Back-compat alias for the previous multi-select API. Prefer
 * `<StatusSelect multiple … />` directly.
 *
 * @deprecated Use {@link StatusSelect} with the `multiple` prop.
 */
export function StatusMultiSelect(
  props: Omit<StatusSelectMultiProps, "multiple">,
) {
  return <StatusSelect {...props} multiple />;
}

export default StatusSelect;
