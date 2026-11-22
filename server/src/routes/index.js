import { Router } from 'express';
import authRoutes from './auth.js';
import { checkDb } from '../config/db.js';
import { asyncHandler, ok } from '../utils/response.js';
import shiftRoutes from './shifts.js';
import orderRoutes from './orders.js';
import paymentRoutes from './payments.js';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req, res) => ok(res, { server: 'ok', database: (await checkDb()) ? 'ok' : 'error' }))
);

router.use('/auth', authRoutes);

// Tempat mendaftarkan route modul lain (jangan ubah route milik orang lain):
router.use('/shifts', shiftRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
// router.use('/menus', menuRoutes);     // Ilham
// router.use('/reports', reportRoutes); // Ilham
// router.use('/users', userRoutes);     // Ilham

export default router;
