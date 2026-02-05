import { Router } from 'express';
import usersRouter from './users.js';
import projectsRouter from './projects.js';
import greenhousesRouter from './greenhouses.js';
import settingsRouter from './settings.js';
import sensorsRouter from './sensors.js';
import controlsRouter from './controls.js';
import auditRouter from './audit.js';
import logsRouter from './logs.js';  // ✅ เพิ่มบรรทัดนี้

const router = Router();

router.use('/users', usersRouter);
router.use('/projects', projectsRouter);
router.use('/greenhouses', greenhousesRouter);
router.use('/settings', settingsRouter);
router.use('/sensors', sensorsRouter);
router.use('/controls', controlsRouter);
router.use('/audit', auditRouter);
router.use('/logs', logsRouter);  // ✅ เพิ่มบรรทัดนี้

export default router;