/** /login?error=<code> copy. Only known codes map to text: the query string is never echoed onto the page. */
export const LINK_ERROR_COPY = "That sign-in link expired or was already used — request a new one.";
export const GUEST_ERROR_COPY = "Couldn't start a new session right now. Try again in a moment.";

export function loginErrorMessage(code: string | string[] | undefined): string | null {
  if (code === "link") return LINK_ERROR_COPY;
  if (code === "guest") return GUEST_ERROR_COPY;
  return null;
}
