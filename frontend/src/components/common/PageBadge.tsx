import React from 'react';

// ป้ายหัวข้อเหนือชื่อหน้า (แบบ "คลังศัพท์ภาษามือ"): เม็ดยาสีขาวมีขอบ+เงา ไอคอนสีขาวในวงกลมน้ำเงินไล่สี
// ใช้ร่วมกันทุกหน้า — แก้ที่นี่ที่เดียว ป้ายทุกหน้าเปลี่ยนตาม
export const PageBadge: React.FC<{
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  text: string;
  marginBottom?: string;
}> = ({ icon: Icon, text, marginBottom = '14px' }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      backgroundColor: '#ffffff',
      border: '1px solid #e3ecf7',
      borderRadius: '9999px',
      padding: '6px 18px 6px 10px',
      boxShadow: '0 6px 16px -8px rgba(13,71,161,0.18)',
      marginBottom
    }}
  >
    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #0d47a1, #1662c4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon style={{ width: '15px', height: '15px', color: '#ffffff' }} />
    </div>
    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d47a1' }}>{text}</span>
  </div>
);

export default PageBadge;
