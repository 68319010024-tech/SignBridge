// เครื่องสเปกต่ำ (Raspberry Pi) — เปิด "โหมดเบา" อัตโนมัติ
//
// Raspberry Pi ใช้ Linux บน CPU ARM (user agent มี "Linux aarch64" หรือ "Linux armv7l") ส่วน
// Android ก็มีคำว่า Linux แต่จะมีคำว่า Android ด้วยเสมอ จึงตัดออก — PC/iPad/มือถือไม่เข้าโหมดนี้
//
// โหมดเบา: แสดง <video> ตรง ๆ แทนการวาดลง canvas ทุกเฟรม (ยกเว้นตอนเปิดเบลอพื้นหลัง),
// ขอกล้องที่ 30fps และบีบภาพที่ส่งไป AI ให้เล็กลง
//
// ทดสอบบนเครื่องอื่นได้ด้วย ?lite=1 (บังคับเปิด) หรือ ?lite=0 (บังคับปิด) ต่อท้าย URL
function detectLowPower(): boolean {
  if (typeof window === 'undefined') return false;
  const override = new URLSearchParams(window.location.search).get('lite');
  if (override === '1') return true;
  if (override === '0') return false;
  const ua = navigator.userAgent;
  return /Linux (aarch64|armv\d+l?)/i.test(ua) && !/Android/i.test(ua);
}

export const IS_LOW_POWER_DEVICE = detectLowPower();
