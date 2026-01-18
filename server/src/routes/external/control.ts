/**
 * External Control API
 * Third-party API for device control
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { db } from '../../db/connection.js'; // ✅ เปลี่ยนเป็น ../../ แทน ../
import { logDeviceControl } from '../../services/activityLog.js';
import { verifyApiKey } from '../../middleware/apiAuth.js';

const router = Router();

// Apply API key verification
router.use(verifyApiKey);

/**
 * POST /api/external/v1/control/devices/:projectKey/:ghKey/control
 * Control a single device
 * 
 * Body:
 * {
 *   "controlKey": "pump1",
 *   "value": true
 * }
 */
router.post('/devices/:projectKey/:ghKey/control', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { controlKey, value } = req.body;
    const apiKeyPrefix = (req as any).apiKeyPrefix;
    
    if (!controlKey || value === undefined) {
      res.status(400).json({
        success: false,
        error: 'controlKey and value are required'
      });
      return;
    }
    
    // Get project
    const project: any = db.prepare('SELECT * FROM projects WHERE key = ?').get(projectKey);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    
    // Get greenhouse
    const greenhouse: any = db.prepare(`
      SELECT * FROM greenhouses 
      WHERE project_id = ? AND gh_key = ?
    `).get(project.id, ghKey);
    
    if (!greenhouse) {
      res.status(404).json({ success: false, error: 'Greenhouse not found' });
      return;
    }
    
    // Get control config
    const control: any = db.prepare(`
      SELECT * FROM control_configs 
      WHERE greenhouse_id = ? AND control_key = ?
    `).get(greenhouse.id, controlKey);
    
    if (!control) {
      res.status(404).json({ success: false, error: 'Control device not found' });
      return;
    }
    
    // Authenticate with ThingsBoard
    const authResponse = await axios.post(`${project.tb_base_url}/api/auth/login`, {
      username: project.tb_username,
      password: project.tb_password
    });
    
    const token = authResponse.data.token;
    
    // Send RPC command
    const rpcResponse = await axios.post(
      `${project.tb_base_url}/api/rpc/twoway/${greenhouse.tb_device_id}`,
      {
        method: control.rpc_method,
        params: { [controlKey]: value },
        timeout: 5000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': `Bearer ${token}`
        }
      }
    );
    
    // Log the action
    logDeviceControl({
      greenhouseId: greenhouse.id,
      controlKey,
      controlName: control.name_th,
      action: value ? 'ON' : 'OFF',
      value: String(value),
      source: 'external_api',
      apiKeyPrefix,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: true
    });
    
    res.json({
      success: true,
      data: {
        controlKey,
        value,
        response: rpcResponse.data
      }
    });
    
  } catch (error: any) {
    console.error('External control error:', error);
    
    // Log failure
    const { projectKey, ghKey } = req.params;
    const { controlKey, value } = req.body;
    
    if (controlKey) {
      logDeviceControl({
        greenhouseId: 0, // We might not have greenhouse_id at this point
        controlKey,
        action: 'FAILED',
        value: String(value),
        source: 'external_api',
        apiKeyPrefix: (req as any).apiKeyPrefix,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        errorMessage: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to control device'
    });
  }
});

/**
 * POST /api/external/v1/control/devices/:projectKey/:ghKey/batch
 * Control multiple devices at once
 * 
 * Body:
 * {
 *   "controls": [
 *     { "controlKey": "pump1", "value": true },
 *     { "controlKey": "fan1", "value": false }
 *   ]
 * }
 */
router.post('/devices/:projectKey/:ghKey/batch', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { controls } = req.body;
    
    if (!Array.isArray(controls) || controls.length === 0) {
      res.status(400).json({
        success: false,
        error: 'controls array is required'
      });
      return;
    }
    
    // Get project
    const project: any = db.prepare('SELECT * FROM projects WHERE key = ?').get(projectKey);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }
    
    // Get greenhouse
    const greenhouse: any = db.prepare(`
      SELECT * FROM greenhouses 
      WHERE project_id = ? AND gh_key = ?
    `).get(project.id, ghKey);
    
    if (!greenhouse) {
      res.status(404).json({ success: false, error: 'Greenhouse not found' });
      return;
    }
    
    // Authenticate with ThingsBoard
    const authResponse = await axios.post(`${project.tb_base_url}/api/auth/login`, {
      username: project.tb_username,
      password: project.tb_password
    });
    
    const token = authResponse.data.token;
    
    // Process each control
    const results = [];
    for (const ctrl of controls) {
      try {
        // Get control config
        const control: any = db.prepare(`
          SELECT * FROM control_configs 
          WHERE greenhouse_id = ? AND control_key = ?
        `).get(greenhouse.id, ctrl.controlKey);
        
        if (!control) {
          results.push({
            controlKey: ctrl.controlKey,
            success: false,
            error: 'Control device not found'
          });
          continue;
        }
        
        // Send RPC command
        const rpcResponse = await axios.post(
          `${project.tb_base_url}/api/rpc/twoway/${greenhouse.tb_device_id}`,
          {
            method: control.rpc_method,
            params: { [ctrl.controlKey]: ctrl.value },
            timeout: 5000
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Authorization': `Bearer ${token}`
            }
          }
        );
        
        // Log success
        logDeviceControl({
          greenhouseId: greenhouse.id,
          controlKey: ctrl.controlKey,
          controlName: control.name_th,
          action: ctrl.value ? 'ON' : 'OFF',
          value: String(ctrl.value),
          source: 'external_api',
          apiKeyPrefix: (req as any).apiKeyPrefix,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          success: true
        });
        
        results.push({
          controlKey: ctrl.controlKey,
          success: true,
          response: rpcResponse.data
        });
        
      } catch (error: any) {
        // Log failure
        logDeviceControl({
          greenhouseId: greenhouse.id,
          controlKey: ctrl.controlKey,
          action: 'FAILED',
          value: String(ctrl.value),
          source: 'external_api',
          apiKeyPrefix: (req as any).apiKeyPrefix,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          success: false,
          errorMessage: error.message
        });
        
        results.push({
          controlKey: ctrl.controlKey,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      data: results
    });
    
  } catch (error: any) {
    console.error('Batch control error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to control devices'
    });
  }
});

export default router;