import React from 'react';
import { Hash, BookOpen, ArrowRight, Tag, MessageSquareText } from 'lucide-react';
import { wordsData, wordIconOf, wordTypeOf } from '../data/words';
import { SENTENCES } from '../data/sentences';
import { useIsMobileView } from '../hooks/useIsMobileView';
import { PageHeader, DETAIL_PAGE_STYLES, detailPageContainerStyle } from '../components/detail/DetailPageParts';
import { BLUE_GRADIENT, CARD_SHADOW, HERO_CARD_STYLES } from '../components/common/theme';

interface CategoryDetailPageProps {
  categoryName: string;
  onBack: () => void;
  onSelectWord?: (wordName: string) => void;
}

// จำนวนตัวอย่างประโยคที่มีคำนี้ (เทียบทั้งลำดับภาษาไทยและภาษามือ)
const sentenceCountOf = (word: string) =>
  [...SENTENCES[3], ...SENTENCES[4]].filter((s) => [...s.thai, ...s.tsl].some((x) => x.word === word)).length;

export const CategoryDetailPage: React.FC<CategoryDetailPageProps> = ({
  categoryName,
  onBack,
  onSelectWord,
}) => {
  const isMobileView = useIsMobileView();
  // แท็บเล็ต (เช่น iPad แนวนอน) กว้างไม่พอ 5 คอลัมน์ จึงลดเหลือ 3 ส่วน desktop แถวละ 5 แล้วเลื่อนดูแถวถัดไป
  const isTabletView = useIsMobileView(1366);
  const gridColumns = isMobileView ? 2 : isTabletView ? 3 : 5;
  const words = wordsData[categoryName] || [];

  return (
    <div className="sb-detail-fade" style={detailPageContainerStyle(isMobileView, false)}>
      <style>{DETAIL_PAGE_STYLES + HERO_CARD_STYLES}</style>

      <PageHeader
        onBack={onBack}
        badgeIcon={Hash}
        badgeText="หมวดหมู่"
        title={categoryName}
        subtitle={`ทั้งหมด ${words.length} คำ · เลือกคำเพื่อดูวิดีโอท่าภาษามือ`}
        isMobileView={isMobileView}
      />

      {/* WORD GRID — การ์ดสูงตามเนื้อหา แถวละ 5 (desktop) ส่วนแถวถัดไปให้หน้าเลื่อนลงไปดู */}
      {words.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`, gap: isMobileView ? '12px' : '20px', paddingBottom: '8px' }}>
          {words.map((word, index) => {
            const WordIcon = wordIconOf(word);
            const usedIn = sentenceCountOf(word);
            return (
              <button
                key={word}
                className="sb-hero-card sb-word-card"
                onClick={() => onSelectWord && onSelectWord(word)}
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
                {/* HERO: ไอคอนคำในกล่องกระจก + ไอคอนใหญ่จาง ๆ เป็นลายน้ำ + ลำดับคำในหมวด */}
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
                  <WordIcon
                    className="sb-hero-watermark"
                    style={{ position: 'absolute', right: '-14px', top: '-12px', width: isMobileView ? '84px' : '110px', height: isMobileView ? '84px' : '110px', color: '#ffffff', opacity: 0.18 }}
                  />
                  <div style={{ position: 'relative', width: isMobileView ? '42px' : '50px', height: isMobileView ? '42px' : '50px', borderRadius: '15px', backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <WordIcon style={{ width: isMobileView ? '22px' : '26px', height: isMobileView ? '22px' : '26px', color: '#ffffff' }} />
                  </div>
                  <span style={{ position: 'relative', fontSize: '12px', fontWeight: 800, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', padding: '3px 10px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>
                    คำที่ {index + 1}
                  </span>
                </div>

                {/* BODY: ชื่อคำ + ชนิดของคำ + จำนวนตัวอย่างประโยค + ลิงก์ไปต่อ */}
                <div style={{ padding: isMobileView ? '12px 12px 14px' : '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  <span style={{ fontSize: isMobileView ? '18px' : '22px', fontWeight: 800, color: '#1e293b', lineHeight: 1.25 }}>{word}</span>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#0d47a1', backgroundColor: '#eef4fc', padding: '3px 9px 3px 7px', borderRadius: '9px', whiteSpace: 'nowrap' }}>
                      <Tag style={{ width: '12px', height: '12px' }} />
                      {wordTypeOf(word)}
                    </span>
                    {usedIn > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#475569', backgroundColor: '#f1f5f9', padding: '3px 9px 3px 7px', borderRadius: '9px', whiteSpace: 'nowrap' }}>
                        <MessageSquareText style={{ width: '12px', height: '12px' }} />
                        {usedIn} ประโยค
                      </span>
                    )}
                  </div>

                  <div style={{ flex: 1 }} />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #eef2f7', paddingTop: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d47a1' }}>ดูท่าภาษามือ</span>
                    <span className="sb-hero-arrow" style={{ width: '28px', height: '28px', borderRadius: '50%', background: BLUE_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowRight style={{ width: '15px', height: '15px', color: '#ffffff' }} />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
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
