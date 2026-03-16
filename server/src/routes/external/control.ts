/**
 * External Control API
 * Third-party API for device control
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { query } from '../../db/connection.js';
import { logDeviceControl } from '../../services/activityLog.js';
import { validateApiKey, requirePermission } from '../../middleware/apiKey.js';

const router = Router();

router.use(validateApiKey);
router.use(requirePermission('control'));

const controlMapping: Record<string, { rpcMethod: string; nameTH: string; type: 'simple' | 'motor' }> = {
  fan1:   { rpcMethod: 'set_fan_1_cmd',      nameTH: 'พัดลม 1',   type: 'simple' },
  fan2:   { rpcMethod: 'set_fan_2_cmd',      nameTH: 'พัดลม 2',   type: 'simple' },
  pump1:  { rpcMethod: 'set_pump_1_cmd',     nameTH: 'ปั๊มน้ำ 1', type: 'simple' },
  valve2: { rpcMethod: 'set_valve_2_cmd',    nameTH: 'วาล์ว 2',   type: 'simple' },
  light1: { rpcMethod: 'set_light_1_cmd',    nameTH: 'ไฟ 1',      type: 'simple' },
  motor1: { rpcMethod: 'set_motor_1_status', nameTH: 'มอเตอร์ 1', type: 'motor' },
  motor2: { rpcMethod: 'set_motor_2_status', nameTH: 'มอเตอร์ 2', type: 'motor' },
  motor3: { rpcMethod: 'set_motor_3_status', nameTH: 'มอเตอร์ 3', type: 'motor' },
  motor4: { rpcMethod: 'set_motor_4_status', nameTH: 'มอเตอร์ 4', type: 'motor' },
};

/**
 * POST /api/external/v1/control/devices/:projectKey/:ghKey/control
 */
