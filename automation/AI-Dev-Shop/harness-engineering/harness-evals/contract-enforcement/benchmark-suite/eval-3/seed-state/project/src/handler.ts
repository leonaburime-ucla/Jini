import { Request, Response } from 'express';

export function handleCreateUser(req: Request, res: Response) {
  const { email, password } = req.body;
  // After programmer modifies: introduces `const unusedVar = 'test';`
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  return res.status(201).json({ id: crypto.randomUUID(), email });
}
