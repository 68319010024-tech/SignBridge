import React from 'react';
import { Camera, RefreshCw, CloudFog, Bone } from 'lucide-react';
import { BoxHeader, homeCardStyle, homeWatermarkStyle, homeButtonStyle, homeButtonIconStyle, homeGhostStyle, homeGhostIconStyle } from '../common/BoxHeader';
import { BLUE_GRADIENT } from '../common/theme';

interface CameraControlBoxProps {
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  isBlurBg: boolean;
  onToggleBlur: () => void;
  isShowSkeleton: boolean;
  onToggleSkeleton: () => void;
  // จอเตี้ย: หัวกล่องเล็กและช่องไฟแคบลง ให้คอลัมน์ขวาไม่ยาวเกินขอบล่างของกล้อง
  compact?: boolean;
}

// กล่องควบคุมกล้อง (ใช้ร่วมกันทั้งหน้าหลักและหน้าทบทวนไวยากรณ์)
export const CameraControlBox: React.FC<CameraControlBoxProps> = ({
  isCameraOn,
  onToggleCamera,
  onSwitchCamera,
  isBlurBg,
  onToggleBlur,
  isShowSkeleton,
  onToggleSkeleton,
  compact = false
}) => (
  // minHeight: overflow: hidden (ไว้ตัดไอคอนลายน้ำ) ทำให้ flex item หดต่ำกว่าเนื้อหาได้ — คืนค่าความสูงขั้นต่ำ = เนื้อหา
  <div style={{ ...homeCardStyle, flex: 1, minHeight: 'min-content', padding: compact ? '12px 14px' : '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: compact ? '7px' : '10px' }}>
    <Camera style={{ ...homeWatermarkStyle, width: '96px', height: '96px', right: '-18px', top: '-16px' }} />
    <BoxHeader icon={Camera} title="ควบคุมกล้อง" size={compact ? 'sm' : 'md'} />

    <button
      onClick={onToggleCamera}
      className="sb-primary-btn"
      style={{
        ...homeButtonStyle,
        cursor: 'pointer',
        background: isCameraOn ? BLUE_GRADIENT : 'linear-gradient(135deg, #b91c1c, #ef4444)',
        color: '#ffffff',
        boxShadow: isCameraOn ? '0 8px 18px -8px rgba(22,98,196,0.6)' : '0 8px 18px -8px rgba(220,38,38,0.6)'
      }}
    >
      <span style={{ ...homeButtonIconStyle, backgroundColor: 'rgba(255,255,255,0.22)' }}>
        <Camera style={{ width: '13px', height: '13px', color: '#ffffff' }} />
      </span>
      {isCameraOn ? 'เปิดกล้อง' : 'ปิดกล้อง'}
    </button>

    <button
      onClick={onSwitchCamera}
      disabled={!isCameraOn}
      className="sb-ghost-btn"
      style={{
        ...homeButtonStyle,
        ...homeGhostStyle,
        fontSize: '12.5px',
        cursor: isCameraOn ? 'pointer' : 'not-allowed',
        opacity: isCameraOn ? 1 : 0.4
      }}
    >
      <span style={homeGhostIconStyle}>
        <RefreshCw style={{ width: '12px', height: '12px', color: '#0d47a1' }} />
      </span>
      สลับกล้อง
    </button>

    {[
      { icon: CloudFog, label: 'เบลอพื้นหลัง', on: isBlurBg, toggle: onToggleBlur },
      { icon: Bone, label: 'แสดงโครงกระดูก', on: isShowSkeleton, toggle: onToggleSkeleton },
    ].map((t) => (
      <button
        key={t.label}
        onClick={t.toggle}
        disabled={!isCameraOn}
        className="sb-ghost-btn"
        style={{
          ...homeButtonStyle,
          ...homeGhostStyle,
          padding: '6px 10px',
          fontSize: '11.5px',
          justifyContent: 'space-between',
          cursor: isCameraOn ? 'pointer' : 'not-allowed',
          opacity: isCameraOn ? 1 : 0.4
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <t.icon style={{ width: '14px', height: '14px', color: t.on ? '#0d47a1' : '#64748b' }} />
          {t.label}
        </span>
        {/* สวิตช์เปิด/ปิด */}
        <span style={{ width: '32px', height: '18px', borderRadius: '9999px', padding: '2px', background: t.on ? BLUE_GRADIENT : '#cbd5e1', display: 'flex', alignItems: 'center', boxSizing: 'border-box', transition: 'background 0.3s', flexShrink: 0 }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transform: t.on ? 'translateX(14px)' : 'translateX(0)', transition: 'transform 0.3s' }} />
        </span>
      </button>
    ))}
  </div>
);

export default CameraControlBox;