router.post('/devices/:projectKey/:ghKey/control', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { controlKey, value } = req.body;
    const apiKeyPrefix = (req as any).apiKeyPrefix;

    if (!controlKey || value === undefined) {
      res.status(400).json({ success: false, error: 'controlKey and value are required' });
      return;
    }

    const projectResult = await query('SELECT * FROM projects WHERE key = $1', [projectKey]);
    const project = projectResult.rows[0] as any;
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const ghResult = await query(`
      SELECT * FROM greenhouses WHERE project_id = $1 AND gh_key = $2
    `, [project.id, ghKey]);
    const greenhouse = ghResult.rows[0] as any;
    if (!greenhouse) {
      res.status(404).json({ success: false, error: 'Greenhouse not found' });
      return;
    }

    const controlConfig = controlMapping[controlKey];
    if (!controlConfig) {
      res.status(404).json({ success: false, error: 'Control device not found' });
      return;
    }

    let rpcParams: any;
    if (controlConfig.type === 'simple') {
      rpcParams = (value === true || value === 1 || value === '1') ? 1 : 0;
    } else {
      if (value === 'stop'    || value === 0 || value === '0') rpcParams = 0;
      else if (value === 'forward' || value === 1 || value === '1') rpcParams = 1;
      else if (value === 'reverse' || value === 2 || value === '2') rpcParams = 2;
      else {
        res.status(400).json({ success: false, error: 'Motor value must be 0/1/2 or stop/forward/reverse' });
        return;
      }
    }

    const authResponse = await axios.post(`${project.tb_base_url}/api/auth/login`, {
      username: project.tb_username,
      password: project.tb_password,
    });
    const token = authResponse.data.token;

    const rpcResponse = await axios.post(
      `${project.tb_base_url}/api/rpc/twoway/${greenhouse.tb_device_id}`,
      { method: controlConfig.rpcMethod, params: rpcParams, timeout: 5000 },
      { headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` } }
    );

    const actionText = controlConfig.type === 'simple'
      ? (rpcParams ? 'ON' : 'OFF')
      : (rpcParams === 1 ? 'FORWARD' : rpcParams === 2 ? 'REVERSE' : 'STOP');

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
      success: true,
    });

    res.json({ success: true, data: { controlKey, value, response: rpcResponse.data } });

  } catch (error: any) {
    console.error('External control error:', error);
    const { controlKey, value } = req.body;

    if (controlKey) {
      logDeviceControl({
        greenhouseId: 0,
        controlKey,
        action: 'FAILED',
        value: String(value),
        source: 'external_api',
        apiKeyPrefix: (req as any).apiKeyPrefix,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        errorMessage: error.message,
      });
    }

    res.status(500).json({ success: false, error: error.message || 'Failed to control device' });
  }
});

/**
 * POST /api/external/v1/control/devices/:projectKey/:ghKey/batch
 */
router.post('/devices/:projectKey/:ghKey/batch', async (req: Request, res: Response) => {
  try {
    const { projectKey, ghKey } = req.params;
    const { controls } = req.body;

    if (!Array.isArray(controls) || controls.length === 0) {
      res.status(400).json({ success: false, error: 'controls array is required' });
      return;
    }

    const projectResult = await query('SELECT * FROM projects WHERE key = $1', [projectKey]);
    const project = projectResult.rows[0] as any;
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const ghResult = await query(`
      SELECT * FROM greenhouses WHERE project_id = $1 AND gh_key = $2
    `, [project.id, ghKey]);
    const greenhouse = ghResult.rows[0] as any;
    if (!greenhouse) {
      res.status(404).json({ success: false, error: 'Greenhouse not found' });
      return;
    }

    const authResponse = await axios.post(`${project.tb_base_url}/api/auth/login`, {
      username: project.tb_username,
      password: project.tb_password,
    });
    const token = authResponse.data.token;

    const results = [];
    for (const ctrl of controls) {
      try {
        const controlConfig = controlMapping[ctrl.controlKey];
        if (!controlConfig) {
          results.push({ controlKey: ctrl.controlKey, success: false, error: 'Control device not found' });
          continue;
        }

        let rpcParams: any;
        if (controlConfig.type === 'simple') {
          rpcParams = (ctrl.value === true || ctrl.value === 1 || ctrl.value === '1') ? 1 : 0;
        } else {
          if (ctrl.value === 'stop'    || ctrl.value === 0 || ctrl.value === '0') rpcParams = 0;
          else if (ctrl.value === 'forward' || ctrl.value === 1 || ctrl.value === '1') rpcParams = 1;
          else if (ctrl.value === 'reverse' || ctrl.value === 2 || ctrl.value === '2') rpcParams = 2;
          else {
            results.push({ controlKey: ctrl.controlKey, success: false, error: 'Motor value must be 0/1/2 or stop/forward/reverse' });
            continue;
          }
        }

        const rpcResponse = await axios.post(
          `${project.tb_base_url}/api/rpc/twoway/${greenhouse.tb_device_id}`,
          { method: controlConfig.rpcMethod, params: rpcParams, timeout: 5000 },
          { headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` } }
        );

        const actionText = controlConfig.type === 'simple'
          ? (rpcParams ? 'ON' : 'OFF')
          : (rpcParams === 1 ? 'FORWARD' : rpcParams === 2 ? 'REVERSE' : 'STOP');

        logDeviceControl({
          greenhouseId: greenhouse.id,
          controlKey: ctrl.controlKey,
          controlName: controlConfig.nameTH,
          action: actionText,
          value: String(ctrl.value),
          source: 'external_api',
          apiKeyPrefix: (req as any).apiKeyPrefix,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          success: true,
        });

        results.push({ controlKey: ctrl.controlKey, success: true, response: rpcResponse.data });

      } catch (error: any) {
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
          errorMessage: error.message,
        });
        results.push({ controlKey: ctrl.controlKey, success: false, error: error.message });
      }
    }

    res.json({ success: true, data: results });

  } catch (error: any) {
    console.error('Batch control error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to control devices' });
  }
});

export default router;