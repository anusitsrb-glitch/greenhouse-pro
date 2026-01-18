/**
 * External API Routes Index
 * Combines all external API routes
 */

import { Router } from 'express';
import dataRoutes from './data.js';
import controlRoutes from './control.js';

const router = Router();

// Mount sub-routes
router.use('/data', dataRoutes);
router.use('/control', controlRoutes);

// API documentation endpoint
router.get('/', (_req, res) => {
  res.json({
    name: 'GreenHouse Pro External API',
    version: '1.0.0',
    description: 'Third-party API access for greenhouse data and control',
    endpoints: {
      data: {
        latest: 'GET /api/external/v1/data/greenhouses/:projectKey/:ghKey/latest',
        history: 'GET /api/external/v1/data/greenhouses/:projectKey/:ghKey/history?days=7',
        deviceStatus: 'GET /api/external/v1/data/devices/:projectKey/:ghKey/status',
      },
      control: {
        single: 'POST /api/external/v1/control/devices/:projectKey/:ghKey/control',
        batch: 'POST /api/external/v1/control/devices/:projectKey/:ghKey/batch',
      },
    },
    authentication: {
      type: 'API Key',
      header: 'X-API-Key',
      example: 'X-API-Key: ghp_readonly_abc123xyz789',
    },
    documentation: 'https://docs.yourdomain.com/external-api',
  });
});

export default router;