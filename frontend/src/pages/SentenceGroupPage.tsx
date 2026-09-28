import React from 'react';
import { MessageSquareText, ArrowRight, Video, Hand, Languages, LayoutGrid, ListOrdered, PlayCircle, ChevronRight } from 'lucide-react';
import { useIsMobileView } from '../hooks/useIsMobileView';
import { SENTENCES, SentenceLength, SentenceType } from '../data/sentences';
import { PageHeader, DETAIL_PAGE_STYLES, detailPageContainerStyle } from '../components/detail/DetailPageParts';
import { SentenceTypeIcon } from '../components/sentence/SentenceTypeIcon';
import { BLUE_GRADIENT, BLUE_GLOW } from '../components/common/theme';

interface SentenceGroupPageProps {
  onSelectLength: (length: SentenceLength) => void;
}

const GROUPS: { length: SentenceLength; title: string; description: string }[] = [
  {
    length: 3,
    title: 'ประโยค 3 คำ',
    description: 'ประโยคพื้นฐาน ประธาน กริยา และกรรม'
  },
  {
    length: 4,
    title: 'ประโยค 4 คำ',
    description: 'ประโยคที่มีเวลา คำถาม หรือคำปฏิเสธเพิ่มเข้ามา'
  },
];

const TYPES: SentenceType[] = ['บอกเล่า', 'คำถาม', 'ปฏิเสธ'];

const STEPS = [
  { icon: LayoutGrid, text: 'เลือกกลุ่มประโยค' },
  { icon: ListOrdered, text: 'เลือกประโยคที่สนใจ' },
  { icon: PlayCircle, text: 'ดูวิดีโอ + เทียบไวยากรณ์' },
];

const GROUP_STYLES = `
  .sb-group-card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
  .sb-group-card:hover { transform: translateY(-6px); }
  .sb-group-card:active { transform: translateY(-2px) scale(0.99); }
  .sb-group-card .sb-group-cta-arrow { transition: transform 0.25s ease; }
  .sb-group-card:hover .sb-group-cta-arrow { transform: translateX(5px); }
  .sb-group-card .sb-group-watermark { transition: transform 0.5s ease, opacity 0.5s ease; }
  .sb-group-card:hover .sb-group-watermark { transform: translateY(-6px) rotate(-4deg) scale(1.05); opacity: 0.2; }
  @keyframes sb-chip-in { from { opacity: 0; transform: translateY(8px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .sb-group-chip { opacity: 0; animation: sb-chip-in 0.4s ease-out forwards; }
  @keyframes sb-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .sb-group-bubble { animation: sb-float 6s ease-in-out infinite; }
`;

