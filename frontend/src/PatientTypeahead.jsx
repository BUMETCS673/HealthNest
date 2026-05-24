import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  patientsApi,
  formatPatientName,
  formatPatientSubtitle,
} from "./lib/patientsApi";

export default function PatientTypeahead({
  value,
  onChange,
  placeholder = "Search by name or MRN…",
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (value) return undefined;
    if (!open) return undefined;
    let alive = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      patientsApi
        .search({ q: q || undefined, limit: 20 })
        .then((rows) => {
          if (!alive) return;
          setResults(rows || []);
          setHighlight(0);
        })
        .catch(() => {
          if (alive) setResults([]);
        });
    }, 180);
    return () => {
      alive = false;
      clearTimeout(debounceRef.current);
    };
  }, [q, open, value]);

  if (value) {
    return (
      <div className='lab-typeahead-selected'>
        <div>
          <div className='lab-typeahead-selected-name'>
            {formatPatientName(value)}
          </div>
          <div className='lab-typeahead-selected-meta'>
            {formatPatientSubtitle(value) || `#${value.id.slice(0, 8)}`}
          </div>
        </div>
        <button
          type='button'
          className='lab-typeahead-clear'
          onClick={() => onChange(null)}
          aria-label='Clear patient'>
          <X size={16} />
        </button>
      </div>
    );
  }

  function onKeyDown(ev) {
    if (!open) return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const choice = results[highlight];
      if (choice) {
        onChange(choice);
        setOpen(false);
      }
    } else if (ev.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className='lab-typeahead' ref={wrapRef}>
      <input
        className='lab-typeahead-input'
        placeholder={placeholder}
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className='lab-typeahead-menu'>
          {results.length === 0 ? (
            <div className='lab-typeahead-empty'>
              {q
                ? "No matching patients in your care team."
                : "Start typing to search your patients…"}
            </div>
          ) : (
            results.map((p, i) => (
              <div
                key={p.id}
                className={`lab-typeahead-row ${i === highlight ? "active" : ""}`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}>
                <div className='lab-typeahead-row-name'>
                  {formatPatientName(p)}
                </div>
                <div className='lab-typeahead-row-meta'>
                  {formatPatientSubtitle(p) || `#${p.id.slice(0, 8)}`}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
