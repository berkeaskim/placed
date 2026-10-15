// Runs only on the Placed site: tells it the extension is installed, so the install steps can step aside.
document.documentElement.setAttribute("data-placed-autopilot", chrome.runtime.getManifest().version);
