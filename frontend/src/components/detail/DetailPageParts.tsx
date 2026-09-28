import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Tag } from 'lucide-react';
import { PageBadge } from '../common/PageBadge';

// ส่วนประกอบร่วมของหน้ารายละเอียดแบบ "วิดีโอซ้าย + กล่องรายละเอียดขวา"
// ใช้ทั้งหน้าตัวอย่างประโยค (SentenceDetailPage) และหน้ารายละเอียดคำศัพท์ (WordDetailPage)
// รวมถึงหัวหน้า/สไตล์ที่ใช้ในหน้าเลือกกลุ่มและรายการประโยค

type IconType = React.ComponentType<{ style?: React.CSSProperties }>;

export const DETAIL_PAGE_STYLES = `
  @keyframes sb-detail-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .sb-detail-fade { animation: sb-detail-fade-in 0.45s ease-out; }
  .sb-detail-back:hover { background: linear-gradient(135deg, #0d47a1, #1662c4) !important; color: #ffffff !important; box-shadow: 0 6px 16px -4px rgba(13,71,161,0.4) !important; }
  .sb-detail-back:active { transform: scale(0.97); }
  .sb-detail-card { transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
  .sb-detail-card:hover { transform: translateY(-4px); border-color: #0d47a1 !important; box-shadow: 0 12px 28px -8px rgba(13,71,161,0.28) !important; }
  .sb-detail-card:active { transform: translateY(-1px) scale(0.98); }
  .sb-detail-video:hover .sb-detail-play { transform: translate(-50%, -50%) scale(1.06); box-shadow: 0 0 32px rgba(13, 71, 161, 0.55); }
  .sb-detail-link { transition: background-color 0.2s ease, border-color 0.2s ease; }
  .sb-detail-link:hover { background-color: #eef4fc !important; border-color: #9cc0ea !important; }
  .sb-scroll::-webkit-scrollbar { width: 8px; }
  .sb-scroll::-webkit-scrollbar-track { background: transparent; }
  .sb-scroll::-webkit-scrollbar-thumb { background: #c7dbf5; border-radius: 10px; }
`;

// dense (แท็บเล็ตแนวนอน/จอเตี้ย): ตัด padding ของหน้าเอง (<main> มี padding อยู่แล้ว) ให้แถววิดีโอสูงขึ้น
export const detailPageContainerStyle = (isMobileView: boolean, fillHeight: boolean, dense = false): React.CSSProperties => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: dense ? '0' : isMobileView ? '16px' : '24px',
  background: 'radial-gradient(circle at 100% 0%, #f0f7ff 0%, #eaf1fb 45%)',
  color: '#1e293b',
  height: fillHeight ? '100%' : 'auto',
  boxSizing: 'border-box'
});

interface PageHeaderProps {
  onBack?: () => void;
  badgeIcon: IconType;
  badgeText: string;
  title: string;
  subtitle?: string;
  isMobileView: boolean;
  // inline: ป้ายหัวข้อกับชื่อหน้าอยู่แถวเดียวกัน (แท็บเล็ตแนวนอน) ประหยัดความสูงให้วิดีโอ/รายละเอียด
  inline?: boolean;
}

