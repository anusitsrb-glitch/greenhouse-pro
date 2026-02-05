import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

export function timeAgoTH(date: string | Date) {
  // แปลง date string จาก server (UTC) เป็น Date object
  let d: Date;
  
  if (typeof date === 'string') {
    // ถ้า date string ไม่มี timezone indicator (Z) ให้เพิ่ม 'Z' เพื่อบอกว่าเป็น UTC
    // เพราะ SQLite datetime('now') ให้เวลา UTC แต่ไม่มี Z ต่อท้าย
    const dateStr = date.includes('Z') || date.includes('+') ? date : date + 'Z';
    d = new Date(dateStr);
  } else {
    d = date;
  }

  return formatDistanceToNow(d, {
    addSuffix: true,
    locale: th,
  });
}