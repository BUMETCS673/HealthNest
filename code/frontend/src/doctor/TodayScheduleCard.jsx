// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: The dashboard Today's Schedule card (#SCRUM-77) — the shared
//   hours-of-the-day grid scrolled to the current hour, with click-to-view
//   details and click-empty-slot-to-book (both as modals). The whole card is
//   clickable to open the Schedule tab, but the outer hover is suppressed while
//   the cursor is inside the scrolling grid (only the slots highlight there).
//   Pulls from the new /schedule data (the old visit-overviews skill queried
//   dropped columns and showed nothing).
// Human Contributions: The card-vs-grid hover interaction model + verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { useState, useEffect } from "react";
import DaySchedule from "./DaySchedule";
import AppointmentDetailsModal from "./AppointmentDetailsModal";
import ScheduleAppointmentModal from "./ScheduleAppointmentModal";
import ConfirmDialog from "./ConfirmDialog";
import { schedulingApi } from "../lib/schedulingApi";
import { ymd } from "./scheduleGrid";

export default function TodayScheduleCard({ onOpenSchedule, onMessagePatient }) {
  const today = new Date();
  const key = ymd(today);

  const [appts, setAppts] = useState([]);
  const [open, setOpen] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [patients, setPatients] = useState([]);
  const [detail, setDetail] = useState(null);
  const [addTime, setAddTime] = useState(null);
  const [cardHover, setCardHover] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const refresh = () => {
    Promise.all([
      schedulingApi.getAppointments().catch(() => []),
      schedulingApi.getAvailability().catch(() => []),
      schedulingApi.getPatients().catch(() => []),
    ]).then(([a, av, p]) => {
      const todayAv = (av || []).filter((x) => x.available_date === key);
      setAppts((a || []).filter((x) => x.available_date === key));
      setOpen(todayAv.filter((x) => !x.is_booked && !x.blocked));
      setBlocked(todayAv.filter((x) => !x.is_booked && x.blocked));
      setPatients(p || []);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSlot = (time, state) =>
    schedulingApi
      .setSlot({ date: key, time, state })
      .then(refresh)
      .catch((e) => window.alert(e.message || "Could not update the slot."));

  const cancel = (appt) => {
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
        setDetail(null);
        refresh();
      })
      .catch((e) => {
        // already removed elsewhere — just re-sync
        if (/not found/i.test(e.message || "")) {
          setConfirmCancel(null);
          setDetail(null);
          refresh();
        } else {
          setCancelError(e.message || "Could not cancel the appointment.");
        }
      })
      .finally(() => setCancelling(false));
  };

  return (
    <>
      <div
        className={`doc-card doc-schedule-card today-card${cardHover ? " hovered" : ""}`}
        role="button"
        tabIndex={0}
        onClick={onOpenSchedule}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && onOpenSchedule?.()
        }
        onMouseEnter={() => setCardHover(true)}
        onMouseLeave={() => setCardHover(false)}
      >
        <div className="doc-card-header">
          <h3 className="doc-card-title">Today&apos;s Schedule</h3>
          <span className="dash-view-all">Open schedule →</span>
        </div>

        {/* Hovering the scrolling grid should not highlight the outer card, and
            clicking a slot should not navigate. */}
        <div
          className="today-card-grid"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setCardHover(false)}
          onMouseLeave={() => setCardHover(true)}
        >
          <DaySchedule
            date={today}
            appointments={appts}
            openSlots={open}
            blockedSlots={blocked}
            scrollToNow
            maxHeight="360px"
            onPickAppointment={(a) => setDetail(a)}
            onBook={(t) => setAddTime(t)}
            onBlock={(t) => setSlot(t, "blocked")}
            onOpen={(t) => setSlot(t, "open")}
          />
        </div>
      </div>

      {detail && (
        <AppointmentDetailsModal
          appt={detail}
          onClose={() => setDetail(null)}
          onCancel={cancel}
          onMessage={onMessagePatient}
        />
      )}
      {addTime && (
        <ScheduleAppointmentModal
          patients={patients}
          defaultDate={key}
          defaultTime={addTime}
          onClose={() => setAddTime(null)}
          onSaved={() => {
            setAddTime(null);
            refresh();
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
    </>
  );
}
