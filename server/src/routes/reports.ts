/**
 * Report Generation Routes
 * Generate and download PDF reports
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/connection.js';
import { sendSuccess, sendError, ThaiErrors } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit, AuditActions } from '../utils/audit.js';
import { reportService } from '../services/reportGenerator.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

// ============================================================
// Validation
// ============================================================

const reportQuerySchema = z.object({
  project: z.string().min(1),
  gh: z.string().min(1),
  period: z.enum(['1d', '7d', '30d']),
});

// ============================================================
// Helper: Check Project Access
// ============================================================

function hasProjectAccess(userId: number, userRole: string, projectKey: string): boolean {
  if (userRole === 'admin') return true;

  const access = db.prepare(`
    SELECT 1 FROM user_project_access upa
    JOIN projects p ON upa.project_id = p.id
    WHERE upa.user_id = ? AND p.key = ?
  `).get(userId, projectKey);

  return !!access;
}

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/reports/download
 * Download PDF report
 */
router.get('/download', async (req: Request, res: Response) => {
  try {
    const parsed = reportQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, period } = parsed.data;

    // Check access
    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    // Generate PDF
    const pdfBuffer = await reportService.generatePdfReport({
      projectKey: project,
      ghKey: gh,
      period,
    });

    const filename = reportService.getReportFilename(project, gh, period);

    // Log report generation
    logAudit({
      userId: req.session.userId ?? null,
      action: AuditActions.REPORT_GENERATED,
      projectKey: project,
      ghKey: gh,
      detail: { period, filename },
    });

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating report:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.SERVER_ERROR;
    sendError(res, message, 500);
  }
});

/**
 * GET /api/reports/preview
 * Get report data for preview (JSON)
 */
router.get('/preview', async (req: Request, res: Response) => {
  try {
    const parsed = reportQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendError(res, ThaiErrors.INVALID_INPUT, 400);
      return;
    }

    const { project, gh, period } = parsed.data;

    // Check access
    if (!hasProjectAccess(req.session.userId!, req.session.role!, project)) {
      sendError(res, ThaiErrors.NO_PROJECT_ACCESS, 403);
      return;
    }

    // Fetch report data
    const data = await reportService.fetchReportData({
      projectKey: project,
      ghKey: gh,
      period,
    });

    sendSuccess(res, { report: data });
  } catch (error) {
    console.error('Error fetching report data:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.SERVER_ERROR;
    sendError(res, message, 500);
  }
});

export default router;