// หน้าแรกของเมนู "ตัวอย่างประโยค" — เลือกกลุ่มประโยค 3 คำ หรือ 4 คำ ก่อนแล้วค่อยเลือกประโยค
export const SentenceGroupPage: React.FC<SentenceGroupPageProps> = ({ onSelectLength }) => {
  const isMobileView = useIsMobileView();
  const total = SENTENCES[3].length + SENTENCES[4].length;

  return (
    <div className="sb-detail-fade" style={detailPageContainerStyle(isMobileView, false)}>
      <style>{DETAIL_PAGE_STYLES + GROUP_STYLES}</style>

      <PageHeader
        badgeIcon={MessageSquareText}
        badgeText="ตัวอย่างประโยคภาษามือ"
        title="เลือกกลุ่มประโยค"
        subtitle={`ทั้งหมด ${total} ประโยค · ดูวิดีโอพร้อมเทียบไวยากรณ์ภาษามือกับภาษาไทย`}
        isMobileView={isMobileView}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobileView ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: isMobileView ? '16px' : '28px',
          alignSelf: 'center',
          width: '100%',
          maxWidth: '1040px'
        }}
      >
        {GROUPS.map((g) => {
          const items = SENTENCES[g.length];
          const example = items[0];
          return (
            <button
              key={g.length}
              className="sb-group-card"
              onClick={() => onSelectLength(g.length)}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 22px 44px -16px ${BLUE_GLOW}, 0 0 0 2px ${BLUE_GLOW}`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 10px 30px -14px rgba(13,71,161,0.22)'; }}
              style={{
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                border: '1px solid #e3ecf7',
                borderRadius: '28px',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                boxShadow: '0 10px 30px -14px rgba(13,71,161,0.22)',
                textAlign: 'left',
                fontFamily: 'inherit'
              }}
            >
              {/* HERO: พื้นไล่สี + เลขใหญ่เป็นลายน้ำ + ตัวอย่างลำดับคำภาษามือที่ค่อย ๆ โผล่ทีละคำ */}
              <div style={{ position: 'relative', background: BLUE_GRADIENT, padding: isMobileView ? '20px 20px 18px' : '26px 28px 24px', color: '#ffffff', overflow: 'hidden' }}>
                <div className="sb-group-bubble" style={{ position: 'absolute', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', top: '-70px', right: '60px' }} />
                <div className="sb-group-bubble" style={{ position: 'absolute', width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', bottom: '-30px', left: '40%', animationDelay: '-3s' }} />
                <span
                  className="sb-group-watermark"
                  style={{ position: 'absolute', right: '18px', top: '-28px', fontSize: isMobileView ? '130px' : '170px', fontWeight: 800, lineHeight: 1, color: '#ffffff', opacity: 0.14, pointerEvents: 'none' }}
                >
                  {g.length}
                </span>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <MessageSquareText style={{ width: '20px', height: '20px', color: '#ffffff' }} />
                  </div>
                  <span style={{ fontSize: isMobileView ? '22px' : '26px', fontWeight: 800 }}>{g.title}</span>
                </div>
                <div style={{ position: 'relative', fontSize: '14px', color: 'rgba(255,255,255,0.85)', marginBottom: '16px' }}>{g.description}</div>

                <div style={{ position: 'relative', fontSize: '11.5px', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Hand style={{ width: '13px', height: '13px' }} />
                  ตัวอย่างลำดับภาษามือ
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {example.tsl.map((x, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <ChevronRight className="sb-group-chip" style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.7)', animationDelay: `${0.15 + i * 0.18 - 0.09}s` }} />}
                      <span
                        className="sb-group-chip"
                        style={{ animationDelay: `${0.15 + i * 0.18}s`, fontSize: '15px', fontWeight: 800, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)', padding: '5px 13px', borderRadius: '11px', backdropFilter: 'blur(4px)' }}
                      >
                        {x.word}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* BODY: จำนวนประโยคแยกตามรูปแบบ + จุดเด่น + ปุ่มไปต่อ */}
              <div style={{ padding: isMobileView ? '18px 20px 20px' : '22px 28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: isMobileView ? '8px' : '10px' }}>
                  {TYPES.map((t) => (
                    // มือถือ: ไอคอนอยู่บนตัวเลข (3 ช่องเรียงแนวนอนแบบไอคอนข้างตัวเลขกว้างไม่พอ)
                    <div key={t} style={{ display: 'flex', flexDirection: isMobileView ? 'column' : 'row', alignItems: 'center', gap: isMobileView ? '6px' : '10px', backgroundColor: '#f8fbff', border: '1px solid #e8f0fa', borderRadius: '16px', padding: isMobileView ? '10px 6px' : '10px 12px', minWidth: 0 }}>
                      <SentenceTypeIcon type={t} size={isMobileView ? 32 : 36} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobileView ? 'center' : 'flex-start', minWidth: 0 }}>
                        <span style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', lineHeight: 1.1 }}>{items.filter((s) => s.type === t).length}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{t}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Video style={{ width: '16px', height: '16px', color: '#1662c4' }} />
                    วิดีโอ {items.length} คลิป
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Languages style={{ width: '16px', height: '16px', color: '#1662c4' }} />
                    เทียบไวยากรณ์ไทย ↔ ภาษามือ
                  </span>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BLUE_GRADIENT, color: '#ffffff', padding: '12px 14px 12px 20px', borderRadius: '9999px', boxShadow: `0 10px 20px -10px ${BLUE_GLOW}` }}
                >
                  <span style={{ fontSize: '15px', fontWeight: 800 }}>ดูทั้ง {items.length} ประโยค</span>
                  <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowRight className="sb-group-cta-arrow" style={{ width: '18px', height: '18px' }} />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* วิธีใช้งาน 3 ขั้นตอน */}
      <div
        style={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: '1040px',
          marginTop: isMobileView ? '18px' : '26px',
          display: 'flex',
          flexDirection: isMobileView ? 'column' : 'row',
          alignItems: isMobileView ? 'stretch' : 'center',
          justifyContent: 'center',
          gap: isMobileView ? '8px' : '14px'
        }}
      >
        {STEPS.map((step, i) => (
          <React.Fragment key={step.text}>
            {i > 0 && !isMobileView && <ChevronRight style={{ width: '18px', height: '18px', color: '#94a3b8', flexShrink: 0 }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(255,255,255,0.7)', border: '1px solid #e3ecf7', borderRadius: '9999px', padding: '6px 16px 6px 6px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#e8f1fd', color: '#0d47a1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <step.icon style={{ width: '15px', height: '15px' }} />
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                <span style={{ color: '#0d47a1' }}>{i + 1}.</span> {step.text}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default SentenceGroupPage;
