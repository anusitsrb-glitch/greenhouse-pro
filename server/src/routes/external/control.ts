/**
 * External Control API
 * Third-party API for device control
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { db } from '../../db/connection.js';
import { logDeviceControl } from '../../services/activityLog.js';
import { validateApiKey, requirePermission } from '../../middleware/apiKey.js'; // ✅ เปลี่ยนเป็น validateApiKey

const router = Router();

// Apply API key verification with control permission
router.use(validateApiKey);
router.use(requirePermission('control'));

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
    
    // Map controlKey to RPC method (instead of querying database)
    const controlMapping: Record<string, { rpcMethod: string; nameTH: string; type: 'simple' | 'motor' }> = {
      fan1:   { rpcMethod: 'set_fan_1_cmd',   nameTH: 'พัดลม 1',   type: 'simple' },
      fan2:   { rpcMethod: 'set_fan_2_cmd',   nameTH: 'พัดลม 2',   type: 'simple' },
      pump1:  { rpcMethod: 'set_pump_1_cmd',  nameTH: 'ปั๊มน้ำ 1', type: 'simple' },
      valve2: { rpcMethod: 'set_valve_2_cmd', nameTH: 'วาล์ว 2',   type: 'simple' },
      light1: { rpcMethod: 'set_light_1_cmd', nameTH: 'ไฟ 1',     type: 'simple' },
      motor1: { rpcMethod: 'set_motor_1_status', nameTH: 'มอเตอร์ 1', type: 'motor' },
      motor2: { rpcMethod: 'set_motor_2_status', nameTH: 'มอเตอร์ 2', type: 'motor' },
      motor3: { rpcMethod: 'set_motor_3_status', nameTH: 'มอเตอร์ 3', type: 'motor' },
      motor4: { rpcMethod: 'set_motor_4_status', nameTH: 'มอเตอร์ 4', type: 'motor' },
    };
    
    const controlConfig = controlMapping[controlKey];
    if (!controlConfig) {
      res.status(404).json({ success: false, error: 'Control device not found' });
      return;
    }
    
    // Validate value based on type
    let rpcParams: any;
    if (controlConfig.type === 'simple') {
      // Simple devices: true/false or 1/0
      const boolValue = value === true || value === 1 || value === '1';
      rpcParams = boolValue ? 1 : 0;
    } else if (controlConfig.type === 'motor') {
      // Motors: 0=stop, 1=forward, 2=reverse or "stop"/"forward"/"reverse"
      if (value === 'stop' || value === 0 || value === '0') rpcParams = 0;
      else if (value === 'forward' || value === 1 || value === '1') rpcParams = 1;
      else if (value === 'reverse' || value === 2 || value === '2') rpcParams = 2;
      else {
        res.status(400).json({ 
          success: false, 
          error: 'Motor value must be 0/1/2 or stop/forward/reverse' 
        });
        return;
      }
    }
    
    // Authenticate with ThingsBoard
    const authResponse = await axios.post(`${project.tb_base_url}/api/auth/login`, {
      username: project.tb_username,
      password: project.tb_password
    });
    
    const token = authResponse.data.token;
    
    // Send RPC command
    const rpcResponse = await axios.post(
      `${project.tb_base_url}/api/rpc/twoway/${greenhouse.device_id}`,
      {
        method: controlConfig.rpcMethod,
        params: rpcParams,
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
    let actionText: string;
    if (controlConfig.type === 'simple') {
      actionText = rpcParams ? 'ON' : 'OFF';
    } else {
      actionText = rpcParams === 1 ? 'FORWARD' : rpcParams === 2 ? 'REVERSE' : 'STOP';
    }
    
    logDeviceControl({
      greenhouseId: greenhouse.id,
      controlKey,
      controlName: controlConfig.nameTH,
      action: actionText,
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