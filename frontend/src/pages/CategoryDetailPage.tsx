import React from 'react';
import { ArrowLeft, BookOpen, Hash } from 'lucide-react';
import { useIsMobileView } from '../hooks/useIsMobileView';

interface CategoryDetailPageProps {
  categoryName: string;
  onBack: () => void;
  onSelectWord?: (wordName: string) => void;
}

const wordsData: Record<string, string[]> = {
  'ความรู้สึก': ['ร้อน', 'สบายดี', 'หนาว', 'หิว', 'อันตราย'],
  'คำกริยา': ['กิน', 'ชอบ', 'ต้องการ', 'ทำ', 'ไป', 'มา', 'เรียน', 'หยุด'],
  'คำถาม': ['ทำไม', 'ที่ไหน', 'เท่าไหร่', 'เมื่อไหร่', 'อะไร'],
  'คำสรรพนาม': ['เขา', 'คุณ', 'ฉัน'],
  'บุคคลและอาชีพ': ['คน', 'คนขับรถ', 'ครู', 'ตำรวจ', 'เพื่อน', 'หมอ'],
  'มารยาท': ['ขอโทษ', 'ขอบคุณ', 'สวัสดี'],
  'เวลา': ['วันนี้'],
  'สถานที่': ['ตลาด', 'บ้าน', 'โรงพยาบาล', 'โรงเรียน', 'ห้องน้ำ'],
  'สิ่งของและวัตถุ': ['เงิน', 'โทรศัพท์', 'น้ำ', 'รถยนต์', 'หนังสือ', 'อาหาร'],
  'แสดงสภาวะ': ['ใช่', 'ไม่', 'ไม่ใช่', 'ไม่ได้', 'ไม่เอา', 'ยัง', 'ห้าม'],
};

export const CategoryDetailPage: React.FC<CategoryDetailPageProps> = ({
  categoryName,
  onBack,
  onSelectWord,
}) => {
  const isMobileView = useIsMobileView();
  // จอแท็บเล็ต (เช่น iPad แนวนอน) กว้างกว่า breakpoint มือถือ แต่ยังแคบเกินจะอัด 5 คอลัมน์แบบ
  // desktop ได้พอดี จึงลดเหลือ 3 คอลัมน์ ถ้าเนื้อหาเกินให้ผู้ใช้เลื่อนดูเอง
  const isTabletView = useIsMobileView(1366);
  const gridColumns = isMobileView ? 2 : isTabletView ? 3 : 5;
  const words = wordsData[categoryName] || [];

  return (
    <div
      className="sb-catdetail-fade"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: isMobileView ? '16px' : '24px',
        background: 'radial-gradient(circle at 100% 0%, #f0f7ff 0%, #eaf1fb 45%)',
        color: '#1e293b',
        height: isMobileView ? 'auto' : '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* DECORATIVE STYLES — visual only, no logic */}
      <style>{`
        @keyframes sb-catdetail-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .sb-catdetail-fade { animation: sb-catdetail-fade-in 0.45s ease-out; }
        .sb-word-card:active { transform: translateY(-1px) scale(0.98) !important; }
        .sb-back-btn:active { transform: scale(0.97); }
      `}</style>

      {/* HEADER WITH BACK BUTTON */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexShrink: 0 }}>
        <button
          className="sb-back-btn"
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
            <Hash style={{ width: '13px', height: '13px', color: '#0d47a1' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0d47a1' }}>หมวดหมู่</span>
          </div>
          <h2 style={{ fontSize: '25px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            {categoryName}
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', marginTop: '4px', margin: 0 }}>
            ทั้งหมด {words.length} คำ
          </p>
        </div>

        <div style={{ width: '110px' }} />
      </div>

      <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, #dce8f7 15%, #dce8f7 85%, transparent)', marginBottom: '18px', flexShrink: 0 }} />

      {/* WORD GRID LIST — บนมือถือ/แท็บเล็ตลดเหลือ 2 คอลัมน์ ปล่อยความสูงตามเนื้อหาจริงแล้วให้
          หน้า (ไม่ใช่ grid นี้เอง) เป็นตัวเลื่อน เพื่อเลี่ยงปัญหา flex:1 + overflow ซ้อนกันสองชั้น */}
      {words.length > 0 ? (
        <div
          className="sb-scroll"
          style={{
            flex: isMobileView || isTabletView ? undefined : 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            gridTemplateRows: isMobileView || isTabletView ? undefined : 'repeat(2, 1fr)',
            gap: isMobileView ? '12px' : '20px',
            overflowY: isMobileView || isTabletView ? 'visible' : 'auto'
          }}
        >
          {words.map((word, index) => (
            <button
              key={index}
              className="sb-word-card"
              onClick={() => onSelectWord && onSelectWord(word)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e3ecf7',
                borderRadius: '24px',
                padding: isMobileView ? '14px 10px' : '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isMobileView ? '10px' : '14px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 14px rgba(13, 71, 161, 0.06)',
                height: isMobileView ? undefined : '100%',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.borderColor = '#0d47a1';
                e.currentTarget.style.boxShadow = '0 12px 28px -8px rgba(13, 71, 161, 0.28)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#e3ecf7';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(13, 71, 161, 0.06)';
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #0d47a1, #6fbeef)' }} />

              <div
                style={{
                  width: isMobileView ? '52px' : '68px',
                  height: isMobileView ? '52px' : '68px',
                  background: 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #dbeafe',
                  flexShrink: 0
                }}
              >
                <BookOpen style={{ width: isMobileView ? '28px' : '40px', height: isMobileView ? '28px' : '40px', color: '#0d47a1' }} />
              </div>

              <div style={{ textAlign: 'center', maxWidth: '100%' }}>
                <span style={{ fontSize: isMobileView ? '14px' : '17px', fontWeight: 800, color: '#0d47a1', display: 'block', whiteSpace: isMobileView ? 'normal' : 'nowrap' }}>
                  {word}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#eef4fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen style={{ width: '28px', height: '28px', color: '#94a3b8' }} />
          </div>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8' }}>ยังไม่มีคำศัพท์ในหมวดหมู่นี้</span>
        </div>
      )}

    </div>
  );
};

export default CategoryDetailPage;