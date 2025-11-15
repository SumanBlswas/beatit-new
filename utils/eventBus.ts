type Listener = (payload?: any) => void;
const listeners: Record<string, Listener[]> = {};

export const on = (event: string, listener: Listener) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(listener);
  return () => off(event, listener);
};

export const off = (event: string, listener: Listener) => {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter((l) => l !== listener);
};

export const emit = (event: string, payload?: any) => {
  const ls = listeners[event] || [];
  for (const l of ls.slice()) {
    try {
      l(payload);
    } catch (e) {
      // Ignore listener errors
    }
  }
};

export default { on, off, emit };
