// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: The provider Schedule view (#SCRUM-77) — Day / Week / Month
//   calendar. Day = an hours-of-the-day grid (DaySchedule) on the left with the
//   right panel showing the tall AppointmentPanel for a selected appointment or
//   the add form for an open slot; Week = a 7-day time grid where clicking a
//   booked slot opens details and an empty slot opens the add modal; Month = a
//   Google-Calendar-style grid. Plus the Office Hours action.
// Human Contributions: Layout/UX decisions, default-to-today + scroll-to-now, and
//   verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarPlus, Plus } from "lucide-react";
import { schedulingApi } from "../lib/schedulingApi";
import { formatApptTime } from "../lib/appointmentsApi";
import {
  ymd,
  addDays,
  startOfWeek,
  startOfMonth,
  halfHourTimes,
  hhmm,
  isPastSlot,
} from "./scheduleGrid";
import DaySchedule from "./DaySchedule";
import AppointmentForm from "./AppointmentForm";
import AppointmentPanel from "./AppointmentPanel";
import AppointmentDetailsModal from "./AppointmentDetailsModal";
import ScheduleAppointmentModal from "./ScheduleAppointmentModal";
import AvailabilityModal from "./AvailabilityModal";
import SlotActionsModal from "./SlotActionsModal";
import ConfirmDialog from "./ConfirmDialog";
import "./ProviderSchedule.css";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMES = halfHourTimes();

