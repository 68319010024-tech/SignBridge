import React from 'react';
import { ScanFace } from 'lucide-react';
import { GOLD } from '../common/theme';

// /ai2/ ใช้สีทองแทนสีเหลือง
const WARNING_COLOR = __SB_RED_THEME__ ? GOLD : '#facc15';

// แถบเตือนซ้อนบนภาพกล้อง เมื่อ backend แจ้งว่าผู้ใช้อยู่ใกล้กล้องเกินไป (too_close)
// ใกล้เกินไปทำให้มือ/ไหล่หลุดขอบภาพและสัดส่วนต่างจากข้อมูลที่โมเดลเทรนมา จนทายผิดบ่อย
// วางไว้ขอบบนของภาพ ไม่ใช่ขอบล่าง เพราะช่วงล่างคือระดับอกที่ผู้ใช้ทำมือ จะบังท่าทางพอดี
// ต้องวางใน container ที่ตั้ง position: 'relative' ไว้
const TooCloseWarning: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;
  return (
    <div
      role="alert"
      className="sb-too-close"
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        zIndex: 4,
        width: 'max-content',
        maxWidth: 'calc(100% - 32px)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 18px 10px 10px',
        backgroundColor: WARNING_COLOR,
        color: '#1c1917',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        boxShadow: '0 10px 30px -8px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.15)',
        pointerEvents: 'none'
      }}
    >
      <style>{`
        @keyframes sb-too-close-in {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .sb-too-close { transform: translateX(-50%); animation: sb-too-close-in 0.25s ease-out; }
        /* จอแคบ: ขยับลงให้พ้นป้าย LIVE ที่มุมซ้ายบน */
        @media (max-width: 640px) { .sb-too-close { top: 60px !important; } }
      `}</style>

      <div
        style={{
          flexShrink: 0,
          width: '38px',
          height: '38px',
          borderRadius: '12px',
          backgroundColor: '#1c1917',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <ScanFace style={{ width: '22px', height: '22px', color: WARNING_COLOR }} strokeWidth={2.2} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.3 }}>อยู่ใกล้กล้องเกินไป</span>
        <span style={{ fontSize: '12.5px', fontWeight: 500, lineHeight: 1.4, color: 'rgba(28, 25, 23, 0.78)' }}>
          ถอยห่างอีกเล็กน้อย ให้เห็นศีรษะถึงช่วงอก และทำมือที่ระดับอก
        </span>
      </div>
    </div>
  );
};

export default TooCloseWarning;
