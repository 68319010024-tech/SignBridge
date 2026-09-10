import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react';
// base: './' (relative) ทำให้ build เดียวกันนี้ใช้ได้ทั้งตอนรันที่ root
// (localhost:8080 ตอน dev/ทดสอบบนโน้ตบุ๊ค) และตอนถูกเสิร์ฟใต้ path ย่อยอย่าง
// /ai/ บนเซิร์ฟเวอร์ของโรงเรียน โดยไม่ต้อง build แยกสองรอบ
export default defineConfig({ base: './', plugins: [react()] });

