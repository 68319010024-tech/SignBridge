import React from 'react';
import { BLUE_GRADIENT, GOLD, GOLD_TINT, GOLD_TINT_HOVER, GOLD_TINT_BORDER, GOLD_SOFT } from './theme';

// หัวกล่องในหน้าหลัก/หน้าทบทวน: ไอคอนสีขาวในสี่เหลี่ยมมนไล่สีน้ำเงิน + ชื่อกล่อง
export const BoxHeader: React.FC<{
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  title: string;
  size?: 'md' | 'sm';
}> = ({ icon: Icon, title, size = 'md' }) => {
  const box = size === 'sm' ? 20 : 24;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ width: `${box}px`, height: `${box}px`, borderRadius: size === 'sm' ? '6px' : '8px', background: BLUE_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px -4px rgba(22,98,196,0.6)' }}>
        <Icon style={{ width: `${box - 11}px`, height: `${box - 11}px`, color: '#ffffff' }} />
      </span>
      <span style={{ fontSize: size === 'sm' ? '11.5px' : '13px', fontWeight: 800, color: '#1e293b', letterSpacing: '0.2px' }}>{title}</span>
    </div>
  );
};

// การ์ดพื้นขาวของกล่องต่าง ๆ (ใช้คู่กับไอคอนลายน้ำจาง ๆ ที่มุมขวาบน)
export const homeCardStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#ffffff',
  border: '1px solid #e3ecf7',
  borderRadius: '24px',
  boxShadow: '0 10px 28px -16px rgba(13,71,161,0.28)',
  boxSizing: 'border-box'
};

export const homeWatermarkStyle: React.CSSProperties = {
  position: 'absolute',
  color: '#0d47a1',
  opacity: 0.05,
  pointerEvents: 'none'
};

// ปุ่มในคอลัมน์ขวาของหน้าหลัก: ปุ่มเม็ดยาเต็มความกว้าง ไอคอนในวงกลมด้านซ้าย
export const homeButtonStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '9px 12px',
  borderRadius: '9999px',
  fontWeight: 'bold',
  fontSize: '13px',
  border: 'none',
  fontFamily: 'inherit'
};
export const homeButtonIconStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};
// ปุ่มรอง (สลับกล้อง, สวิตช์, ล้างประโยค) — /ai2/ ใช้โทนทอง
export const homeGhostStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: __SB_RED_THEME__ ? GOLD_TINT : '#f4f8fd',
  border: `1px solid ${__SB_RED_THEME__ ? GOLD_TINT_BORDER : '#e3ecf7'}`,
  color: '#334155'
};
export const homeGhostIconStyle: React.CSSProperties = {
  ...homeButtonIconStyle,
  width: '22px',
  height: '22px',
  backgroundColor: __SB_RED_THEME__ ? GOLD_SOFT : '#e8f1fd'
};
// สีไอคอนในปุ่มรอง และพื้นปุ่มรองตอน hover
export const GHOST_ICON_COLOR = __SB_RED_THEME__ ? GOLD : '#0d47a1';
export const GHOST_HOVER_BG = __SB_RED_THEME__ ? GOLD_TINT_HOVER : '#eef4fc';

export default BoxHeader;
