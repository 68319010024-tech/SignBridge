// ค่าที่ vite.config.ts ใส่ให้ตอน build (ดูคำอธิบายที่นั่น)
declare const __SB_RED_THEME__: boolean;

declare module 'virtual:sb-header-logos' {
  const logos: string[];
  export default logos;
}
