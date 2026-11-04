import { createAuthClient } from "better-auth/react";

// Same-origin requests; credentials and session tokens never go into localStorage.
export const authClient = createAuthClient();
