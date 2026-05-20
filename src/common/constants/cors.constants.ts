/**
 * Centralized CORS configuration for the application
 * Use this constant in main.ts, WebSocket gateways, and exception filters
 */
export const ALLOWED_ORIGINS = [
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  // Production domains
  'https://smart-solutions-server-sv.saikat.com.bd',
  'https://smart-solutions-sv.saikat.com.bd',
  // Without https (in case)
  'http://smart-solutions-server-sv.saikat.com.bd',
  'http://smart-solutions-sv.saikat.com.bd',
];

// Pattern to match allowed origins (for more flexible matching)
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/.*\.saikat\.com\.bd$/,
  /^https?:\/\/smart-solutions.*\.saikat\.com\.bd$/,
];

export const CORS_METHODS = [
  'GET',
  'HEAD',
  'PUT',
  'PATCH',
  'POST',
  'DELETE',
  'OPTIONS',
];

export const CORS_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept',
  'Origin',
  'X-Requested-With',
  'Access-Control-Allow-Origin',
  'Access-Control-Request-Method',
  'Access-Control-Request-Headers',
];

/**
 * Check if an origin is allowed
 */
export const isOriginAllowed = (origin: string | undefined): boolean => {
  // Allow requests with no origin (mobile apps, curl, postman, same-origin)
  if (!origin) return true;

  // Check exact match first
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Check pattern match
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
};

/**
 * CORS configuration for WebSocket gateways
 */
export const WEBSOCKET_CORS_CONFIG = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean | string) => void,
  ) => {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, origin || true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: CORS_METHODS,
};