import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LINK_ERROR_COPY, loginErrorMessage } from "@/lib/auth/login-error";

describe("login ?error= copy", () => {
  it("error=link gets the friendly expired-link message", () => {
    expect(loginErrorMessage("link")).toBe("That sign-in link expired or was already used — request a new one.");
    expect(LINK_ERROR_COPY).toBe(loginErrorMessage("link"));
  });
  it("anything else shows nothing (never echoes the query string)", () => {
    for (const v of [undefined, "", "other", "<script>", ["link", "x"]]) expect(loginErrorMessage(v as never)).toBeNull();
  });
  it("the login form renders it as role=alert", async () => {
    const { LoginForm } = await import("@/app/login/login-form");
    const html = renderToStaticMarkup(createElement(LoginForm, { initialError: LINK_ERROR_COPY }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("That sign-in link expired or was already used");
    expect(renderToStaticMarkup(createElement(LoginForm, { initialError: null }))).not.toContain('role="alert"');
  });
});
