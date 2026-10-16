export const env = {
  autopilot: process.env.NEXT_PUBLIC_AUTOPILOT !== "0",
  // Chrome Web Store listing for the Autopilot extension; until it is set, the site offers the packed zip instead.
  autopilotStoreUrl: process.env.NEXT_PUBLIC_AUTOPILOT_STORE_URL ?? "",
};
