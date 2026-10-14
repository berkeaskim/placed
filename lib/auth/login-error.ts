/** /login?error=<code> copy. Only known codes map to text: the query string is never echoed onto the page. */
export const LINK_ERROR_COPY = "That sign-in link expired or was already used — request a new one.";

export function loginErrorMessage(code: string | string[] | undefined): string | null {
  return code === "link" ? LINK_ERROR_COPY : null;
}
