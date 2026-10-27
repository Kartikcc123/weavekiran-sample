const isDevelopment = import.meta.env.DEV;
const deployedOrigin = typeof window === 'undefined' ? '' : window.location.origin;
const deployedWebSocketOrigin = typeof window === 'undefined'
  ? ''
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

// Local development keeps using the FastAPI server on port 8000.  In a
// production build served by FastAPI/Render, use the current origin instead
// of the visitor's localhost.
export const API_BASE_URL = import.meta.env.VITE_API_URL
  || (isDevelopment ? 'http://127.0.0.1:8000' : deployedOrigin);
export const WS_URL = import.meta.env.VITE_WS_URL
  || (isDevelopment ? 'ws://127.0.0.1:8000' : deployedWebSocketOrigin);