function fmtLong(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function groupByDate(items) {
  return items.reduce((acc, it) => {
    (acc[it.available_date] ||= []).push(it);
    return acc;
  }, {});
}

// ── Week grid (time gutter + 7 day columns) ─────────────────────────────────
function WeekGrid({ weekStart, apptsByDate, openByDate, blockedByDate, onPick }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = new Date();
  const currentHourKey = `${String(now.getHours()).padStart(2, "0")}:00`;
  const scrollRef = useRef(null);
  const nowRef = useRef(null);

  useEffect(() => {
    if (nowRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = nowRef.current.offsetTop;
    }
  }, [weekStart]);

  return (
    <div className="wg">
      <div className="wg-head">
        <div className="wg-corner" />
        {days.map((d) => (
          <div
            key={ymd(d)}
            className={`wg-day-head${ymd(d) === ymd(now) ? " today" : ""}`}
          >
            <span className="wg-dow">{DOW[d.getDay()]}</span>
            <span className="wg-num">{d.getDate()}</span>
          </div>
        ))}
      </div>
      <div className="wg-body" ref={scrollRef}>
        {TIMES.map((t) => (
          <div
            className="wg-row"
            key={t}
            ref={t === currentHourKey ? nowRef : null}
          >
            <span className="wg-time">{formatApptTime(t)}</span>
            {days.map((d) => {
              const key = ymd(d);
              const appt = (apptsByDate[key] || []).find(
                (a) => hhmm(a.available_time) === t,
              );
              const open = (openByDate[key] || []).find(
                (s) => hhmm(s.available_time) === t,
              );
              const blocked = (blockedByDate[key] || []).find(
                (s) => hhmm(s.available_time) === t,
              );
              const past = isPastSlot(d, t, now);
              const slotState = blocked ? "blocked" : open ? "open" : "empty";
              return appt ? (
                <button
                  key={key}
                  type="button"
                  className={`wg-cell booked${past ? " past" : ""}`}
                  onClick={() => onPick({ type: "details", appt })}
                >
                  <span className="wg-cell-name">
                    {appt.patient_name || "Patient"}
                  </span>
                </button>
              ) : past ? (
                <div key={key} className="wg-cell empty past" aria-hidden="true" />
              ) : (
                <button
                  key={key}
                  type="button"
                  className={`wg-cell ${slotState}`}
                  onClick={() =>
                    onPick({ type: "slot", date: key, time: t, state: slotState })
                  }
                  aria-label={`${formatApptTime(t)} slot actions`}
                >
                  {slotState !== "blocked" && <Plus size={12} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Month grid ───────────────────────────────────────────────────────────────
function MonthView({ anchor, apptsByDate, onSelectDay }) {
  const gridStart = startOfWeek(startOfMonth(anchor));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = ymd(new Date());
  return (
    <div className="ps-month">
      <div className="ps-month-dows">
        {DOW.map((d) => (
          <span key={d} className="ps-month-dow">
            {d}
          </span>
        ))}
      </div>
      <div className="ps-month-grid">
        {cells.map((d) => {
          const key = ymd(d);
          const count = (apptsByDate[key] || []).length;
          const inMonth = d.getMonth() === anchor.getMonth();
          return (
            <button
              key={key}
              className={`ps-month-cell${inMonth ? "" : " dim"}${key === todayKey ? " today" : ""}`}
              onClick={() => onSelectDay(d)}
            >
              <span className="ps-month-num">{d.getDate()}</span>
              {count > 0 && (
                <span className="ps-month-count">
                  {count} appt{count > 1 ? "s" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ProviderSchedule({ onMessagePatient }) {
  const [viewMode, setViewMode] = useState("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [availOpen, setAvailOpen] = useState(false);
  const [dayPanel, setDayPanel] = useState({ type: null });
  const [modal, setModal] = useState({ type: null });

  const [appointments, setAppointments] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [patients, setPatients] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const refresh = () => {
    Promise.all([
      schedulingApi.getAppointments().catch(() => []),
      schedulingApi.getAvailability().catch(() => []),
      schedulingApi.getPatients().catch(() => []),
      schedulingApi.getRules().catch(() => []),
    ])
      .then(([ap, av, p, r]) => {
        setAppointments(ap || []);
        setAvailability(av || []);
        setPatients(p || []);
        setRules(r || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const apptsByDate = groupByDate(appointments);
  const openByDate = groupByDate(
    availability.filter((s) => !s.is_booked && !s.blocked),
  );
  const blockedByDate = groupByDate(
    availability.filter((s) => !s.is_booked && s.blocked),
  );

  const setSlotState = (date, time, state) =>
    schedulingApi
      .setSlot({ date, time, state })
      .then(refresh)
      .catch((e) => window.alert(e.message || "Could not update the slot."));

  const cancelAppt = (appt) => {
    setCancelError("");
    setConfirmCancel(appt);
  };

  const doCancel = () => {
    setCancelling(true);
    setCancelError("");
    schedulingApi
      .cancelAppointment(confirmCancel.id)
      .then(() => {
        setConfirmCancel(null);
        setDayPanel({ type: null });
        setModal({ type: null });
        refresh();
      })
      .catch((e) => {
        // already removed elsewhere — just re-sync the calendar
        if (/not found/i.test(e.message || "")) {
          setConfirmCancel(null);
          setDayPanel({ type: null });
          setModal({ type: null });
          refresh();
        } else {
          setCancelError(e.message || "Could not cancel the appointment.");
        }
      })
      .finally(() => setCancelling(false));
  };

  const step = (dir) => {
    if (viewMode === "day") setAnchor((d) => addDays(d, dir));
    else if (viewMode === "week") setAnchor((d) => addDays(d, dir * 7));
    else setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  const periodLabel = () => {
    if (viewMode === "day") return fmtLong(anchor);
    if (viewMode === "week") {
      const s = startOfWeek(anchor);
      const e = addDays(s, 6);
      const opt = { month: "short", day: "numeric" };
      return `${s.toLocaleDateString("en-US", opt)} – ${e.toLocaleDateString("en-US", opt)}`;
    }
    return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const selectDay = (d) => {
    setAnchor(d);
    setDayPanel({ type: null });
    setViewMode("day");
  };

  const anchorKey = ymd(anchor);

  return (
    <div className="ps-page">
      <div className="ps-toolbar">
        <div className="ps-toolbar-left">
          <h1 className="ps-title">Schedule</h1>
          <div className="ps-viewtoggle">
            {["day", "week", "month"].map((m) => (
              <button
                key={m}
                className={`ps-vt${viewMode === m ? " active" : ""}`}
                onClick={() => setViewMode(m)}
              >
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="ps-toolbar-right">
          <button className="ps-action" onClick={() => setAvailOpen(true)}>
            <CalendarPlus size={15} /> Office Hours
          </button>
          <button
            className="ps-action ps-action--filled"
            onClick={() =>
              setModal({ type: "add", date: anchorKey, time: "09:00" })
            }
          >
            <Plus size={15} /> Add Appointment
          </button>
        </div>
      </div>

      <div className="ps-datenav">
        <button className="ps-nav-btn" onClick={() => step(-1)} aria-label="Previous">
          <ChevronLeft size={16} />
        </button>
        <button className="ps-today-btn" onClick={() => setAnchor(new Date())}>
          Today
        </button>
        <button className="ps-nav-btn" onClick={() => step(1)} aria-label="Next">
          <ChevronRight size={16} />
        </button>
        <span className="ps-period">{periodLabel()}</span>
      </div>

      <div className="ps-body">
        {loading ? (
          <p className="ps-muted">Loading your schedule…</p>
        ) : viewMode === "day" ? (
          <div className="ps-day-layout">
            <DaySchedule
              date={anchor}
              appointments={apptsByDate[anchorKey] || []}
              openSlots={openByDate[anchorKey] || []}
              blockedSlots={blockedByDate[anchorKey] || []}
              scrollToNow
              maxHeight="560px"
              rowHeight={50}
              selectedKey={
                dayPanel.type === "details"
                  ? dayPanel.appt.id
                  : dayPanel.type === "add"
                    ? dayPanel.time
                    : null
              }
              onPickAppointment={(a) => setDayPanel({ type: "details", appt: a })}
              onBook={(t) => setDayPanel({ type: "add", time: t })}
              onOpen={(t) => setSlotState(anchorKey, t, "open")}
              onBlock={(t) => setSlotState(anchorKey, t, "blocked")}
            />
            <div className="ps-day-panel">
              {dayPanel.type === "details" ? (
                <AppointmentPanel
                  appt={dayPanel.appt}
                  onCancel={cancelAppt}
                  onMessage={onMessagePatient}
                />
              ) : dayPanel.type === "add" ? (
                <div className="ps-day-add">
                  <h3 className="ps-panel-title">
                    New appointment · {formatApptTime(dayPanel.time)}
                  </h3>
                  <AppointmentForm
                    patients={patients}
                    defaultDate={anchorKey}
                    defaultTime={dayPanel.time}
                    onSaved={() => {
                      setDayPanel({ type: null });
                      refresh();
                    }}
                  />
                </div>
              ) : (
                <p className="ps-panel-empty">
                  Click an open slot to book, or an appointment to see its
                  details.
                </p>
              )}
            </div>
          </div>
        ) : viewMode === "week" ? (
          <WeekGrid
            weekStart={startOfWeek(anchor)}
            apptsByDate={apptsByDate}
            openByDate={openByDate}
            blockedByDate={blockedByDate}
            onPick={setModal}
          />
        ) : (
          <MonthView
            anchor={anchor}
            apptsByDate={apptsByDate}
            onSelectDay={selectDay}
          />
        )}
      </div>

      {availOpen && (
        <AvailabilityModal
          rules={rules}
          onClose={() => setAvailOpen(false)}
          onSaved={refresh}
        />
      )}
      {modal.type === "details" && (
        <AppointmentDetailsModal
          appt={modal.appt}
          onClose={() => setModal({ type: null })}
          onCancel={cancelAppt}
          onMessage={onMessagePatient}
        />
      )}
      {modal.type === "add" && (
        <ScheduleAppointmentModal
          patients={patients}
          defaultDate={modal.date}
          defaultTime={modal.time}
          onClose={() => setModal({ type: null })}
          onSaved={() => {
            setModal({ type: null });
            refresh();
          }}
        />
      )}
      {modal.type === "slot" && (
        <SlotActionsModal
          date={modal.date}
          time={modal.time}
          slotState={modal.state}
          onClose={() => setModal({ type: null })}
          onBook={() =>
            setModal({ type: "add", date: modal.date, time: modal.time })
          }
          onOpen={() => {
            setSlotState(modal.date, modal.time, "open");
            setModal({ type: null });
          }}
          onBlock={() => {
            setSlotState(modal.date, modal.time, "blocked");
            setModal({ type: null });
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel appointment?"
        message={
          confirmCancel
            ? `This will cancel ${confirmCancel.patient_name || "the patient"}'s appointment and free the slot.`
            : ""
        }
        error={cancelError}
        confirmLabel="Cancel appointment"
        cancelLabel="Keep"
        destructive
        busy={cancelling}
        onConfirm={doCancel}
        onCancel={() => {
          setConfirmCancel(null);
          setCancelError("");
        }}
      />
    </div>
  );
}
