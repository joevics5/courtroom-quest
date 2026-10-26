/** True when this browser can draw WebGL (the 3D courtroom needs it). Kept tiny so it can load with the main bundle. */
export function webglAvailable(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
