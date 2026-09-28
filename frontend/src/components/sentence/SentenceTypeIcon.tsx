import React from 'react';
import { HandFist } from 'lucide-react';
import { SentenceType, SENTENCE_TYPE_STYLE } from '../../data/sentences';

// ไอคอนวงกลมบอกรูปแบบประโยค: บอกเล่า = มือ (ฟ้า), คำถาม = ? (เหลือง), ปฏิเสธ = มือมีเส้นขีดทับ (แดง)
export const SentenceTypeIcon: React.FC<{ type: SentenceType; size?: number }> = ({ type, size = 60 }) => {
  const { icon: fg, bg } = SENTENCE_TYPE_STYLE[type];
  const iconSize = Math.round(size * 0.52);

  return (
    <div
      aria-label={`ประโยค${type}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: bg,
        border: `2px solid ${fg}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        boxSizing: 'border-box'
      }}
    >
      {type === 'คำถาม' ? (
        <span style={{ fontSize: `${Math.round(size * 0.56)}px`, fontWeight: 800, color: fg, lineHeight: 1, fontFamily: 'inherit' }}>?</span>
      ) : (
        <HandFist style={{ width: `${iconSize}px`, height: `${iconSize}px`, color: fg }} strokeWidth={2.2} />
      )}

      {type === 'ปฏิเสธ' && (
        // เส้นทแยงขีดทับแบบป้ายห้าม
        <div
          style={{
            position: 'absolute',
            width: '130%',
            height: `${Math.max(2, Math.round(size * 0.05))}px`,
            backgroundColor: fg,
            transform: 'rotate(-45deg)',
            borderRadius: '9999px'
          }}
        />
      )}
    </div>
  );
};

export default SentenceTypeIcon;
