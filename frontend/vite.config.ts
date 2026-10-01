import { defineConfig, type Plugin } from 'vite'; import react from '@vitejs/plugin-react';

// ธีมสีแบบเลือกตอน build: ตั้ง SB_THEME=red ตอน build จะได้เว็บธีมแดง-ขาว-ทอง
// (#C3002F + #BC9945) สำหรับ /ai2/ — ถ้าไม่ตั้ง จะได้ธีมน้ำเงิน-ขาวเดิมของ /ai/
// ทุกอย่างเหมือนเดิม (plugin ไม่ทำอะไรเลย)
//
// วิธีทำ: สีในโปรเจกต์นี้เขียนเป็น inline style/CSS string ทั้งหมด (ไม่มีคลาสสีของ Tailwind)
// จึงแทนค่าสีน้ำเงินแต่ละเฉดเป็นเฉดแดง/ทองที่คู่กันตอน build ได้ตรงๆ โดยไม่ต้องแก้ไฟล์ใน src/
// ถ้าเพิ่มเฉดน้ำเงินใหม่ในโค้ด ต้องมาเพิ่มคู่สีในตารางนี้ด้วย ไม่งั้น /ai2/ จะยังเป็นสีน้ำเงิน
// สีที่มีความหมายเฉพาะ (สีหมวดคำ ม่วง/ส้ม/ฟ้า/เขียว, สีถูก/ผิด) ตั้งใจไม่เปลี่ยน
const RED_THEME_HEX: Record<string, string> = {
  // สีหลัก + ไล่สีของการ์ด/หัวกล่อง
  '#123a80': '#8f0022',
  '#0d47a1': '#c3002f',
  '#1a5aa8': '#b0002a',
  '#1662c4': '#d01e46',
  '#3b8fe0': '#e2486a',
  // ปลายแถบด้านบนและไอคอนเล็กๆ ใช้สีทองเป็นสีรอง
  '#4fa3e0': '#a9853a',
  '#6fbeef': '#bc9945',
  '#bfe1f9': '#e9dbb4',
  '#93c5fd': '#e3cf9c',
  // เส้นขอบ/scrollbar
  '#9cc0ea': '#e8a3b3',
  '#c7dbf5': '#f0c4cf',
  // พื้นอ่อนๆ (tint)
  '#dbeafe': '#f9dce3',
  '#dbeeff': '#fbe1e7',
  '#dce8f7': '#f6dde3',
  '#e3ecf7': '#f8e4e9',
  '#e7effa': '#f9e8ec',
  '#e8f0fa': '#fae8ec',
  '#e8f1fd': '#fbe8ec',
  '#eaf1fb': '#fbeaee',
  '#eef4fc': '#fcf0f2',
  '#eef5ff': '#fdf0f3',
  '#f0f7ff': '#fdf2f4',
  '#f4f8fd': '#fdf5f7',
  '#f6faff': '#fef8f9',
  '#f8fbff': '#fffafb',
};
const RED_THEME_RGB: [RegExp, string][] = [
  [/rgba\(\s*13\s*,\s*71\s*,\s*161\s*,/g, 'rgba(195, 0, 47,'],
  [/rgba\(\s*22\s*,\s*98\s*,\s*196\s*,/g, 'rgba(208, 30, 70,'],
];

function themePlugin(theme: string | undefined): Plugin {
  const hexPattern = new RegExp(`(${Object.keys(RED_THEME_HEX).join('|')})(?![0-9a-f])`, 'gi');
  return {
    name: 'signbridge-theme',
    enforce: 'pre',
    transform(code, id) {
      if (theme !== 'red' || !/\/src\/.*\.(tsx?|css)$/.test(id.split('?')[0].replace(/\\/g, '/'))) return null;
      let out = code.replace(hexPattern, (m) => RED_THEME_HEX[m.toLowerCase()]);
      for (const [pattern, to] of RED_THEME_RGB) out = out.replace(pattern, to);
      return out === code ? null : { code: out, map: null };
    },
  };
}

// base: './' (relative) ทำให้ build เดียวกันนี้ใช้ได้ทั้งตอนรันที่ root
// (localhost:8080 ตอน dev/ทดสอบบนโน้ตบุ๊ค) และตอนถูกเสิร์ฟใต้ path ย่อยอย่าง
// /ai/ หรือ /ai2/ บนเซิร์ฟเวอร์ของโรงเรียน โดยไม่ต้อง build แยกสองรอบ
export default defineConfig({ base: './', plugins: [themePlugin(process.env.SB_THEME), react()] });
