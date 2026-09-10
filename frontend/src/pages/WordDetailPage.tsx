import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Tag, Folder, SpellCheck } from 'lucide-react';
import { useIsMobileView } from '../hooks/useIsMobileView';

interface WordDetailPageProps {
  wordName: string;
  categoryName: string;
  onBack: () => void;
}

// Map คำศัพท์กับชนิดของคำตามหลักไวยากรณ์ภาษาไทย
const wordTypeMapping: Record<string, string> = {
  // คำนาม
  'คน': 'คำนาม',
  'คนขับรถ': 'คำนาม',
  'ตำรวจ': 'คำนาม',
  'หมอ': 'คำนาม',
  'ครู': 'คำนาม',
  'เพื่อน': 'คำนาม',
  'ตลาด': 'คำนาม',
  'บ้าน': 'คำนาม',
  'โรงพยาบาล': 'คำนาม',
  'ห้องน้ำ': 'คำนาม',
  'โรงเรียน': 'คำนาม',
  'เงิน': 'คำนาม',
  'โทรศัพท์': 'คำนาม',
  'น้ำ': 'คำนาม',
  'รถยนต์': 'คำนาม',
  'อาหาร': 'คำนาม',
  'หนังสือ': 'คำนาม',
  'วันนี้': 'คำนามบอกเวลา',

  // คำสรรพนาม
  'เขา': 'คำสรรพนาม',
  'คุณ': 'คำสรรพนาม',
  'ฉัน': 'คำสรรพนาม',

  // คำกริยา
  'กิน': 'คำกริยา',
  'ไป': 'คำกริยา',
  'มา': 'คำกริยา',
  'ชอบ': 'คำกริยา',
  'เรียน': 'คำกริยา',
  'ต้องการ': 'คำกริยา',
  'ทำ': 'คำกริยา',
  'หยุด': 'คำกริยา',
  'สบายดี': 'คำกริยาแสดงสภาวะ',
  'ใช่': 'คำกริยา',
  'ไม่ใช่': 'คำกริยา',

  // คำวิเศษณ์
  'ร้อน': 'คำวิเศษณ์',
  'หนาว': 'คำวิเศษณ์',
  'หิว': 'คำวิเศษณ์',
  'อันตราย': 'คำวิเศษณ์',
  'ทำไม': 'คำวิเศษณ์แสดงคำถาม',
  'ที่ไหน': 'คำวิเศษณ์แสดงคำถาม',
  'เท่าไหร่': 'คำวิเศษณ์แสดงคำถาม',
  'เมื่อไหร่': 'คำวิเศษณ์แสดงคำถาม',
  'อะไร': 'คำวิเศษณ์แสดงคำถาม',
  'ไม่': 'คำวิเศษณ์ปฏิเสธ',
  'ไม่ได้': 'คำวิเศษณ์ปฏิเสธ',
  'ไม่เอา': 'คำวิเศษณ์ปฏิเสธ',
  'ห้าม': 'คำวิเศษณ์ข้อห้าม',
  'ยัง': 'คำวิเศษณ์ปฏิเสธ',

  // คำทักทาย
  'สวัสดี': 'คำทักทาย',
  'ขอบคุณ': 'คำทักทาย',
  'ขอโทษ': 'คำทักทาย',
};

