import { Request, Response } from 'express';
import { hashSecret } from '../internal/crypto';  // VIOLATION: blocking rule

export function handleWebhook(req: Request, res: Response) {
  const verified = hashSecret(req.body.signature);
  return res.json({ verified });
}
