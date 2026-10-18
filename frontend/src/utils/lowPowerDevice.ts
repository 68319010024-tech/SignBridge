// เครื่องสเปกต่ำ (Raspberry Pi) — เปิด "โหมดเบา" อัตโนมัติ
//
// Raspberry Pi คือ Linux บน CPU ARM แต่ Chromium รุ่นใหม่ (User-Agent Reduction) รายงาน user agent และ
// navigator.platform ของ Linux ทุกเครื่องเป็น "Linux x86_64" เหมือนกันหมด (วัดจาก Pi จริง: Chromium 155)
// จึงต้องถามสถาปัตยกรรมจริงจาก navigator.userAgentData (Client Hints) ซึ่งตอบแบบ async —
// main.tsx เรียก initDeviceProfile() ให้เสร็จก่อนวาดหน้าเว็บ ค่าด้านล่างจึงพร้อมก่อนทุกคอมโพเนนต์ใช้
// (export let = live binding ไฟล์ที่ import ไปจะเห็นค่าใหม่เอง)
// ยังเช็ค user agent แบบเดิมไว้ด้วย สำหรับเบราว์เซอร์ที่ไม่มี userAgentData (Firefox) ซึ่งยังบอก aarch64 ตรง ๆ
//
// โหมดเบา: แสดง <video> ตรง ๆ แทนการวาดลง canvas ทุกเฟรม (ยกเว้นตอนเปิดเบลอพื้นหลัง),
// ขอกล้องที่ 30fps และบีบภาพที่ส่งไป AI ให้เล็กลง
//
// ทดสอบบนเครื่องอื่นได้ด้วย ?lite=1 (บังคับเปิด) หรือ ?lite=0 (บังคับปิด) ต่อท้าย URL
const liteOverride = (): string | null =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('lite');

type UADataWithHints = {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; platform?: string }>;
};

// Linux บน ARM ที่ไม่ใช่ Android — userAgentData.platform ของ Android/ChromeOS/macOS ไม่ใช่ "Linux" จึงไม่เข้าเงื่อนไข
async function isLinuxArm(): Promise<boolean> {
  const ua = navigator.userAgent;
  if (/Linux (aarch64|armv\d+l?)/i.test(ua) && !/Android/i.test(ua)) return true;

  const uaData = (navigator as Navigator & { userAgentData?: UADataWithHints }).userAgentData;
  if (!uaData?.getHighEntropyValues || uaData.platform !== 'Linux') return false;
  try {
    // ตอบเกือบทันที แต่กันไว้ไม่ให้หน้าเว็บค้างถ้าไม่ตอบ
    const hints = await Promise.race([
      uaData.getHighEntropyValues(['architecture']),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
    ]);
    return hints?.architecture === 'arm';
  } catch {
    return false;
  }
}

export let IS_LOW_POWER_DEVICE = false;

// หน้าตาแบบเบา — เฉพาะเว็บ /ai2/ ที่เปิดบน Pi กับจอ 10.1" 1280x800 (ชุดที่ใช้แข่ง) เท่านั้น
// ปิดแอนิเมชัน/transition/เงา (ดู .sb-lite ใน globals.css) และลดงานที่ไม่จำเป็นระหว่างส่งภาพให้ AI
// ใช้ขนาดจอจริง (screen) ไม่ใช่ขนาดหน้าต่าง — กด F11/kiosk แล้วเท่ากันพอดี ส่วน /ai/ และจอขนาดอื่นเหมือนเดิมทุกอย่าง
// ?lite=1 บังคับเปิดได้ (เฉพาะ /ai2/) ไว้ทดสอบบน PC
export let IS_LITE_UI = false;

export async function initDeviceProfile(): Promise<void> {
  if (typeof window === 'undefined') return;
  const override = liteOverride();
  IS_LOW_POWER_DEVICE = override === '1' ? true : override === '0' ? false : await isLinuxArm();

  if (!__SB_RED_THEME__ || !IS_LOW_POWER_DEVICE) return;
  const { width, height } = window.screen;
  IS_LITE_UI = override === '1' || (Math.max(width, height) === 1280 && Math.min(width, height) === 800);
}
