import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";
import { authClient } from "../lib/auth-client";
import {
  validateAuth,
  type AuthValues,
  type FieldErrors,
} from "../lib/validation";
import { AuthLayout } from "../components/AuthLayout";
import { Field } from "../components/Field";
import { LeaveDialog } from "../components/LeaveDialog";

const empty: AuthValues = { name: "", email: "", password: "", confirm: "" };

export function AuthPage({ signup }: { signup: boolean }) {
  const [values, setValues] = useState<AuthValues>(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const inFlight = useRef(false);
  const saved = useRef(false);
  const banner = useRef<HTMLDivElement>(null);
  const dirty = Object.values(values).some(Boolean);
  useEffect(() => {
    document.title = `${signup ? "Create account" : "Sign in"} · Expense Tracker`;
  }, [signup]);
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {
      if (dirty && !saved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);
  useEffect(() => {
    if (message) banner.current?.focus();
  }, [message]);

  const update = (key: keyof AuthValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setMessage("");
  };
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      dirty &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.button === 0
    ) {
      event.preventDefault();
      setDestination(event.currentTarget.pathname);
    }
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors = validateAuth(values, signup);
    setErrors(nextErrors);
    setMessage("");
    const first = Object.keys(nextErrors)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      const result = signup
        ? await authClient.signUp.email({
            name: values.name.trim(),
            email: values.email.trim().toLowerCase(),
            password: values.password,
          })
        : await authClient.signIn.email({
            email: values.email.trim().toLowerCase(),
            password: values.password,
          });
      if (result.error) {
        if (result.error.status === 429)
          setMessage("Too many attempts. Wait a minute, then try again.");
        else if (!signup && result.error.status === 401) {
          setMessage("The email or password is incorrect. Please try again.");
          setValues((current) => ({ ...current, password: "" }));
        } else if (signup && result.error.code?.includes("USER_ALREADY_EXISTS"))
          setMessage(
            "Unable to create this account. Try signing in with this email instead.",
          );
        else
          setMessage(
            signup
              ? "We couldn’t create your account. Check your details and try again."
              : "Unable to sign in right now. Please try again.",
          );
        return;
      }
      saved.current = true;
      window.location.assign("/app");
    } catch {
      setMessage(
        "Unable to connect. Check your connection and try again. Your details are still here.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <AuthLayout>
      <div className="form-column">
        <p className="form-step">
          {signup ? "A FRESH START" : "YOUR PERSONAL LEDGER"}
        </p>
        <h1>{signup ? "Create your account" : "Welcome back"}</h1>
        <p className="form-description">
          {signup
            ? "Your everyday spending deserves a little clarity."
            : "Good to see you. Let’s pick up where you left off."}
        </p>
        <form onSubmit={submit} noValidate aria-busy={pending}>
          <div className="form-notice-slot">
            {message && (
              <div
                className="form-notice"
                role="alert"
                tabIndex={-1}
                ref={banner}
              >
                <AlertCircle size={18} aria-hidden="true" />
                <span>{message}</span>
              </div>
            )}
          </div>
          {signup && (
            <Field
              id="name"
              name="name"
              label="Your name"
              type="text"
              autoComplete="name"
              placeholder="Alex Morgan"
              maxLength={80}
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              error={errors.name}
              disabled={pending}
              required
            />
          )}
          <Field
            id="email"
            name="email"
            label="Email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={254}
            spellCheck={false}
            autoCapitalize="none"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            error={errors.email}
            disabled={pending}
            required
          />
          <Field
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={
              signup ? "Create a strong password" : "Enter your password"
            }
            maxLength={128}
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
            error={errors.password}
            hint={
              signup
                ? "Use 12–128 characters. A few memorable words work well."
                : undefined
            }
            disabled={pending}
            required
          />
          {signup && (
            <Field
              id="confirm"
              name="confirm"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter your password again"
              maxLength={128}
              value={values.confirm}
              onChange={(e) => update("confirm", e.target.value)}
              error={errors.confirm}
              disabled={pending}
              required
            />
          )}
          <button
            type="submit"
            className="primary-button submit-button"
            disabled={pending}
          >
            <span>
              {pending
                ? signup
                  ? "Creating account…"
                  : "Signing in…"
                : signup
                  ? "Create account"
                  : "Sign in"}
            </span>
            {pending ? (
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
            ) : (
              <ArrowRight size={18} aria-hidden="true" />
            )}
          </button>
          <span className="sr-only" role="status">
            {pending ? (signup ? "Creating your account" : "Signing in") : ""}
          </span>
        </form>
        <p className="switch-auth">
          {signup ? "Already have an account?" : "New to Expense Tracker?"}{" "}
          <a href={signup ? "/sign-in" : "/sign-up"} onClick={navigate}>
            {signup ? "Sign in" : "Create an account"}
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </p>
        <div className="form-bottom">
          <LockKeyhole size={14} aria-hidden="true" />
          <span>A private workspace, just for you.</span>
        </div>
      </div>
      <LeaveDialog
        destination={destination}
        onCancel={() => setDestination(null)}
        onDiscard={() => {
          saved.current = true;
          if (destination) window.location.assign(destination);
        }}
      />
    </AuthLayout>
  );
}
