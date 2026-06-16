/*
 * AI-USAGE SUMMARY
 * Tools: ChatGPT and Claude Sonnet
 * Overall AI Contribution: ~60%
 * AI-Assisted Areas: Helped identify the missing Signup.jsx Jest coverage,
 * draft the test structure, mock authApi.signUp, build patient/provider role
 * switching checks, add form interaction tests, and cover submit success,
 * session callback, loading, and error states.
 * Human Contributions: Verified the tests against the actual Signup component,
 * confirmed the expected labels and button text, adjusted metadata expectations,
 * replaced the loading test with a safer unresolved
 * promise, and reviewed the final coverage before adding it to the branch.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Signup from "../loginsignup/Signup";
import { authApi } from "../lib/authApi";

jest.mock("../lib/authApi", () => ({
  authApi: {
    signUp: jest.fn(),
  },
}));

jest.mock("../Login.css", () => ({}));

const mockOnSwitchToLogin = jest.fn();
const mockOnSignedUp = jest.fn();

const defaultProps = {
  onSwitchToLogin: mockOnSwitchToLogin,
  onSignedUp: mockOnSignedUp,
};

describe("Signup", () => {
  beforeEach(() => {
    authApi.signUp.mockResolvedValue({
      session: null,
      message:
        "Account created. Check your email to confirm before signing in.",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Rendering ---

  test("renders the create account form", () => {
    render(<Signup {...defaultProps} />);

    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  test("renders patient and provider role buttons", () => {
    render(<Signup {...defaultProps} />);

    expect(screen.getByText("Patient")).toBeInTheDocument();
    expect(screen.getByText("Provider")).toBeInTheDocument();
  });

  test("renders sign in instead button", () => {
    render(<Signup {...defaultProps} />);

    expect(screen.getByText("Sign in instead")).toBeInTheDocument();
  });

  // --- Role selector ---

  test("defaults to patient role and shows patient-only fields", () => {
    render(<Signup {...defaultProps} />);

    expect(
      screen.getByLabelText("Medical record number (MRN)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Date of birth")).toBeInTheDocument();
    expect(screen.getByLabelText("Sex at birth")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create patient account/i }),
    ).toBeInTheDocument();
  });

  test("switches to provider role and hides patient-only fields", () => {
    render(<Signup {...defaultProps} />);

    fireEvent.click(screen.getByText("Provider"));

    expect(
      screen.queryByLabelText("Medical record number (MRN)"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Date of birth")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sex at birth")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create provider account/i }),
    ).toBeInTheDocument();
  });

  test("switching back to patient role restores patient-only fields", () => {
    render(<Signup {...defaultProps} />);

    fireEvent.click(screen.getByText("Provider"));
    fireEvent.click(screen.getByText("Patient"));

    expect(
      screen.getByLabelText("Medical record number (MRN)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Date of birth")).toBeInTheDocument();
  });

  // --- Form interaction ---

  test("toggles password visibility", () => {
    render(<Signup {...defaultProps} />);

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput.type).toBe("password");

    fireEvent.click(screen.getByText("show"));
    expect(passwordInput.type).toBe("text");

    fireEvent.click(screen.getByText("hide"));
    expect(passwordInput.type).toBe("password");
  });

  // --- Submit: patient role ---

  test("calls authApi.signUp with correct patient metadata on submit", async () => {
    render(<Signup {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Morgan" },
    });
    fireEvent.change(screen.getByLabelText("Medical record number (MRN)"), {
      target: { value: "MRN-00123456" },
    });
    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "1990-05-22" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /create patient account/i }),
    );

    await waitFor(() => {
      expect(authApi.signUp).toHaveBeenCalledWith({
        email: "alex@example.com",
        password: "password123",
        metadata: expect.objectContaining({
          role: "patient",
          first_name: "Alex",
          last_name: "Morgan",
          mrn: "MRN-00123456",
          date_of_birth: "1990-05-22",
          sex_at_birth: "unknown",
        }),
      });
    });
  });

  test("calls authApi.signUp without patient fields when role is provider", async () => {
    render(<Signup {...defaultProps} />);

    fireEvent.click(screen.getByText("Provider"));

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Dr. Smith" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Jones" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "drsmith@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /create provider account/i }),
    );

    await waitFor(() => {
      expect(authApi.signUp).toHaveBeenCalledWith({
        email: "drsmith@example.com",
        password: "password123",
        metadata: expect.objectContaining({
          role: "provider",
          first_name: "Dr. Smith",
          last_name: "Jones",
        }),
      });
    });

    const callArg = authApi.signUp.mock.calls[0][0];
    expect(callArg.metadata).not.toHaveProperty("mrn");
    expect(callArg.metadata).not.toHaveProperty("date_of_birth");
  });

  // --- Submit: success (no session) ---

  test("shows confirmation message when signup succeeds with no session", async () => {
    render(<Signup {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Morgan" },
    });
    fireEvent.change(screen.getByLabelText("Medical record number (MRN)"), {
      target: { value: "MRN-001" },
    });
    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /create patient account/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Account created. Check your email to confirm before signing in.",
        ),
      ).toBeInTheDocument();
    });
  });

  // --- Submit: success (with session) ---

  test("calls onSignedUp with session when signup returns a session", async () => {
    const fakeSession = { access_token: "fake-token" };
    authApi.signUp.mockResolvedValue({ session: fakeSession });

    render(<Signup {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Morgan" },
    });
    fireEvent.change(screen.getByLabelText("Medical record number (MRN)"), {
      target: { value: "MRN-001" },
    });
    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /create patient account/i }),
    );

    await waitFor(() => {
      expect(mockOnSignedUp).toHaveBeenCalledWith(fakeSession, "patient");
    });
  });

  // --- Submit: error ---

  test("shows error message when signup fails", async () => {
    authApi.signUp.mockRejectedValue(
      new Error(
        "Please use at least 6 characters (you are currently using 2 characters).",
      ),
    );

    render(<Signup {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Morgan" },
    });
    fireEvent.change(screen.getByLabelText("Medical record number (MRN)"), {
      target: { value: "MRN-001" },
    });
    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "ab" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /create patient account/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Please use at least 6 characters (you are currently using 2 characters).",
        ),
      ).toBeInTheDocument();
    });
  });

  test("shows loading state while submitting", async () => {
    authApi.signUp.mockImplementation(() => new Promise(() => {}));

    render(<Signup {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Morgan" },
    });
    fireEvent.change(screen.getByLabelText("Medical record number (MRN)"), {
      target: { value: "MRN-001" },
    });
    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /create patient account/i }),
    );

    expect(screen.getByText("Creating account…")).toBeInTheDocument();
  });

  // --- Navigation ---

  test("calls onSwitchToLogin when sign in instead is clicked", () => {
    render(<Signup {...defaultProps} />);

    fireEvent.click(screen.getByText("Sign in instead"));

    expect(mockOnSwitchToLogin).toHaveBeenCalledTimes(1);
  });
});
