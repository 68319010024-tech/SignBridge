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
  ToggleRight,
  BookOpen,
  ArrowRight,
  type LucideIcon
} from 'lucide-react';
import { useIsMobileView } from '../hooks/useIsMobileView';
import { PageBadge } from '../components/common/PageBadge';
import { wordsData, wordIconOf } from '../data/words';
import { BLUE_GRADIENT, CARD_SHADOW, HERO_CARD_STYLES } from '../components/common/theme';

interface CategoryItem {
  name: string;
  icon: LucideIcon;
}

interface DictionaryPageProps {
  onSelectCategory?: (categoryName: string) => void;
}

const CATEGORIES: CategoryItem[] = [
  { name: 'ความรู้สึก', icon: Heart },
  { name: 'คำกริยา', icon: Activity },
  { name: 'คำถาม', icon: HelpCircle },
  { name: 'คำสรรพนาม', icon: UserCheck },
  { name: 'บุคคลและอาชีพ', icon: Users },
  { name: 'มารยาท', icon: HandHeart },
  { name: 'เวลา', icon: Clock },
  { name: 'สถานที่', icon: MapPin },
  { name: 'สิ่งของและวัตถุ', icon: Package },
  { name: 'แสดงสภาวะ', icon: ToggleRight },
];

// จำนวนคำตัวอย่างที่โชว์บนการ์ด (ที่เหลือแสดงเป็น +N)
const PREVIEW_COUNT = 3;

const DICT_STYLES = `
  @keyframes sb-dict-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .sb-dict-fade { animation: sb-dict-fade-in 0.45s ease-out; }
` + HERO_CARD_STYLES;

export const DictionaryPage: React.FC<DictionaryPageProps> = ({ onSelectCategory }) => {
  const isMobileView = useIsMobileView();
  // แท็บเล็ต (เช่น iPad แนวนอน) กว้างไม่พอ 5 คอลัมน์ จึงลดเหลือ 3 ส่วน desktop แถวละ 5 แล้วเลื่อนดูแถวถัดไป
  const isTabletView = useIsMobileView(1366);
  const gridColumns = isMobileView ? 2 : isTabletView ? 3 : 5;
  const totalWords = CATEGORIES.reduce((sum, c) => sum + (wordsData[c.name]?.length ?? 0), 0);

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
        boxSizing: 'border-box'
      }}
    >
      <style>{DICT_STYLES}</style>

      {/* HEADER SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <PageBadge icon={BookOpen} text="คลังศัพท์ภาษามือ" />
        <h2 style={{ fontSize: isMobileView ? '22px' : '27px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
          หมวดหมู่คำศัพท์
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '6px 0 0 0' }}>
          ทั้งหมด {CATEGORIES.length} หมวดหมู่ · {totalWords} คำศัพท์ · เลือกหมวดเพื่อดูวิดีโอท่าภาษามือ
        </p>
        <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, #dce8f7 15%, #dce8f7 85%, transparent)', marginTop: '18px' }} />
      </div>

      {/* CATEGORY GRID — การ์ดสูงตามเนื้อหา แถวละ 5 (desktop) ส่วนแถวถัดไปให้หน้าเลื่อนลงไปดู */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          gap: isMobileView ? '12px' : '20px',
          paddingBottom: '8px'
        }}
      >
        {CATEGORIES.map((cat, index) => {
          const words = wordsData[cat.name] ?? [];
          const preview = words.slice(0, PREVIEW_COUNT);
          const rest = words.length - preview.length;
          const Icon = cat.icon;
          return (
            <button
              key={cat.name}
              className="sb-hero-card sb-cat-card"
              onClick={() => onSelectCategory && onSelectCategory(cat.name)}
              style={{
                animationDelay: `${index * 0.04}s`,
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                border: '1px solid #e3ecf7',
                borderRadius: '24px',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                boxShadow: CARD_SHADOW,
                textAlign: 'left',
                fontFamily: 'inherit'
              }}
            >
              {/* HERO: พื้นไล่สีประจำหมวด + ไอคอนในกล่องกระจก + ไอคอนใหญ่จาง ๆ เป็นลายน้ำ */}
              <div
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  background: BLUE_GRADIENT,
                  padding: isMobileView ? '14px' : '18px 18px 16px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  minHeight: isMobileView ? '78px' : '96px',
                  boxSizing: 'border-box'
                }}
              >
                <Icon
                  className="sb-hero-watermark"
                  style={{ position: 'absolute', right: '-14px', top: '-12px', width: isMobileView ? '84px' : '110px', height: isMobileView ? '84px' : '110px', color: '#ffffff', opacity: 0.18 }}
                />
                <div
                  style={{
                    position: 'relative',
                    width: isMobileView ? '42px' : '50px',
                    height: isMobileView ? '42px' : '50px',
                    borderRadius: '15px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <Icon style={{ width: isMobileView ? '22px' : '26px', height: isMobileView ? '22px' : '26px', color: '#ffffff' }} />
                </div>
                <span style={{ position: 'relative', fontSize: '12px', fontWeight: 800, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', padding: '3px 10px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>
                  {words.length} คำ
                </span>
              </div>

              {/* BODY: ชื่อหมวด + คำตัวอย่าง (พร้อมไอคอนประจำคำ) + ลิงก์ไปต่อ */}
              <div style={{ padding: isMobileView ? '12px 12px 14px' : '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <span style={{ fontSize: isMobileView ? '16px' : '18px', fontWeight: 800, color: '#1e293b', lineHeight: 1.3 }}>{cat.name}</span>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {preview.map((word) => {
                    const WordIcon = wordIconOf(word);
                    return (
                      <span key={word} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: 700, color: '#0d47a1', backgroundColor: '#eef4fc', padding: '3px 9px 3px 7px', borderRadius: '9px', whiteSpace: 'nowrap' }}>
                        <WordIcon style={{ width: '13px', height: '13px' }} />
                        {word}
                      </span>
                    );
                  })}
                  {rest > 0 && (
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#64748b', backgroundColor: '#f1f5f9', padding: '3px 9px', borderRadius: '9px' }}>+{rest}</span>
                  )}
                </div>

                <div style={{ flex: 1 }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #eef2f7', paddingTop: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d47a1' }}>ดูคำศัพท์</span>
                  <span className="sb-hero-arrow" style={{ width: '28px', height: '28px', borderRadius: '50%', background: BLUE_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowRight style={{ width: '15px', height: '15px', color: '#ffffff' }} />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DictionaryPage;
