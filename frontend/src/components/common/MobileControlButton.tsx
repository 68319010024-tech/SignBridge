import React from 'react';

// ปุ่มควบคุมแบบไอคอนย่อสำหรับจอมือถือ/แท็บเล็ต (แทนการ์ดขนาดใหญ่ที่ใช้บนจอ desktop
// ซึ่งเบียดกันจนใช้งานไม่ได้บนจอแคบ) — ใช้ร่วมกันทั้งหน้า Student และหน้าเกมส์
export const MobileControlButton: React.FC<{
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'success';
  onClick: () => void;
}> = ({ icon: Icon, label, active = false, disabled = false, variant = 'default', onClick }) => {
  const activeBackground =
    variant === 'danger'
      ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
      : variant === 'success'
        ? 'linear-gradient(135deg, #16a34a, #15803d)'
        : 'linear-gradient(135deg, #0d47a1, #1662c4)';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: '1 1 30%',
        minWidth: '92px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        padding: '10px 6px',
        borderRadius: '14px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? activeBackground : '#ffffff',
        boxShadow: '0 4px 12px -6px rgba(13,71,161,0.2)',
        opacity: disabled ? 0.45 : 1
      }}
    >
      <Icon style={{ width: '19px', height: '19px', color: active ? '#ffffff' : '#0d47a1' }} />
      <span style={{ fontSize: '10.5px', fontWeight: 700, color: active ? '#ffffff' : '#475569', textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </span>
    </button>
  );
};

export default MobileControlButton;
