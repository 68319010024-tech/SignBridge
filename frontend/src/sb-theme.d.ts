// ค่าที่ vite.config.ts ใส่ให้ตอน build (ดูคำอธิบายที่นั่น)
declare const __SB_RED_THEME__: boolean;

declare module 'virtual:sb-header-logos' {
  const logos: string[];
  export default logos;
}

// build สำหรับ Pi แบบออฟไลน์ (SB_OFFLINE=1): ฟอนต์และโมเดลเบลอพื้นหลังอยู่ในเว็บเอง ไม่โหลดจากอินเทอร์เน็ต
declare const __SB_OFFLINE__: boolean;
