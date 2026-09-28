import React from 'react';
import { ListOrdered, ArrowRight, ChevronRight, Hand } from 'lucide-react';
import { useIsMobileView } from '../hooks/useIsMobileView';
import { SENTENCES, SentenceLength, sentenceText, SENTENCE_TYPE_STYLE } from '../data/sentences';
import { PageHeader, DETAIL_PAGE_STYLES, detailPageContainerStyle } from '../components/detail/DetailPageParts';
import { SentenceTypeIcon } from '../components/sentence/SentenceTypeIcon';
import { BLUE_GRADIENT, CARD_SHADOW, HERO_CARD_STYLES } from '../components/common/theme';

interface SentenceListPageProps {
  length: SentenceLength;
  onBack: () => void;
  onSelectSentence: (id: string) => void;
}

// รายการประโยคในกลุ่มที่เลือก — หัวการ์ดไล่สีแสดงประโยคภาษาไทย, ตัวการ์ดแสดงลำดับภาษามือและรูปแบบประโยค
export const SentenceListPage: React.FC<SentenceListPageProps> = ({ length, onBack, onSelectSentence }) => {
  const isMobileView = useIsMobileView();
  const isTabletView = useIsMobileView(1366);
  const columns = isMobileView ? 1 : isTabletView ? 2 : 3;
  const items = SENTENCES[length];

  return (
    <div className="sb-detail-fade" style={detailPageContainerStyle(isMobileView, false)}>
      <style>{DETAIL_PAGE_STYLES + HERO_CARD_STYLES}</style>

      <PageHeader
        onBack={onBack}
        badgeIcon={ListOrdered}
        badgeText="ตัวอย่างประโยค"
        title={`ประโยค ${length} คำ`}
        subtitle={`ทั้งหมด ${items.length} ประโยค · เรียงตาม บอกเล่า → คำถาม → ปฏิเสธ`}
        isMobileView={isMobileView}
      />

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: isMobileView ? '14px' : '20px', paddingBottom: '8px' }}>
        {items.map((s, i) => {
          const typeStyle = SENTENCE_TYPE_STYLE[s.type];
          return (
            <button
              key={s.id}
              className="sb-hero-card sb-detail-card"
              onClick={() => onSelectSentence(s.id)}
              style={{
                animationDelay: `${i * 0.04}s`,
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
              {/* HERO: ลำดับประโยค + ประโยคภาษาไทย + เลขลำดับใหญ่จาง ๆ เป็นลายน้ำ */}
              <div style={{ position: 'relative', overflow: 'hidden', background: BLUE_GRADIENT, padding: isMobileView ? '16px 18px' : '18px 20px', color: '#ffffff' }}>
                <div className="sb-hero-bubble" style={{ position: 'absolute', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', top: '-50px', right: '70px', animationDelay: `${-i}s` }} />
                <span
                  className="sb-hero-watermark"
                  style={{ position: 'absolute', right: '14px', top: '-20px', fontSize: '110px', fontWeight: 800, lineHeight: 1, color: '#ffffff', opacity: 0.14, pointerEvents: 'none' }}
                >
                  {i + 1}
                </span>
                <span style={{ position: 'relative', display: 'inline-block', fontSize: '11.5px', fontWeight: 800, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', padding: '2px 10px', borderRadius: '9999px', marginBottom: '10px' }}>
                  ประโยคที่ {i + 1}
                </span>
                <div style={{ position: 'relative', fontSize: isMobileView ? '20px' : '22px', fontWeight: 800, lineHeight: 1.3 }}>
                  {sentenceText(s.thai)}
                </div>
              </div>

              {/* BODY: ลำดับคำภาษามือ + รูปแบบประโยค (ไอคอน) + ลิงก์ไปต่อ */}
              <div style={{ padding: isMobileView ? '14px 16px 16px' : '16px 20px 18px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                      <Hand style={{ width: '12px', height: '12px' }} />
                      ลำดับภาษามือ
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {s.tsl.map((t, k) => (
                        <React.Fragment key={k}>
                          {k > 0 && <ChevronRight style={{ width: '13px', height: '13px', color: '#94a3b8' }} />}
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d47a1', backgroundColor: '#eef4fc', padding: '3px 10px', borderRadius: '8px' }}>{t.word}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <SentenceTypeIcon type={s.type} size={isMobileView ? 48 : 54} />
                </div>

                <div style={{ flex: 1 }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #eef2f7', paddingTop: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: typeStyle.fg, backgroundColor: typeStyle.bg, padding: '3px 12px', borderRadius: '9999px' }}>
                    ประโยค{s.type}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#0d47a1' }}>
                    ดูวิดีโอและไวยากรณ์
                    <span className="sb-hero-arrow" style={{ width: '28px', height: '28px', borderRadius: '50%', background: BLUE_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowRight style={{ width: '15px', height: '15px', color: '#ffffff' }} />
                    </span>
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

export default SentenceListPage;
