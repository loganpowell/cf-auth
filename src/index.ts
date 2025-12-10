/**
 * Main Cloudflare Worker entry point
 * 
 * This worker handles all authentication and authorization requests
 * using the Hono framework for routing.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

// Create Hono app with typed environment
const app = new Hono<{ Bindings: Env }>();

// Global CORS middleware
app.use('/*', cors({
  origin: (origin) => {
    // TODO: Implement dynamic CORS based on domain_configs table
    return origin;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '0.1.0',
  });
});

// API v1 routes
const v1 = new Hono<{ Bindings: Env }>();

// Auth routes (Phase 2)
v1.post('/auth/register', (c) => {
  return c.json({ message: 'Registration endpoint - to be implemented' }, 501);
});

v1.post('/auth/login', (c) => {
  return c.json({ message: 'Login endpoint - to be implemented' }, 501);
});

v1.post('/auth/refresh', (c) => {
  return c.json({ message: 'Token refresh endpoint - to be implemented' }, 501);
});

v1.post('/auth/logout', (c) => {
  return c.json({ message: 'Logout endpoint - to be implemented' }, 501);
});

v1.get('/auth/me', (c) => {
  return c.json({ message: 'Get current user endpoint - to be implemented' }, 501);
});

// Mount v1 routes
app.route('/v1', v1);

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: c.req.path,
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
  }, 500);
});

export default app;
