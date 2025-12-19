import { Response } from 'express';
import type { ApiResponse } from '../types/index.js';

/**
 * Send success response
 */
export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.status(statusCode).json(response);
}

/**
 * Send error response with Thai message
 */
export function sendError(res: Response, error: string, statusCode = 400): void {
  const response: ApiResponse = {
    success: false,
    error,
  };
  res.status(statusCode).json(response);
}

/**
 * Common Thai error messages
 */
export const ThaiErrors = {
  // Auth errors
  INVALID_CREDENTIALS: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  UNAUTHORIZED: 'กรุณาเข้าสู่ระบบ',
  FORBIDDEN: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้',
  SESSION_EXPIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  INVALID_CSRF: 'CSRF Token ไม่ถูกต้อง กรุณารีเฟรชหน้า',
  
  // User errors
  USER_DISABLED: 'บัญชีผู้ใช้ถูกปิดใช้งาน',
  USER_NOT_FOUND: 'ไม่พบผู้ใช้',
  USERNAME_EXISTS: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว',
  PASSWORD_WEAK: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
  PASSWORD_MISMATCH: 'รหัสผ่านเดิมไม่ถูกต้อง',
  
  // Project/Greenhouse errors
  PROJECT_NOT_FOUND: 'ไม่พบโปรเจกต์',
  GREENHOUSE_NOT_FOUND: 'ไม่พบโรงเรือน',
  GREENHOUSE_DEVELOPING: 'กำลังพัฒนา - ยังไม่มีการผูก ThingsBoard Device (deviceId)',
  NO_PROJECT_ACCESS: 'คุณไม่มีสิทธิ์เข้าถึงโปรเจกต์นี้',
  
  // ThingsBoard errors
  TB_CONNECTION_ERROR: 'ไม่สามารถเชื่อมต่อ ThingsBoard ได้',
  TB_AUTH_ERROR: 'การยืนยันตัวตน ThingsBoard ล้มเหลว',
  TB_TIMEOUT: 'ThingsBoard ไม่ตอบสนองภายในเวลาที่กำหนด',
  TB_DEVICE_OFFLINE: 'อุปกรณ์ออฟไลน์ (Offline) ไม่สามารถสั่งงานได้',
  
  // Control errors
  CONTROL_LOCKED_AUTO: 'ถูกล็อกเพราะเปิดโหมด Auto ต้องปิด Auto ก่อน',
  CONTROL_LOCKED_MOTOR_AUTO: 'ถูกล็อกเพราะเปิดโหมด Auto มอเตอร์ ต้องปิด Auto ก่อน',
  CONTROL_PENDING: 'คำสั่งกำลังดำเนินการ กรุณารอ',
  CONTROL_TIMEOUT: 'คำสั่งหมดเวลา ไม่ได้รับการยืนยันจากอุปกรณ์',
  CONTROL_NO_PERMISSION: 'คุณไม่มีสิทธิ์ควบคุมอุปกรณ์',
  
  // Validation errors
  INVALID_INPUT: 'ข้อมูลไม่ถูกต้อง',
  INVALID_TIME_FORMAT: 'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:mm)',
  
  // Generic errors
  SERVER_ERROR: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
  NOT_FOUND: 'ไม่พบข้อมูลที่ร้องขอ',
  RATE_LIMITED: 'คำขอถูกจำกัด กรุณาลองใหม่ในภายหลัง',
};
