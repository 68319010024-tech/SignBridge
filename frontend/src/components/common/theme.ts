// สีธีมหลักของระบบ (น้ำเงิน) สำหรับการ์ดแบบ "หัวไล่สี" — ใช้ร่วมกันทุกหน้า แก้ที่นี่ที่เดียว
export const BLUE_GRADIENT = 'linear-gradient(135deg, #0d47a1 0%, #1662c4 55%, #3b8fe0 100%)';
export const BLUE_GLOW = 'rgba(22, 98, 196, 0.35)';
export const CARD_SHADOW = '0 10px 30px -14px rgba(13,71,161,0.22)';
export const CARD_HOVER_SHADOW = `0 22px 44px -16px ${BLUE_GLOW}, 0 0 0 2px ${BLUE_GLOW}`;

// สไตล์ร่วมของการ์ดหัวไล่สี: ลอยขึ้นตอน hover, ลายน้ำขยับ, ลูกศรเลื่อน, โผล่ทีละใบตอนเปิดหน้า
export const HERO_CARD_STYLES = `
  @keyframes sb-hero-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  .sb-hero-card { opacity: 0; animation: sb-hero-in 0.45s ease-out forwards; transition: transform 0.3s ease, box-shadow 0.3s ease; }
  .sb-hero-card:hover { transform: translateY(-6px); box-shadow: ${CARD_HOVER_SHADOW} !important; }
  .sb-hero-card:active { transform: translateY(-2px) scale(0.98); }
  .sb-hero-card .sb-hero-watermark { transition: transform 0.5s ease, opacity 0.5s ease; }
  .sb-hero-card:hover .sb-hero-watermark { transform: rotate(-8deg) scale(1.1); opacity: 0.26; }
  .sb-hero-card .sb-hero-arrow { transition: transform 0.25s ease; }
  .sb-hero-card:hover .sb-hero-arrow { transform: translateX(4px); }
  @keyframes sb-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .sb-hero-bubble { animation: sb-float 6s ease-in-out infinite; }
`;

// สีทองของเว็บ /ai2/ (ธีมแดง-ทอง) ใช้คู่กับ __SB_RED_THEME__ สำหรับจุดที่ต้องการเน้นเป็นสีทอง
export const GOLD = '#bc9945';
export const GOLD_GRADIENT = 'linear-gradient(135deg, #9c7c32 0%, #bc9945 55%, #d2b673 100%)';
export const GOLD_GLOW = 'rgba(188, 153, 69, 0.55)';
// แถบหัวเว็บ /ai2/: ไล่เฉดทองแบบเดียวกับแถบน้ำเงินของ /ai/ (เข้ม → เข้มกว่า → กลาง → อ่อน → อ่อนสุด)
export const GOLD_TOPBAR_GRADIENT = 'linear-gradient(120deg, #a5852f 0%, #8c6f28 28%, #bc9945 55%, #d4b977 82%, #e2cd98 100%)';
