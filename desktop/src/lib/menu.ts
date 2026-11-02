import { app, Menu, type MenuItemConstructorOptions } from "electron";

export interface MenuActions {
  checkForUpdates: () => void;
  openDataFolder: () => void;
  openLogsFolder: () => void;
}

/** The macOS menu bar. The Edit menu is what makes Cmd+C / Cmd+V work inside inputs. */
export function buildAppMenu({ checkForUpdates, openDataFolder, openLogsFolder }: MenuActions): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { label: "Check for Updates…", click: checkForUpdates },
        { type: "separator" },
        { label: "Open Data Folder", click: openDataFolder },
        { label: "Open Logs Folder", click: openLogsFolder },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        ...(app.isPackaged ? [] : [{ role: "toggleDevTools" } as const]),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "close" }] },
  ];
  return Menu.buildFromTemplate(template);
}
