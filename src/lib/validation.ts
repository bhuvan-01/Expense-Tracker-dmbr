export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export type AuthValues = {
  name: string;
  email: string;
  password: string;
  confirm: string;
};
export type FieldErrors = Partial<Record<keyof AuthValues, string>>;

export function validateAuth(values: AuthValues, signup: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (signup && (!values.name.trim() || values.name.trim().length > 80)) {
    errors.name = "Enter your name using 1–80 characters.";
  }
  if (
    values.email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  ) {
    errors.email = "Enter a valid email address, such as you@example.com.";
  }
  if (!values.password) errors.password = "Enter your password.";
  else if (
    signup &&
    (values.password.length < PASSWORD_MIN ||
      values.password.length > PASSWORD_MAX)
  ) {
    errors.password = `Use ${PASSWORD_MIN}–${PASSWORD_MAX} characters for your password.`;
  } else if (values.password.length > PASSWORD_MAX)
    errors.password = "Your password is too long.";
  if (signup && values.password !== values.confirm)
    errors.confirm = "Your passwords do not match.";
  return errors;
}
