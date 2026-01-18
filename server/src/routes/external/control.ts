/**
 * External Control API
 * Provides device control access for third-party applications
 * Requires 'control' permission
 */

import { Router, Request, Response } from 'express';
import { sendSuccess, sendError, ThaiErrors } from '../../utils/response.js';
import { tbService } from '../../services/thingsboard.js';
import { apiKeyAuth } from '../../middleware/apiKey.js';
import { z } from 'zod';

const router = Router();

// Apply API Key authentication with 'control' permission to all routes
router.use(apiKeyAuth('control'));

// ============================================================
// Validation Schemas
// ============================================================

const controlDeviceSchema = z.object({
  projectKey: z.string().min(1),
  ghKey: z.string().min(1),
});

const controlBodySchema = z.object({
  device: z.enum(['pump', 'fan', 'light', 'motor']),
  action: z.enum(['on', 'off']),
  duration: z.number().optional(), // Duration in seconds (for timed control)
});

// ============================================================
// Routes
// ============================================================

/**
 * POST /api/external/v1/control/devices/:projectKey/:ghKey/control
 * Send control command to device
 * 
 * Body:
 * {
 *   "device": "pump" | "fan" | "light" | "motor",
 *   "action": "on" | "off",
 *   "duration": 300 (optional, in seconds)
 * }
 * 
 * Example:
 * POST /api/external/v1/control/devices/maejard/greenhouse8/control
 * Headers: 
 *   X-API-Key: ghp_fullaccess_xyz789abc123
 *   Content-Type: application/json
 * Body: 
 *   { "device": "pump", "action": "on" }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "device": "pump",
 *     "action": "on",
 *     "status": "success",
 *     "timestamp": 1705478400000
 *   },
 *   "message": "Device controlled successfully"
 * }
 */
router.post('/devices/:projectKey/:ghKey/control', async (req: Request, res: Response) => {
  try {
    const paramsResult = controlDeviceSchema.safeParse(req.params);
    const bodyResult = controlBodySchema.safeParse(req.body);
    
    if (!paramsResult.success || !bodyResult.success) {
      sendError(res, 'Invalid parameters or body', 400);
      return;
    }
    
    const { projectKey, ghKey } = paramsResult.data;
    const { device, action, duration } = bodyResult.data;
    
    // Check if device is online first
    const isOnline = await tbService.isDeviceOnline(projectKey, ghKey);
    
    if (!isOnline) {
      sendError(res, 'Device is offline. Cannot send control command.', 503);
      return;
    }
    
    // Prepare RPC method and params
    let rpcMethod = '';
    let rpcParams: any = { action };
    
    switch (device) {
      case 'pump':
        rpcMethod = 'control_pump';
        break;
      case 'fan':
        rpcMethod = 'control_fan';
        break;
      case 'light':
        rpcMethod = 'control_light';
        break;
      case 'motor':
        rpcMethod = 'control_motor';
        break;
      default:
        sendError(res, 'Invalid device type', 400);
        return;
    }
    
    // Add duration if specified
    if (duration) {
      rpcParams.duration = duration;
    }
    
    // Send RPC command to device
    console.log(`🚀 External API: Sending RPC to ${ghKey} - ${device} ${action}`);
    
    const rpcResponse = await tbService.sendRpcCommand(
      projectKey,
      ghKey,
      rpcMethod,
      rpcParams,
      20000 // 20 second timeout
    );
    
    console.log(`✅ External API: RPC success for ${ghKey}`);
    
    sendSuccess(res, {
      data: {
        device,
        action,
        status: 'success',
        timestamp: Date.now(),
        rpcResponse,
      },
      message: 'Device controlled successfully',
    });
  } catch (error) {
    console.error('Error controlling device:', error);
    
    let message = ThaiErrors.TB_CONNECTION_ERROR;
    let statusCode = 502;
    
    if (error instanceof Error) {
      message = error.message;
      
      if (message.includes('Timeout')) {
        statusCode = 504;
        message = 'Device did not respond in time';
      } else if (message.includes('offline')) {
        statusCode = 503;
      }
    }
    
    sendError(res, message, statusCode);
  }
});

/**
 * POST /api/external/v1/control/devices/:projectKey/:ghKey/batch
 * Send multiple control commands at once
 * 
 * Body:
 * {
 *   "commands": [
 *     { "device": "pump", "action": "on" },
 *     { "device": "fan", "action": "off" },
 *     ...
 *   ]
 * }
 * 
 * Example:
 * POST /api/external/v1/control/devices/maejard/greenhouse8/batch
 * Headers: X-API-Key: ghp_fullaccess_xyz789abc123
 * Body: 
 *   { "commands": [
 *       { "device": "pump", "action": "on" },
 *       { "device": "fan", "action": "off" }
 *     ]
 *   }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "results": [
 *       { "device": "pump", "action": "on", "status": "success" },
 *       { "device": "fan", "action": "off", "status": "success" }
 *     ],
 *     "successCount": 2,
 *     "failureCount": 0
 *   }
 * }
 */
router.post('/devices/:projectKey/:ghKey/batch', async (req: Request, res: Response) => {
  try {
    const paramsResult = controlDeviceSchema.safeParse(req.params);
    
    if (!paramsResult.success) {
      sendError(res, 'Invalid parameters', 400);
      return;
    }
    
    const { projectKey, ghKey } = paramsResult.data;
    const { commands } = req.body;
    
    if (!Array.isArray(commands) || commands.length === 0) {
      sendError(res, 'Commands array is required', 400);
      return;
    }
    
    if (commands.length > 10) {
      sendError(res, 'Maximum 10 commands per batch', 400);
      return;
    }
    
    // Check if device is online
    const isOnline = await tbService.isDeviceOnline(projectKey, ghKey);
    
    if (!isOnline) {
      sendError(res, 'Device is offline. Cannot send control commands.', 503);
      return;
    }
    
    // Process each command
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const cmd of commands) {
      const cmdResult = controlBodySchema.safeParse(cmd);
      
      if (!cmdResult.success) {
        results.push({
          device: cmd.device || 'unknown',
          action: cmd.action || 'unknown',
          status: 'failed',
          error: 'Invalid command format',
        });
        failureCount++;
        continue;
      }
      
      const { device, action, duration } = cmdResult.data;
      
      try {
        let rpcMethod = '';
        
        switch (device) {
          case 'pump':
            rpcMethod = 'control_pump';
            break;
          case 'fan':
            rpcMethod = 'control_fan';
            break;
          case 'light':
            rpcMethod = 'control_light';
            break;
          case 'motor':
            rpcMethod = 'control_motor';
            break;
        }
        
        const rpcParams: any = { action };
        if (duration) rpcParams.duration = duration;
        
        await tbService.sendRpcCommand(projectKey, ghKey, rpcMethod, rpcParams, 20000);
        
        results.push({
          device,
          action,
          status: 'success',
        });
        successCount++;
      } catch (error) {
        results.push({
          device,
          action,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }
    }
    
    sendSuccess(res, {
      data: {
        results,
        successCount,
        failureCount,
      },
      message: `Batch control completed: ${successCount} succeeded, ${failureCount} failed`,
    });
  } catch (error) {
    console.error('Error in batch control:', error);
    const message = error instanceof Error ? error.message : ThaiErrors.TB_CONNECTION_ERROR;
    sendError(res, message, 502);
  }
});

export default router;