export const DESKTOP_PORT = 3917;
/** True inside the Mac app: the Electron shell sets PLACED_DESKTOP=1 on the server it spawns. */
export const isDesktop = (env: Record<string, string | undefined> = process.env) => env.PLACED_DESKTOP === "1";
