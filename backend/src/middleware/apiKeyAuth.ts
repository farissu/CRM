import { Request, Response, NextFunction } from 'express';

/**
 * Authenticates external integrations (n8n, scripts, etc.) via a static API key,
 * separate from the JWT-based `authenticate` middleware used by dashboard agents.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INTEGRATION_API_KEY;
  if (!expected) {
    res.status(500).json({ error: 'Integration API not configured' });
    return;
  }

  const provided = req.headers['x-api-key'];
  if (typeof provided !== 'string' || provided !== expected) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
