import React from 'react';
import {
  Heart,
  Activity,
  HelpCircle,
  UserCheck,
  Users,
  HandHeart,
  Clock,
  MapPin,
  Package,
  Sliders,
  BookOpen
} from 'lucide-react';
import { useIsMobileView } from '../hooks/useIsMobileView';

interface CategoryItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  count: number;
}

interface DictionaryPageProps {
  onSelectCategory?: (categoryName: string) => void;
}

export const DictionaryPage: React.FC<DictionaryPageProps> = ({ onSelectCategory }) => {
  const isMobileView = useIsMobileView();
  // จอแท็บเล็ต (เช่น iPad แนวนอน) กว้างกว่า breakpoint มือถือ แต่ยังแคบเกินจะอัด 5 คอลัมน์แบบ
  // desktop ได้พอดี จึงลดเหลือ 3 คอลัมน์ ถ้าเนื้อหาเกินให้ผู้ใช้เลื่อนดูเอง
  const isTabletView = useIsMobileView(1366);
  const gridColumns = isMobileView ? 2 : isTabletView ? 3 : 5;
  const categories: CategoryItem[] = [
    { id: '1', name: 'ความรู้สึก', icon: <Heart style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 5 },
    { id: '2', name: 'คำกริยา', icon: <Activity style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 8 },
    { id: '3', name: 'คำถาม', icon: <HelpCircle style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 5 },
    { id: '4', name: 'คำสรรพนาม', icon: <UserCheck style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 3 },
    { id: '5', name: 'บุคคลและอาชีพ', icon: <Users style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 6 },
    { id: '6', name: 'มารยาท', icon: <HandHeart style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 3 },
    { id: '7', name: 'เวลา', icon: <Clock style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 1 },
    { id: '8', name: 'สถานที่', icon: <MapPin style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 5 },
    { id: '9', name: 'สิ่งของและวัตถุ', icon: <Package style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 6 },
    { id: '10', name: 'แสดงสภาวะ', icon: <Sliders style={{ width: '40px', height: '40px', color: '#0d47a1' }} />, count: 7 },
  ];

  const totalWords = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div
      className="sb-dict-fade"
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
        @keyframes sb-dict-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .sb-dict-fade { animation: sb-dict-fade-in 0.45s ease-out; }
        .sb-cat-card:active { transform: translateY(-1px) scale(0.98) !important; }
      `}</style>

      {/* HEADER SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '9999px', padding: '6px 18px 6px 10px', boxShadow: '0 6px 16px -8px rgba(13,71,161,0.18)', marginBottom: '14px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #0d47a1, #1662c4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookOpen style={{ width: '15px', height: '15px', color: '#ffffff' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d47a1' }}>คลังศัพท์ภาษามือ</span>
        </div>

        <h2 style={{ fontSize: '27px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
          หมวดหมู่คำศัพท์
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', marginTop: '6px', margin: 0 }}>
          ทั้งหมด {categories.length} หมวดหมู่ · {totalWords} คำศัพท์
        </p>
        <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, #dce8f7 15%, #dce8f7 85%, transparent)', marginTop: '18px' }} />
      </div>

      {/* CATEGORY GRID LIST — บนมือถือ/แท็บเล็ตลดเหลือ 2 คอลัมน์ และปล่อยให้สูงตามเนื้อหาจริง
          (ไม่บังคับ 2 แถวคงที่แบบ desktop) เพื่อให้หน้าเลื่อนดูที่เหลือได้แทนที่จะถูกบีบจนล้น */}
      <div
        style={{
          flex: isMobileView || isTabletView ? undefined : 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gridTemplateRows: isMobileView || isTabletView ? undefined : 'repeat(2, 1fr)',
          gap: isMobileView ? '12px' : '20px'
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            className="sb-cat-card"
            onClick={() => onSelectCategory && onSelectCategory(cat.name)}
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
              {cat.icon}
            </div>

            <div style={{ textAlign: 'center', maxWidth: '100%' }}>
              <span style={{ fontSize: isMobileView ? '14px' : '17px', fontWeight: 800, color: '#0d47a1', display: 'block', whiteSpace: isMobileView ? 'normal' : 'nowrap' }}>
                {cat.name}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#3b6bb0',
                  marginTop: '6px',
                  display: 'inline-block',
                  backgroundColor: '#eef4fc',
                  padding: '2px 10px',
                  borderRadius: '9999px'
                }}
              >
                {cat.count} คำศัพท์
              </span>
            </div>
          </button>
        ))}
      </div>

    </div>
  );
};

export default DictionaryPage;