/*
 * AI-generated code: 75% (tool: Claude Code / Opus 4.8; mock setup and render
 * structure)
 * Human code: 25% (defined test cases and verified against actual
 * ProviderSchedule behavior)
 */

import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import ProviderSchedule from "../doctor/ProviderSchedule";
import AvailabilityModal from "../doctor/AvailabilityModal";
import { schedulingApi } from "../lib/schedulingApi";

jest.mock("../lib/schedulingApi", () => ({
  schedulingApi: {
    getAvailability: jest.fn(),
    getAppointments: jest.fn(),
    getPatients: jest.fn(),
    getRules: jest.fn(),
    addAvailability: jest.fn(),
    deleteAvailability: jest.fn(),
    addRule: jest.fn(),
    deleteRule: jest.fn(),
    createAppointment: jest.fn(),
    setSlot: jest.fn(),
  },
}));

const patient = { id: "p1", first_name: "John", last_name: "Doe" };

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("ProviderSchedule", () => {
  beforeEach(() => {
    schedulingApi.getAvailability.mockResolvedValue([]);
    schedulingApi.getAppointments.mockResolvedValue([]);
    schedulingApi.getPatients.mockResolvedValue([]);
    schedulingApi.getRules.mockResolvedValue([]);
    schedulingApi.addAvailability.mockResolvedValue([{ id: "s1" }]);
    schedulingApi.addRule.mockResolvedValue([{ id: "r1" }]);
    schedulingApi.createAppointment.mockResolvedValue({ id: "a1" });
    schedulingApi.setSlot.mockResolvedValue({ id: "slot-1" });
  });

  afterEach(() => jest.clearAllMocks());

  test("renders the toolbar and the day view with its side panel", async () => {
    render(<ProviderSchedule />);

    expect(
      screen.getByRole("heading", { name: "Schedule" }),
    ).toBeInTheDocument();
    ["Day", "Week", "Month"].forEach((m) =>
      expect(screen.getByRole("button", { name: m })).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          "Click an open slot to book, or an appointment to see its details.",
        ),
      ).toBeInTheDocument(),
    );
  });

  test("clicking an open slot shows the add form in the side panel", async () => {
    schedulingApi.getPatients.mockResolvedValue([patient]);
    render(<ProviderSchedule />);
    // wait until the grid (not the loading state) has rendered
    await waitFor(() =>
      expect(
        screen.getByText(
          "Click an open slot to book, or an appointment to see its details.",
        ),
      ).toBeInTheDocument(),
    );

    // move to tomorrow so 9 AM is a bookable (non-past) slot regardless of run time
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // every empty slot is a "Book <time> slot" button; click the 9 AM one
    fireEvent.click(screen.getByRole("button", { name: "Book 9:00 AM slot" }));
    expect(screen.getByText(/New appointment/)).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument(); // picker populated
  });

  test("switching to Week view shows weekday columns", async () => {
    render(<ProviderSchedule />);
    await waitFor(() => expect(schedulingApi.getRules).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  test("blocking an open day-view slot calls setSlot", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tkey = ymd(tomorrow);
    // an open office-hours slot tomorrow at 9 AM — only open slots show "block"
    schedulingApi.getAvailability.mockResolvedValue([
      {
        id: "s1",
        available_date: tkey,
        available_time: "09:00:00",
        is_booked: false,
        blocked: false,
      },
    ]);

    render(<ProviderSchedule />);
    await waitFor(() =>
      expect(
        screen.getByText(
          "Click an open slot to book, or an appointment to see its details.",
        ),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // tomorrow
    fireEvent.click(screen.getByRole("button", { name: "Block 9:00 AM" }));

    await waitFor(() =>
      expect(schedulingApi.setSlot).toHaveBeenCalledWith({
        date: tkey,
        time: "09:00",
        state: "blocked",
      }),
    );
  });

  test("Office Hours opens the recurring availability modal", async () => {
    render(<ProviderSchedule />);
    await waitFor(() => expect(schedulingApi.getRules).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Office Hours/i }));
    expect(
      screen.getByRole("heading", { name: "Office Hours" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save office hours/i }),
    ).toBeInTheDocument();
  });

  test("Office Hours saves by deleting old rules sequentially", async () => {
    let resolveFirstDelete;
    schedulingApi.deleteRule
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstDelete = resolve;
          }),
      )
      .mockResolvedValueOnce(null);

    render(
      <AvailabilityModal
        rules={[
          {
            id: "rule-1",
            weekday: 0,
            start_time: "09:00:00",
            end_time: "09:30:00",
          },
          {
            id: "rule-2",
            weekday: 1,
            start_time: "09:00:00",
            end_time: "09:30:00",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save office hours/i }));

    await waitFor(() => expect(schedulingApi.addRule).toHaveBeenCalled());
    await waitFor(() =>
      expect(schedulingApi.deleteRule).toHaveBeenCalledWith("rule-1"),
    );
    expect(schedulingApi.deleteRule).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstDelete();
    });

    await waitFor(() =>
      expect(schedulingApi.deleteRule).toHaveBeenCalledWith("rule-2"),
    );
  });

  test("toolbar Add Appointment books via the modal", async () => {
    schedulingApi.getPatients.mockResolvedValue([patient]);
    render(<ProviderSchedule />);
    await waitFor(() => expect(schedulingApi.getPatients).toHaveBeenCalled());

    // toolbar button is the only "Add Appointment" until the modal opens
    fireEvent.click(screen.getByRole("button", { name: /Add Appointment/i }));
    await waitFor(() => screen.getByText("John Doe"));

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "p1" } });
    const buttons = screen.getAllByRole("button", { name: /Add Appointment/i });
    fireEvent.click(buttons[buttons.length - 1]); // modal submit

    await waitFor(() =>
      expect(schedulingApi.createAppointment).toHaveBeenCalledWith({
        patient_id: "p1",
        date: ymd(new Date()),
        time: "09:00",
        notes: null,
      }),
    );
  });
});
