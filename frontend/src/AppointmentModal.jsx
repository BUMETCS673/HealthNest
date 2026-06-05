import { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import {
  appointmentsApi,
  formatApptDate,
  formatApptTime,
} from "./lib/appointmentsApi";
import "./AppointmentModal.css";

const SPECIALTIES = [
  "All",
  "Cardiology",
  "Primary Care",
  "Endocrinology",
  "Dermatology",
  "Neurology",
  "Orthopedics",
];

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** Parse YYYY-MM-DD without timezone shifting */
function parseLocal(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Return the Monday of the week containing `d` */
function weekStart(d) {
  const day = new Date(d);
  const dow = day.getDay(); // 0=Sun
  day.setDate(day.getDate() - dow); // rewind to Sunday
  return day;
}

/** Generate the 7 YYYY-MM-DD keys for the week starting on `sunday` */
function weekKeys(sunday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return toDateKey(d);
  });
}

/** Construct a provider name from a slot */
function slotProviderName(s) {
  return s?.providers
    ? [s.providers.title, s.providers.first_name, s.providers.last_name]
        .filter(Boolean)
        .join(" ")
    : "";
}

export default function AppointmentModal({
  onClose,
  onBooked,
  rescheduleId = null,
  providerId = null,
  providerName = null,
}) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [specialty, setSpecialty] = useState("All");
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  // Date-picker mode state — weekOffset 0 = the week containing today
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeDate, setActiveDate] = useState(null);

  useEffect(() => {
    appointmentsApi
      .getAvailability()
      .then((data) => {
        setSlots(data);
        if (providerId) {
          // Default to today; fall back to the first available date
          const today = toDateKey(new Date());
          const providerDates = new Set(
            data
              .filter((s) => s.provider_id === providerId)
              .map((s) => s.available_date),
          );

          // pick the date we'll land on: today if it has slots, else the earliest one
          const target = providerDates.has(today)
            ? today
            : ([...providerDates].sort()[0] ?? today);
          setActiveDate(target);

          // move the week strip to the week that actually contains `target`
          const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
          const todaySunday = weekStart(new Date());
          const targetSunday = weekStart(parseLocal(target));
          setWeekOffset(Math.round((targetSunday - todaySunday) / WEEK_MS));
        }
      })
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, []);

  const isReschedule = Boolean(rescheduleId);
  const todayKey = toDateKey(new Date());

  // ── Filtered slots ────────────────────────────────────────────────────
  const filtered = providerId
    ? slots.filter((s) => s.provider_id === providerId)
    : specialty === "All"
      ? slots
      : slots.filter((s) => s.providers?.specialty === specialty);

  // ── Date-picker data (full week, every day shown) ────────────────────
  const availableDateSet = new Set(filtered.map((s) => s.available_date));

  // The Sunday of the week we're viewing
  const sunday = weekStart(new Date());
  sunday.setDate(sunday.getDate() + weekOffset * 7);

  const currentWeekKeys = weekKeys(sunday);

  // Can't go before the week containing today
  const canGoPrev = weekOffset > 0;

  const timeSlotsForDate = filtered
    .filter((s) => s.available_date === activeDate)
    .sort((a, b) => a.available_time.localeCompare(b.available_time));

  // ── List mode grouping ────────────────────────────────────────────────
  const grouped = filtered.reduce((acc, slot) => {
    if (!acc[slot.available_date]) acc[slot.available_date] = [];
    acc[slot.available_date].push(slot);
    return acc;
  }, {});

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    setError("");
    try {
      if (rescheduleId) {
        await appointmentsApi.rescheduleAppointment(rescheduleId, {
          availability_id: selectedSlot.id,
        });
      } else {
        await appointmentsApi.createAppointment({
          provider_id: selectedSlot.provider_id,
          availability_id: selectedSlot.id,
          notes: notes || null,
        });
      }
      onBooked?.();
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div
      className="am-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="am-box">
        {/* ── Header ── */}
        <div className="am-header">
          <div>
            <h2 className="am-title">
              {isReschedule ? "Reschedule Appointment" : "Book an Appointment"}
            </h2>
            <p className="am-sub">
              {providerName
                ? `Showing available times for ${providerName}.`
                : "Select a provider and time that works for you."}
            </p>
          </div>
          <button className="am-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* ── Date nav strip (provider mode) OR specialty pills ── */}
        {providerId ? (
          <div className="am-date-nav">
            <button
              className="am-date-arrow"
              onClick={() => {
                setWeekOffset((w) => w - 1);
                setSelectedSlot(null);
              }}
              disabled={!canGoPrev}
              aria-label="Previous week"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="am-date-cols">
              {currentWeekKeys.map((dateStr) => {
                const d = parseLocal(dateStr);
                const isActive = dateStr === activeDate;
                const isToday = dateStr === todayKey;
                const isPast = dateStr < todayKey;
                const hasSlots = availableDateSet.has(dateStr);
                return (
                  <button
                    key={dateStr}
                    className={`am-date-col${isActive ? " active" : ""}${!hasSlots ? " no-slots" : ""}`}
                    disabled={isPast}
                    onClick={() => {
                      setActiveDate(dateStr);
                      setSelectedSlot(null);
                    }}
                  >
                    <span className="am-dc-mon">{MON_ABBR[d.getMonth()]}</span>
                    <span
                      className={`am-dc-num${isToday && !isActive ? " today" : ""}`}
                    >
                      {d.getDate()}
                    </span>
                    <span className="am-dc-dow">{DOW[d.getDay()]}</span>
                  </button>
                );
              })}
            </div>

            <button
              className="am-date-arrow"
              onClick={() => {
                setWeekOffset((w) => w + 1);
                setSelectedSlot(null);
              }}
              aria-label="Next week"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="am-filters">
            <span className="am-filter-label">Specialty</span>
            <div className="am-pills">
              {SPECIALTIES.map((s) => (
                <button
                  key={s}
                  className={`am-pill ${specialty === s ? "active" : ""}`}
                  onClick={() => {
                    setSpecialty(s);
                    setSelectedSlot(null);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div className="am-body">
          {/* Left: slots */}
          <div className="am-slots">
            {loading ? (
              <p className="am-loading">Loading available slots…</p>
            ) : providerId ? (
              availableDateSet.size === 0 ? (
                <p className="am-empty-slots">
                  No available slots for this provider.
                </p>
              ) : timeSlotsForDate.length === 0 ? (
                <p className="am-empty-slots">
                  No available times on this date.
                </p>
              ) : (
                <div className="am-time-list">
                  {timeSlotsForDate.map((slot) => (
                    <button
                      key={slot.id}
                      className={`am-time-btn${selectedSlot?.id === slot.id ? " active" : ""}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      <span className="am-time-btn-time">
                        <Clock size={14} />
                        {formatApptTime(slot.available_time)}
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : Object.keys(grouped).length === 0 ? (
              <p className="am-empty-slots">
                No slots available for this specialty.
              </p>
            ) : (
              Object.entries(grouped).map(([date, dateSlots]) => (
                <div key={date} className="am-date-group">
                  <p className="am-date-label">
                    <Calendar size={13} />
                    {formatApptDate(date)}
                  </p>
                  <div className="am-slot-grid">
                    {dateSlots.map((slot) => (
                      <button
                        key={slot.id}
                        className={`am-slot ${selectedSlot?.id === slot.id ? "active" : ""}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        <span className="am-slot-time">
                          {formatApptTime(slot.available_time)}
                        </span>
                        <span className="am-slot-provider">
                          {slotProviderName(slot)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: confirmation panel */}
          <div className="am-form">
            {selectedSlot ? (
              <>
                <div className="am-selected-card">
                  <p className="am-selected-label">Selected Appointment</p>
                  <p className="am-selected-provider">
                    <Stethoscope size={14} />
                    {slotProviderName(selectedSlot)}
                  </p>
                  {selectedSlot.providers?.specialty && (
                    <span className="am-badge">
                      {selectedSlot.providers?.specialty}
                    </span>
                  )}
                  <p className="am-selected-detail">
                    <Calendar size={13} />
                    {formatApptDate(selectedSlot.available_date)}
                  </p>
                  <p className="am-selected-detail">
                    <Clock size={13} />
                    {formatApptTime(selectedSlot.available_time)}
                  </p>
                </div>

                <div className="am-notes-wrap">
                  <label className="am-notes-label">
                    Notes <span>(optional)</span>
                  </label>
                  <textarea
                    className="am-notes"
                    placeholder="Reason for visit, questions for your provider…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {error && <p className="am-error">{error}</p>}

                <button
                  className="am-confirm"
                  onClick={handleConfirm}
                  disabled={booking}
                >
                  {booking ? (
                    "Processing…"
                  ) : (
                    <>
                      {isReschedule
                        ? "Confirm Reschedule"
                        : "Confirm Appointment"}
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="am-prompt">
                <Calendar size={36} />
                <p>Select a time slot on the left to continue.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
