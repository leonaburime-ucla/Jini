import { Router } from 'express';
export const userRoutes = Router();
userRoutes.get('/', (req, res) => res.json([]));
userRoutes.post('/', (req, res) => res.status(201).json({ id: '1' }));
