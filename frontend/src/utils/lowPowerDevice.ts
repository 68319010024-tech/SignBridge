// เครื่องสเปกต่ำ (Raspberry Pi) — เปิด "โหมดเบา" อัตโนมัติ
//
// Raspberry Pi ใช้ Linux บน CPU ARM (user agent มี "Linux aarch64" หรือ "Linux armv7l") ส่วน
// Android ก็มีคำว่า Linux แต่จะมีคำว่า Android ด้วยเสมอ จึงตัดออก — PC/iPad/มือถือไม่เข้าโหมดนี้
//
// โหมดเบา: แสดง <video> ตรง ๆ แทนการวาดลง canvas ทุกเฟรม (ยกเว้นตอนเปิดเบลอพื้นหลัง),
// ขอกล้องที่ 30fps และบีบภาพที่ส่งไป AI ให้เล็กลง
//
// ทดสอบบนเครื่องอื่นได้ด้วย ?lite=1 (บังคับเปิด) หรือ ?lite=0 (บังคับปิด) ต่อท้าย URL
const liteOverride = (): string | null =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('lite');

function detectLowPower(): boolean {
  if (typeof window === 'undefined') return false;
  const override = liteOverride();
  if (override === '1') return true;
  if (override === '0') return false;
  const ua = navigator.userAgent;
  return /Linux (aarch64|armv\d+l?)/i.test(ua) && !/Android/i.test(ua);
}

export const IS_LOW_POWER_DEVICE = detectLowPower();

// หน้าตาแบบเบา — เฉพาะเว็บ /ai2/ ที่เปิดบน Pi กับจอ 10.1" 1280x800 (ชุดที่ใช้แข่ง) เท่านั้น
// ปิดแอนิเมชัน/transition/เงา (ดู .sb-lite ใน globals.css) และลดงานที่ไม่จำเป็นระหว่างส่งภาพให้ AI
// ใช้ขนาดจอจริง (screen) ไม่ใช่ขนาดหน้าต่าง — กด F11/kiosk แล้วเท่ากันพอดี ส่วน /ai/ และจอขนาดอื่นเหมือนเดิมทุกอย่าง
// ?lite=1 บังคับเปิดได้ (เฉพาะ /ai2/) ไว้ทดสอบบน PC
function detectLiteUi(): boolean {
  if (typeof window === 'undefined' || !__SB_RED_THEME__ || !IS_LOW_POWER_DEVICE) return false;
  if (liteOverride() === '1') return true;
  const { width, height } = window.screen;
  return Math.max(width, height) === 1280 && Math.min(width, height) === 800;
}

export const IS_LITE_UI = detectLiteUi();