export const WordDetailPage: React.FC<WordDetailPageProps> = ({
  wordName,
  categoryName,
  onBack,
}) => {
  const isMobileView = useIsMobileView();
  // จอแท็บเล็ต (เช่น iPad แนวนอน) ก็ยังไม่มีที่พอให้วิดีโอสูงคงที่ 550px แบบ desktop เหมือนกัน
  // เลยให้ใช้ aspect-ratio + ปล่อยให้หน้า (ไม่ใช่กล่องนี้เอง) เป็นตัวเลื่อนเหมือนโหมดมือถือไปเลย
  const isTabletView = useIsMobileView(1366);
  const isCompactView = isMobileView || isTabletView;
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ดึงไฟล์วิดีโอใบแรกในโฟลเดอร์คำศัพท์
  const videoSrc = encodeURI(`/video/${categoryName}/${wordName}/${wordName}-1.mp4`);

  // ดึงชนิดของคำจาก Mapping
  const wordType = wordTypeMapping[wordName] || 'คำนาม';

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch((err) => {
          console.error("ไม่สามารถเล่นวิดีโอได้:", err);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    setIsPlaying(false);
  }, [wordName]);

  return (
    <div
      className="sb-worddetail-fade"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: isMobileView ? '16px' : '24px',
        background: 'radial-gradient(circle at 100% 0%, #f0f7ff 0%, #eaf1fb 45%)',
        color: '#1e293b',
        height: isCompactView ? 'auto' : '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* DECORATIVE STYLES — visual only, no logic */}
      <style>{`
        @keyframes sb-worddetail-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .sb-worddetail-fade { animation: sb-worddetail-fade-in 0.45s ease-out; }
        .sb-back-btn2:active { transform: scale(0.97); }
        .sb-video-box:hover .sb-play-badge { transform: translate(-50%, -50%) scale(1.06); box-shadow: 0 0 32px rgba(13, 71, 161, 0.55); }
        .sb-info-row { transition: background-color 0.2s ease; }
        .sb-info-row:hover { background-color: #f4f9ff; }
        .sb-scroll::-webkit-scrollbar { width: 8px; }
        .sb-scroll::-webkit-scrollbar-track { background: transparent; }
        .sb-scroll::-webkit-scrollbar-thumb { background: #c7dbf5; border-radius: 10px; }
        .sb-scroll::-webkit-scrollbar-thumb:hover { background: #9cc0ea; }
      `}</style>

      {/* HEADER WITH BACK BUTTON */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexShrink: 0 }}>
        <button
          className="sb-back-btn2"
          onClick={onBack}
          style={{
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
            boxShadow: '0 4px 12px -4px rgba(13,71,161,0.12)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #0d47a1, #1662c4)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.boxShadow = '0 6px 16px -4px rgba(13,71,161,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.color = '#0d47a1';
            e.currentTarget.style.boxShadow = '0 4px 12px -4px rgba(13,71,161,0.12)';
          }}
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
          ย้อนกลับ
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#eef4fc', borderRadius: '9999px', padding: '4px 14px', marginBottom: '8px' }}>
            <SpellCheck style={{ width: '13px', height: '13px', color: '#0d47a1' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0d47a1' }}>รายละเอียดคำศัพท์</span>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            {wordName}
          </h2>
        </div>

        <div style={{ width: '110px' }} />
      </div>

      <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, #dce8f7 15%, #dce8f7 85%, transparent)', marginBottom: '18px', flexShrink: 0 }} />

      {/* MAIN CONTENT AREA — บนมือถือไม่ใส่ flex:1/overflowY:auto ที่นี่ ปล่อยให้สูงตามเนื้อหาจริง
          แล้วให้หน้า (ancestor ที่ตั้ง overflow:auto ไว้แล้ว) เป็นตัวเลื่อนจุดเดียว ไม่งั้นจะเจอ
          ปัญหาเดิม: ส่วนท้าย (รายละเอียดคำศัพท์) โดนตัดจนเลื่อนลงไปดูไม่สุด */}
      <div className="sb-scroll" style={{ display: 'flex', flexDirection: 'column', gap: isMobileView ? '14px' : '20px', flex: isCompactView ? undefined : 1, overflowY: isCompactView ? 'visible' : 'auto' }}>

        {/* VIDEO CONTAINER — บนมือถือใช้ aspect-ratio แทนความสูงคงที่ 550px เพื่อให้พอดีความกว้าง
            จอจริงแทนที่จะถูกบีบจนวิดีโอเหลือแถบเล็ก ๆ ตรงกลาง */}
        <div
          className="sb-video-box"
          onClick={togglePlay}
          style={{
            width: '100%',
            height: isCompactView ? undefined : '550px',
            aspectRatio: isCompactView ? '16 / 9' : undefined,
            // จอกว้างแต่เตี้ย (เช่น iPad แนวนอน) ถ้าคำนวณความสูงจาก aspect-ratio 16:9 ตามความกว้าง
            // เต็มจอเฉยๆ อาจสูงจนบังรายละเอียดคำศัพท์ด้านล่างไปหมด จึงจำกัดเพดานความสูงไว้ (แค่พอให้เห็น
            // แถว "ชื่อคำศัพท์" แถวแรกโผล่มา ส่วนแถวที่เหลือ (หมวดหมู่/ชนิดของคำ) ให้ผู้ใช้เลื่อนดูเอง —
            // ไม่ใช่จำกัดแคบจนวิดีโอเล็กเกินไปแบบก่อนหน้านี้) object-fit: contain ของ <video> ด้านใน
            // ทำให้สัดส่วนวิดีโอยังถูกต้องเสมอไม่ว่ากล่องจะถูกจำกัดความสูงแค่ไหน
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
            flexShrink: 0
          }}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            controls={isPlaying}
            playsInline
            loop
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* WORD LABEL BADGE */}
          <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '9999px', padding: '6px 14px', zIndex: 15, backdropFilter: 'blur(4px)' }}>
            <Tag style={{ width: '13px', height: '13px', color: '#6fbeef' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>{categoryName}</span>
          </div>

          {/* PLAY BUTTON */}
          {!isPlaying && (
            <div 
              className="sb-play-badge"
              style={{ 
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '84px', 
                height: '84px', 
                backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '3px solid #0d47a1',
                boxShadow: '0 0 24px rgba(13, 71, 161, 0.4)',
                zIndex: 20,
                pointerEvents: 'none',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
            >
              <Play style={{ width: '40px', height: '40px', color: '#0d47a1', marginLeft: '6px' }} />
            </div>
          )}

          {isPlaying && (
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(13,71,161,0.85)',
                borderRadius: '9999px',
                padding: '6px 12px',
                zIndex: 15
              }}
            >
              <Pause style={{ width: '12px', height: '12px', color: '#ffffff' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>กำลังเล่น</span>
            </div>
          )}
        </div>

        {/* DETAILS SECTION */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', padding: '10px 18px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 28px -14px rgba(13,71,161,0.16)', flexShrink: 0 }}>
          {[
            { icon: SpellCheck, label: 'ชื่อคำศัพท์', value: wordName },
            { icon: Folder, label: 'หมวดหมู่', value: categoryName },
            { icon: Tag, label: 'ชนิดของคำ', value: wordType },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className="sb-info-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 8px',
                borderBottom: i < arr.length - 1 ? '1px solid #eef2f7' : 'none',
                borderRadius: '12px'
              }}
            >
              <div style={{ width: '38px', height: '38px', borderRadius: '11px', backgroundColor: '#e8f1fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <row.icon style={{ width: '18px', height: '18px', color: '#0d47a1' }} />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#64748b', minWidth: '110px' }}>{row.label}</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#0d47a1' }}>{row.value}</span>
            </div>
          ))}
        </div>

      </div>

    </div>
  );
};

export default WordDetailPage;