// ปุ่มย้อนกลับ + ป้ายหัวข้อ + ชื่อหน้า
export const PageHeader: React.FC<PageHeaderProps> = ({ onBack, badgeIcon: BadgeIcon, badgeText, title, subtitle, isMobileView, inline = false }) => (
  <>
    <div
      style={{
        display: 'flex',
        flexDirection: isMobileView && onBack ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: onBack ? 'space-between' : 'center',
        gap: '12px',
        marginBottom: inline ? '12px' : '18px',
        flexShrink: 0
      }}
    >
      {onBack && (
        <button
          className="sb-detail-back"
          onClick={onBack}
          style={{
            alignSelf: isMobileView ? 'flex-start' : undefined,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #e3ecf7',
            color: '#0d47a1',
            padding: '9px 20px',
            borderRadius: '9999px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px -4px rgba(13,71,161,0.12)',
            flexShrink: 0,
            fontFamily: 'inherit'
          }}
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
          ย้อนกลับ
        </button>
      )}

      <div style={{ textAlign: 'center', minWidth: 0, display: inline ? 'flex' : 'block', alignItems: 'center', gap: '12px' }}>
        <PageBadge icon={BadgeIcon} text={badgeText} marginBottom={inline ? '0' : '8px'} />
        <h2 style={{ fontSize: isMobileView ? '22px' : '26px', fontWeight: 800, color: '#1e293b', margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '13.5px', color: '#64748b', margin: '4px 0 0 0' }}>{subtitle}</p>}
      </div>

      {/* ตัวถ่วงให้หัวข้ออยู่กึ่งกลางพอดีบน desktop (กว้างเท่าปุ่มย้อนกลับ) */}
      {onBack && !isMobileView && <div style={{ width: '120px', flexShrink: 0 }} />}
    </div>

    <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, #dce8f7 15%, #dce8f7 85%, transparent)', marginBottom: inline ? '14px' : '18px', flexShrink: 0 }} />
  </>
);

