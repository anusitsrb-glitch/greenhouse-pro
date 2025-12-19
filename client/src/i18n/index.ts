/**
 * i18n - Internationalization System
 * Supports: Thai (th), English (en), Myanmar (mm)
 */

export type Language = 'th' | 'en' | 'mm';

export const translations: Record<Language, Record<string, string>> = {
  th: {
    // App
    'app.title': 'GreenHouse Pro',
    'app.subtitle': 'ระบบจัดการโรงเรือนอัจฉริยะ',
    
    // Navigation
    'nav.home': 'หน้าแรก',
    'nav.dashboard': 'แดชบอร์ด',
    'nav.projects': 'โปรเจกต์',
    'nav.greenhouses': 'โรงเรือน',
    'nav.admin': 'ผู้ดูแลระบบ',
    'nav.profile': 'โปรไฟล์',
    'nav.settings': 'ตั้งค่า',
    'nav.logout': 'ออกจากระบบ',
    
    // Auth
    'auth.login': 'เข้าสู่ระบบ',
    'auth.logout': 'ออกจากระบบ',
    'auth.username': 'ชื่อผู้ใช้',
    'auth.password': 'รหัสผ่าน',
    'auth.remember': 'จดจำฉัน',
    'auth.forgot': 'ลืมรหัสผ่าน?',
    
    // Common
    'common.save': 'บันทึก',
    'common.cancel': 'ยกเลิก',
    'common.delete': 'ลบ',
    'common.edit': 'แก้ไข',
    'common.add': 'เพิ่ม',
    'common.search': 'ค้นหา',
    'common.filter': 'กรอง',
    'common.refresh': 'รีเฟรช',
    'common.loading': 'กำลังโหลด...',
    'common.noData': 'ไม่มีข้อมูล',
    'common.confirm': 'ยืนยัน',
    'common.back': 'กลับ',
    'common.next': 'ถัดไป',
    'common.previous': 'ก่อนหน้า',
    'common.close': 'ปิด',
    'common.export': 'ส่งออก',
    'common.import': 'นำเข้า',
    'common.download': 'ดาวน์โหลด',
    'common.upload': 'อัพโหลด',
    'common.all': 'ทั้งหมด',
    'common.active': 'ใช้งาน',
    'common.inactive': 'ไม่ใช้งาน',
    'common.status': 'สถานะ',
    'common.actions': 'จัดการ',
    'common.details': 'รายละเอียด',
    'common.date': 'วันที่',
    'common.time': 'เวลา',
    'common.yes': 'ใช่',
    'common.no': 'ไม่',
    
    // Dashboard
    'dashboard.soilTab': 'ค่าดิน',
    'dashboard.chartsTab': 'กราฟ',
    'dashboard.controlTab': 'ควบคุม',
    'dashboard.timersTab': 'ตั้งเวลา',
    'dashboard.temperature': 'อุณหภูมิ',
    'dashboard.humidity': 'ความชื้น',
    'dashboard.moisture': 'ความชื้นดิน',
    'dashboard.co2': 'CO₂',
    'dashboard.light': 'แสง',
    'dashboard.online': 'ออนไลน์',
    'dashboard.offline': 'ออฟไลน์',
    'dashboard.lastUpdate': 'อัพเดทล่าสุด',
    
    // Sensors
    'sensor.air': 'อากาศ',
    'sensor.soil': 'ดิน',
    'sensor.water': 'น้ำ',
    'sensor.light': 'แสง',
    'sensor.npk': 'ธาตุอาหาร NPK',
    'sensor.ec': 'ค่า EC',
    'sensor.ph': 'ค่า pH',
    
    // Controls
    'control.on': 'เปิด',
    'control.off': 'ปิด',
    'control.auto': 'อัตโนมัติ',
    'control.manual': 'ควบคุมเอง',
    'control.fan': 'พัดลม',
    'control.pump': 'ปั๊มน้ำ',
    'control.valve': 'วาล์ว',
    'control.light': 'ไฟ',
    'control.motor': 'มอเตอร์',
    'control.forward': 'เดินหน้า',
    'control.reverse': 'ถอยหลัง',
    'control.stop': 'หยุด',
    
    // Admin
    'admin.users': 'จัดการผู้ใช้',
    'admin.projects': 'จัดการโปรเจกต์',
    'admin.greenhouses': 'จัดการโรงเรือน',
    'admin.sensors': 'จัดการ Sensor',
    'admin.notifications': 'การแจ้งเตือน',
    'admin.alerts': 'ประวัติ Alert',
    'admin.audit': 'Audit Log',
    'admin.settings': 'ตั้งค่าระบบ',
    'admin.security': 'ความปลอดภัย',
    
    // Roles
    'role.superadmin': 'Super Admin',
    'role.admin': 'Admin',
    'role.operator': 'Operator',
    'role.viewer': 'Viewer',
    
    // Messages
    'msg.success': 'สำเร็จ',
    'msg.error': 'เกิดข้อผิดพลาด',
    'msg.saved': 'บันทึกสำเร็จ',
    'msg.deleted': 'ลบสำเร็จ',
    'msg.confirmDelete': 'ยืนยันการลบ?',
    'msg.noPermission': 'คุณไม่มีสิทธิ์ดำเนินการนี้',
  },
  
  en: {
    // App
    'app.title': 'GreenHouse Pro',
    'app.subtitle': 'Smart Greenhouse Management System',
    
    // Navigation
    'nav.home': 'Home',
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projects',
    'nav.greenhouses': 'Greenhouses',
    'nav.admin': 'Admin',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    
    // Auth
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.remember': 'Remember me',
    'auth.forgot': 'Forgot password?',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.refresh': 'Refresh',
    'common.loading': 'Loading...',
    'common.noData': 'No data',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.close': 'Close',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.download': 'Download',
    'common.upload': 'Upload',
    'common.all': 'All',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.status': 'Status',
    'common.actions': 'Actions',
    'common.details': 'Details',
    'common.date': 'Date',
    'common.time': 'Time',
    'common.yes': 'Yes',
    'common.no': 'No',
    
    // Dashboard
    'dashboard.soilTab': 'Soil',
    'dashboard.chartsTab': 'Charts',
    'dashboard.controlTab': 'Control',
    'dashboard.timersTab': 'Timers',
    'dashboard.temperature': 'Temperature',
    'dashboard.humidity': 'Humidity',
    'dashboard.moisture': 'Soil Moisture',
    'dashboard.co2': 'CO₂',
    'dashboard.light': 'Light',
    'dashboard.online': 'Online',
    'dashboard.offline': 'Offline',
    'dashboard.lastUpdate': 'Last update',
    
    // Sensors
    'sensor.air': 'Air',
    'sensor.soil': 'Soil',
    'sensor.water': 'Water',
    'sensor.light': 'Light',
    'sensor.npk': 'NPK Nutrients',
    'sensor.ec': 'EC Value',
    'sensor.ph': 'pH Value',
    
    // Controls
    'control.on': 'On',
    'control.off': 'Off',
    'control.auto': 'Auto',
    'control.manual': 'Manual',
    'control.fan': 'Fan',
    'control.pump': 'Pump',
    'control.valve': 'Valve',
    'control.light': 'Light',
    'control.motor': 'Motor',
    'control.forward': 'Forward',
    'control.reverse': 'Reverse',
    'control.stop': 'Stop',
    
    // Admin
    'admin.users': 'Manage Users',
    'admin.projects': 'Manage Projects',
    'admin.greenhouses': 'Manage Greenhouses',
    'admin.sensors': 'Manage Sensors',
    'admin.notifications': 'Notifications',
    'admin.alerts': 'Alert History',
    'admin.audit': 'Audit Log',
    'admin.settings': 'System Settings',
    'admin.security': 'Security',
    
    // Roles
    'role.superadmin': 'Super Admin',
    'role.admin': 'Admin',
    'role.operator': 'Operator',
    'role.viewer': 'Viewer',
    
    // Messages
    'msg.success': 'Success',
    'msg.error': 'Error occurred',
    'msg.saved': 'Saved successfully',
    'msg.deleted': 'Deleted successfully',
    'msg.confirmDelete': 'Confirm delete?',
    'msg.noPermission': 'You do not have permission',
  },
  
  mm: {
    // App
    'app.title': 'GreenHouse Pro',
    'app.subtitle': 'စမတ်ဖန်လုံအိမ်စီမံခန့်ခွဲမှုစနစ်',
    
    // Navigation
    'nav.home': 'ပင်မစာမျက်နှာ',
    'nav.dashboard': 'ဒက်ရှ်ဘုတ်',
    'nav.projects': 'ပရောဂျက်များ',
    'nav.greenhouses': 'ဖန်လုံအိမ်များ',
    'nav.admin': 'အက်ဒမင်',
    'nav.profile': 'ပရိုဖိုင်',
    'nav.settings': 'ဆက်တင်များ',
    'nav.logout': 'ထွက်ရန်',
    
    // Auth
    'auth.login': 'ဝင်ရောက်ရန်',
    'auth.logout': 'ထွက်ရန်',
    'auth.username': 'အသုံးပြုသူအမည်',
    'auth.password': 'စကားဝှက်',
    'auth.remember': 'မှတ်ထားပါ',
    'auth.forgot': 'စကားဝှက်မေ့နေပါသလား?',
    
    // Common
    'common.save': 'သိမ်းဆည်းရန်',
    'common.cancel': 'ပယ်ဖျက်ရန်',
    'common.delete': 'ဖျက်ရန်',
    'common.edit': 'တည်းဖြတ်ရန်',
    'common.add': 'ထည့်ရန်',
    'common.search': 'ရှာရန်',
    'common.filter': 'စစ်ထုတ်ရန်',
    'common.refresh': 'ပြန်လည်စတင်ရန်',
    'common.loading': 'ဖွင့်နေသည်...',
    'common.noData': 'ဒေတာမရှိပါ',
    'common.confirm': 'အတည်ပြုရန်',
    'common.back': 'နောက်သို့',
    'common.next': 'ရှေ့သို့',
    'common.previous': 'အရင်',
    'common.close': 'ပိတ်ရန်',
    'common.export': 'ထုတ်ယူရန်',
    'common.import': 'သွင်းယူရန်',
    'common.download': 'ဒေါင်းလုဒ်',
    'common.upload': 'အပ်လုဒ်',
    'common.all': 'အားလုံး',
    'common.active': 'အသုံးပြုနေသည်',
    'common.inactive': 'မသုံးပါ',
    'common.status': 'အခြေအနေ',
    'common.actions': 'လုပ်ဆောင်ချက်များ',
    'common.details': 'အသေးစိတ်',
    'common.date': 'ရက်စွဲ',
    'common.time': 'အချိန်',
    'common.yes': 'ဟုတ်ကဲ့',
    'common.no': 'မဟုတ်ပါ',
    
    // Dashboard
    'dashboard.soilTab': 'မြေဆီ',
    'dashboard.chartsTab': 'ဇယားများ',
    'dashboard.controlTab': 'ထိန်းချုပ်',
    'dashboard.timersTab': 'အချိန်ဇယား',
    'dashboard.temperature': 'အပူချိန်',
    'dashboard.humidity': 'စိုထိုင်းဆ',
    'dashboard.moisture': 'မြေစိုထိုင်းဆ',
    'dashboard.co2': 'CO₂',
    'dashboard.light': 'အလင်း',
    'dashboard.online': 'အွန်လိုင်း',
    'dashboard.offline': 'အော့ဖ်လိုင်း',
    'dashboard.lastUpdate': 'နောက်ဆုံးအပ်ဒိတ်',
    
    // Sensors
    'sensor.air': 'လေ',
    'sensor.soil': 'မြေ',
    'sensor.water': 'ရေ',
    'sensor.light': 'အလင်း',
    'sensor.npk': 'NPK အာဟာရဓာတ်',
    'sensor.ec': 'EC တန်ဖိုး',
    'sensor.ph': 'pH တန်ဖိုး',
    
    // Controls
    'control.on': 'ဖွင့်',
    'control.off': 'ပိတ်',
    'control.auto': 'အလိုအလျောက်',
    'control.manual': 'လက်ဖြင့်',
    'control.fan': 'ပန်ကာ',
    'control.pump': 'ရေမောင်း',
    'control.valve': 'ဗားဗ်',
    'control.light': 'မီး',
    'control.motor': 'မော်တာ',
    'control.forward': 'ရှေ့တိုး',
    'control.reverse': 'နောက်ဆုတ်',
    'control.stop': 'ရပ်',
    
    // Roles
    'role.superadmin': 'အထူးအက်ဒမင်',
    'role.admin': 'အက်ဒမင်',
    'role.operator': 'အော်ပရေတာ',
    'role.viewer': 'ကြည့်ရှုသူ',
    
    // Messages
    'msg.success': 'အောင်မြင်သည်',
    'msg.error': 'အမှားဖြစ်သည်',
    'msg.saved': 'သိမ်းဆည်းပြီးပါပြီ',
    'msg.deleted': 'ဖျက်ပြီးပါပြီ',
    'msg.confirmDelete': 'ဖျက်ရန်အတည်ပြုပါသလား?',
    'msg.noPermission': 'သင့်တွင်ခွင့်ပြုချက်မရှိပါ',
  },
};

/**
 * Get translation for a key
 */
export function t(key: string, lang: Language = 'th'): string {
  return translations[lang][key] || translations['th'][key] || key;
}

/**
 * Hook for translations
 */
import { useCallback } from 'react';

export function useTranslation(lang: Language = 'th') {
  const translate = useCallback(
    (key: string) => t(key, lang),
    [lang]
  );

  return { t: translate, lang };
}
