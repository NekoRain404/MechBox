export function getElectronDb() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.electron?.db ?? null;
}

export function isElectronDbAvailable() {
  return !!getElectronDb();
}
