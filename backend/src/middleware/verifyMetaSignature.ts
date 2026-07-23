import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Verifies the `X-Hub-Signature-256` header Meta sends on every webhook POST,
 * so the endpoint can't be spoofed by anyone who finds the (public, unauthenticated) URL.
 * Requires `req.rawBody` to be populated by the express.json() `verify` hook in index.ts.
 */
export function verifyMetaSignature(req: Request, res: Response, next: NextFunction) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    console.warn('WHATSAPP_APP_SECRET is not set — skipping webhook signature verification. This is unsafe for production.');
    return next();
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  if (typeof signatureHeader !== 'string' || !req.rawBody) {
    console.warn('Webhook signature check: missing header or rawBody', {
      hasHeader: typeof signatureHeader === 'string',
      hasRawBody: !!req.rawBody,
    });
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  const expectedSignature = `sha256=${crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex')}`;
  const expected = Buffer.from(expectedSignature, 'utf8');
  const actual = Buffer.from(signatureHeader, 'utf8');

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    console.warn('Webhook signature mismatch', {
      expectedPrefix: expectedSignature.slice(0, 15),
      actualPrefix: signatureHeader.slice(0, 15),
      rawBodyLength: req.rawBody.length,
    });
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
}
