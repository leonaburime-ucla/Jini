import { Router } from 'express';
export const apiRoutes = Router();
apiRoutes.get('/users', (req, res) => res.json([]));
