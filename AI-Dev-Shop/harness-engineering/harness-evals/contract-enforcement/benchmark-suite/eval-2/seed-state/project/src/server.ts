import express from 'express';
import { authMiddleware } from './auth';
import { userRoutes } from './routes/users';

const app = express();
app.use(authMiddleware);
app.use('/api/users', userRoutes);
app.listen(process.env.PORT || 3000);
