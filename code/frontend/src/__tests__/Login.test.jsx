/*
 * AI-USAGE SUMMARY
 * Model: Claude Sonnet 4.6
 * Overall AI Contribution: ~80%
 * AI-Assisted Areas: Test structure, mock setup, and biometric flow stubs
 * Human Contributions: Defined test cases and verified against actual Login behavior
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "../loginsignup/Login";
import { authApi } from "../lib/authApi";

jest.mock("../lib/authApi", () => ({
  authApi: {
    signIn: jest.fn(),
    signInBiometric: jest.fn(),
  },
}));

jest.mock("../Login.css", () => ({}));

const mockOnSignedIn = jest.fn();
const mockOnSwitchToSignup = jest.fn();

const defaultProps = {
  onSignedIn: mockOnSignedIn,
  onSwitchToSignup: mockOnSwitchToSignup,
};

describe("Login", () => {
  beforeEach(() => {
    authApi.signIn.mockResolvedValue({
      session: {
        access_token: "fake-token",
        refresh_token: "fake-refresh",
        user: {
          email: "test@test.com",
          user_metadata: { role: "patient" },
        },
      },
    });

    authApi.signInBiometric.mockResolvedValue({
      user: {
        email: "test@test.com",
        user_metadata: { role: "patient" },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Rendering ---

  test("renders the sign in form", () => {
    render(<Login {...defaultProps} />);

    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  test("renders the patient and provider role buttons", () => {
    render(<Login {...defaultProps} />);

    expect(screen.getByText("Patient")).toBeInTheDocument();
    expect(screen.getByText("Provider")).toBeInTheDocument();
  });

  test("renders the passkey button", () => {
    render(<Login {...defaultProps} />);

    expect(screen.getByText("Continue with passkey")).toBeInTheDocument();
  });

  test("renders the create account button", () => {
    render(<Login {...defaultProps} />);

    expect(
      screen.getByText("Create an account as Patient"),
    ).toBeInTheDocument();
  });

  // --- Role selector ---

  test("defaults to patient role", () => {
    render(<Login {...defaultProps} />);

    const submitButton = screen.getByRole("button", {
      name: /sign in as patient/i,
    });
    expect(submitButton).toBeInTheDocument();
  });

  test("switches to provider role when provider button is clicked", () => {
    render(<Login {...defaultProps} />);

    fireEvent.click(screen.getByText("Provider"));

    expect(
      screen.getByRole("button", { name: /sign in as provider/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create an account as Provider"),
    ).toBeInTheDocument();
  });

  // --- Form interaction ---

  test("updates email field when typed into", () => {
    render(<Login {...defaultProps} />);

    const emailInput = screen.getByLabelText("Email address");
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });

    expect(emailInput.value).toBe("test@example.com");
  });

  test("updates password field when typed into", () => {
    render(<Login {...defaultProps} />);

    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    expect(passwordInput.value).toBe("password123");
  });

  test("toggles password visibility when show button is clicked", () => {
    render(<Login {...defaultProps} />);

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput.type).toBe("password");

    fireEvent.click(screen.getByText("show"));
    expect(passwordInput.type).toBe("text");

    fireEvent.click(screen.getByText("hide"));
    expect(passwordInput.type).toBe("password");
  });

  // --- Normal sign in ---

  test("calls authApi.signIn with email and password on submit", async () => {
    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in as patient/i }));

    await waitFor(() => {
      expect(authApi.signIn).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
        role: "patient",
      });
    });
  });

  test("passes the selected provider role to authApi.signIn", async () => {
    render(<Login {...defaultProps} />);

    fireEvent.click(screen.getByText("Provider"));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "doc@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /sign in as provider/i }),
    );

    await waitFor(() => {
      expect(authApi.signIn).toHaveBeenCalledWith({
        email: "doc@test.com",
        password: "password123",
        role: "provider",
      });
    });
  });

  test("shows error when account does not have the selected role", async () => {
    authApi.signIn.mockRejectedValue(
      new Error("No provider account exists for this email."),
    );

    render(<Login {...defaultProps} />);

    fireEvent.click(screen.getByText("Provider"));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "patient@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /sign in as provider/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("No provider account exists for this email."),
      ).toBeInTheDocument();
    });
    expect(mockOnSignedIn).not.toHaveBeenCalled();
  });

  test("calls onSignedIn with session after successful sign in", async () => {
    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in as patient/i }));

    await waitFor(() => {
      expect(mockOnSignedIn).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: "fake-token" }),
        "patient",
      );
    });
  });

  test("shows error message when sign in fails", async () => {
    authApi.signIn.mockRejectedValue(new Error("Invalid credentials"));

    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in as patient/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  test("shows signing in text while loading", async () => {
    authApi.signIn.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000)),
    );

    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in as patient/i }));

    expect(screen.getByText("Signing in…")).toBeInTheDocument();
  });

  // --- Biometric sign in ---

  test("shows error when passkey button clicked without email", async () => {
    render(<Login {...defaultProps} />);

    fireEvent.click(screen.getByText("Continue with passkey"));

    await waitFor(() => {
      expect(
        screen.getByText("Enter your email to use biometric login."),
      ).toBeInTheDocument();
    });
  });

  test("calls authApi.signInBiometric with email when passkey button clicked", async () => {
    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(screen.getByText("Continue with passkey"));

    await waitFor(() => {
      expect(authApi.signInBiometric).toHaveBeenCalledWith("test@test.com");
    });
  });

  test("calls onSignedIn with user object after successful biometric login", async () => {
    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(screen.getByText("Continue with passkey"));

    await waitFor(() => {
      expect(mockOnSignedIn).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ email: "test@test.com" }),
        }),
      );
    });
  });

  test("shows error when biometric login fails", async () => {
    authApi.signInBiometric.mockRejectedValue(
      new Error("Biometric verification failed"),
    );

    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(screen.getByText("Continue with passkey"));

    await waitFor(() => {
      expect(
        screen.getByText("Biometric verification failed"),
      ).toBeInTheDocument();
    });
  });

  test("calls onSwitchToSignup with patient role when create account button is clicked", () => {
    render(<Login {...defaultProps} />);

    fireEvent.click(screen.getByText("Create an account as Patient"));

    expect(mockOnSwitchToSignup).toHaveBeenCalledWith("patient");
  });

  test("calls onSwitchToSignup with provider role when provider is toggled", () => {
    render(<Login {...defaultProps} />);

    fireEvent.click(screen.getByText("Provider"));
    fireEvent.click(screen.getByText("Create an account as Provider"));

    expect(mockOnSwitchToSignup).toHaveBeenCalledWith("provider");
  });
});