// กล่องวิดีโอ 16:9 (คลิปคำศัพท์และคลิปประโยคเป็น 1920x1080 ทั้งหมด) กดที่กล่องเพื่อเล่น/หยุด
// fill (แท็บเล็ตแนวนอน): สูงเต็มแถวเท่ากล่องรายละเอียด แล้วครอบภาพให้เต็มกล่อง (ตัดขอบซ้ายขวาที่เป็นฉากหลัง
// ผู้แสดงท่ายืนกลางภาพเสมอ) แทนการคงสัดส่วน 16:9 ที่ทำให้วิดีโอเตี้ยในคอลัมน์แคบ
export const VideoBox: React.FC<{ src: string; label: string; isCompactView: boolean; fill?: boolean }> = ({ src, label, isCompactView, fill = false }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsPlaying(false);
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => console.error('ไม่สามารถเล่นวิดีโอได้:', err));
    }
  };

  return (
    <div
      className="sb-detail-video"
      onClick={togglePlay}
      style={{
        width: '100%',
        height: fill ? '100%' : undefined,
        aspectRatio: fill ? undefined : '16 / 9',
        maxHeight: isCompactView ? '60dvh' : undefined,
        backgroundColor: '#000000',
        borderRadius: '28px',
        border: '3px solid #0d47a1',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 0 25px rgba(13, 71, 161, 0.35), inset 0 0 15px rgba(13, 71, 161, 0.15)',
        boxSizing: 'border-box'
      }}
    >
      <video
        key={src}
        ref={videoRef}
        src={src}
        controls={isPlaying}
        playsInline
        loop
        preload="metadata"
        style={{ width: '100%', height: '100%', objectFit: fill ? 'cover' : 'contain' }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '9999px', padding: '6px 14px', zIndex: 15, backdropFilter: 'blur(4px)' }}>
        <Tag style={{ width: '13px', height: '13px', color: '#6fbeef' }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>{label}</span>
      </div>

      {!isPlaying ? (
        <div
          className="sb-detail-play"
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '84px', height: '84px', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #0d47a1', boxShadow: '0 0 24px rgba(13, 71, 161, 0.4)', zIndex: 20, pointerEvents: 'none', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
        >
          <Play style={{ width: '40px', height: '40px', color: '#0d47a1', marginLeft: '6px' }} />
        </div>
      ) : (
        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(13,71,161,0.85)', borderRadius: '9999px', padding: '6px 12px', zIndex: 15 }}>
          <Pause style={{ width: '12px', height: '12px', color: '#ffffff' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>กำลังเล่น</span>
        </div>
      )}
    </div>
  );
};

// วิดีโอซ้าย + กล่องรายละเอียดขวา โดยบน desktop กล่องรายละเอียดสูงเท่าวิดีโอพอดี:
// ความสูงของแถวมาจากวิดีโอ (16:9) อย่างเดียว ส่วนกล่องรายละเอียดวางแบบ absolute เต็มช่องของมัน
// ถ้าเนื้อหายาวกว่าก็เลื่อนในกล่องเอง ไม่ดันแถวให้สูงกว่าวิดีโอ
// จอเล็ก: เรียงลงมาตามปกติ ให้หน้า (ไม่ใช่กล่องนี้) เป็นตัวเลื่อน
// fillHeight (แท็บเล็ตแนวนอน): วิดีโอเตี้ยเพราะคอลัมน์แคบ ถ้ากล่องรายละเอียดสูงเท่าวิดีโอจะเหลือที่ว่างใต้ทั้งคู่
// จึงให้แถวยืดเต็มความสูงที่เหลือของหน้า วิดีโอชิดบน กล่องรายละเอียดสูงเต็มแถว
export const VideoDetailLayout: React.FC<{ video: React.ReactNode; isMobileView: boolean; isCompactView: boolean; fillHeight?: boolean; children: React.ReactNode }> = ({
  video,
  isMobileView,
  isCompactView,
  fillHeight = false,
  children
}) => {
  const panelStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e3ecf7',
    borderRadius: '24px',
    // แท็บเล็ตแนวนอนสูงจำกัด: ลดช่องไฟให้รายละเอียดประโยคพอดีกล่องโดยไม่ต้องเลื่อน
    padding: isMobileView ? '16px' : fillHeight ? '16px 20px' : '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: fillHeight && !isCompactView ? '10px' : '16px',
    boxShadow: '0 10px 28px -14px rgba(13,71,161,0.16)',
    boxSizing: 'border-box'
  };

  return (
    <div
      style={{
        display: 'grid',
        // fillHeight: วิดีโอสูงเต็มแถวแล้ว แบ่งครึ่งให้กล่องรายละเอียดกว้างพอไม่ให้คำอธิบายตกบรรทัด
        gridTemplateColumns: isCompactView ? '1fr' : fillHeight ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1.5fr) minmax(340px, 1fr)',
        gap: isMobileView ? '14px' : '20px',
        alignItems: 'start',
        ...(fillHeight && !isCompactView ? { flex: 1, minHeight: 0, gridTemplateRows: 'minmax(0, 1fr)' } : {})
      }}
    >
      {fillHeight && !isCompactView ? <div style={{ alignSelf: 'stretch', minHeight: 0 }}>{video}</div> : video}
      {isCompactView ? (
        <div style={panelStyle}>{children}</div>
      ) : (
        <div style={{ position: 'relative', alignSelf: 'stretch' }}>
          <div className="sb-scroll" style={{ ...panelStyle, position: 'absolute', inset: 0, overflowY: 'auto' }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

// หัวข้อย่อยในกล่องรายละเอียด (ไอคอน + ชื่อหัวข้อ + คำอธิบายสั้นในวงเล็บ)
export const SectionTitle: React.FC<{ icon: IconType; title: string; hint?: string }> = ({ icon: Icon, title, hint }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
    <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: '#e8f1fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon style={{ width: '17px', height: '17px', color: '#0d47a1' }} />
    </div>
    <span style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>{title}</span>
    {hint && <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>({hint})</span>}
  </div>
);

export const Divider: React.FC = () => <div style={{ height: '1px', backgroundColor: '#eef2f7', flexShrink: 0 }} />;

// กล่องคำ (ใช้ทั้งค่าในรายละเอียดคำศัพท์ และลำดับคำในไวยากรณ์ประโยค)
export const Chip: React.FC<{ children: React.ReactNode; solid?: boolean; size?: 'md' | 'lg' }> = ({ children, solid, size = 'md' }) => (
  <span
    style={{
      display: 'inline-block',
      fontSize: size === 'lg' ? '22px' : '17px',
      fontWeight: 800,
      color: solid ? '#ffffff' : '#0d47a1',
      backgroundColor: solid ? '#0d47a1' : '#eef4fc',
      padding: size === 'lg' ? '8px 18px' : '6px 14px',
      borderRadius: '12px',
      whiteSpace: 'nowrap'
    }}
  >
    {children}
  </span>
);
