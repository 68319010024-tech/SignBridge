import React from 'react';
import { SpellCheck, Folder, Tag, MessageSquareText, ChevronRight } from 'lucide-react';
import { useIsMobileView } from '../hooks/useIsMobileView';
import { SENTENCES, SentenceLength, sentenceText } from '../data/sentences';
import { wordTypeOf } from '../data/words';
import {
  PageHeader,
  VideoBox,
  VideoDetailLayout,
  SectionTitle,
  Divider,
  Chip,
  DETAIL_PAGE_STYLES,
  detailPageContainerStyle
} from '../components/detail/DetailPageParts';
import { SentenceTypeIcon } from '../components/sentence/SentenceTypeIcon';

interface WordDetailPageProps {
  wordName: string;
  categoryName: string;
  onBack: () => void;
  // กดตัวอย่างประโยคที่ใช้คำนี้ → ไปหน้ารายละเอียดประโยคนั้นในเมนูตัวอย่างประโยค
  onOpenSentence?: (length: SentenceLength, sentenceId: string) => void;
}



export const WordDetailPage: React.FC<WordDetailPageProps> = ({
  wordName,
  categoryName,
  onBack,
  onOpenSentence,
}) => {
  const isMobileView = useIsMobileView();
  // วิดีโอกับรายละเอียดเรียงลงมาเฉพาะจอที่ใช้ layout มือถือ (≤1024px) — แท็บเล็ตแนวนอนวางคู่กันแบบ PC
  const isCompactView = isMobileView;
  const isTabletView = useIsMobileView(1366);

  // ดึงไฟล์วิดีโอใบแรกในโฟลเดอร์คำศัพท์ — ใช้ path แบบ relative (ไม่ใส่ "/" นำหน้า) ให้สอดคล้องกับ
  // base: './' ใน vite.config.ts เพราะ path ที่ขึ้นต้นด้วย "/" จะอ้างอิงจาก domain root เสมอ ซึ่งพัง
  // ตอนแอปถูกเสิร์ฟใต้ subpath อย่าง /ai/ บนเซิร์ฟเวอร์ที่ domain root ชี้ไปที่แอปอื่น
  const videoSrc = encodeURI(`video/${categoryName}/${wordName}/${wordName}-1.mp4`);

  // ดึงชนิดของคำจาก Mapping
  const wordType = wordTypeOf(wordName);

  // ตัวอย่างประโยคที่มีคำนี้ (เทียบทั้งลำดับภาษาไทยและภาษามือ เช่น "ที่ไหน" มีเฉพาะฝั่งภาษามือ)
  const relatedSentences = ([3, 4] as SentenceLength[]).flatMap((length) =>
    SENTENCES[length]
      .filter((s) => [...s.thai, ...s.tsl].some((x) => x.word === wordName))
      .map((s) => ({ length, sentence: s }))
  );

  return (
    <div className="sb-detail-fade" style={detailPageContainerStyle(isMobileView, !isCompactView, isTabletView)}>
      <style>{DETAIL_PAGE_STYLES}</style>

      <PageHeader
        onBack={onBack}
        badgeIcon={SpellCheck}
        badgeText="รายละเอียดคำศัพท์"
        title={wordName}
        isMobileView={isMobileView}
        inline={isTabletView}
      />

      <VideoDetailLayout
        isMobileView={isMobileView}
        isCompactView={isCompactView}
        fillHeight={isTabletView}
        video={<VideoBox src={videoSrc} label={categoryName} isCompactView={isCompactView} fill={isTabletView} />}
      >
        <div>
          <SectionTitle icon={SpellCheck} title="ชื่อคำศัพท์" />
          <Chip solid size="lg">{wordName}</Chip>
        </div>

        <Divider />

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px' }}>
            <SectionTitle icon={Folder} title="หมวดหมู่" />
            <Chip>{categoryName}</Chip>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <SectionTitle icon={Tag} title="ชนิดของคำ" />
            <Chip>{wordType}</Chip>
          </div>
        </div>

        <Divider />

        <div>
          <SectionTitle icon={MessageSquareText} title="ตัวอย่างประโยคที่ใช้คำนี้" />
          {relatedSentences.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {relatedSentences.map(({ length, sentence }) => (
                <button
                  key={`${length}-${sentence.id}`}
                  className="sb-detail-link"
                  onClick={() => onOpenSentence && onOpenSentence(length, sentence.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '8px 12px 8px 8px',
                    backgroundColor: '#f8fbff',
                    border: '1px solid #e3ecf7',
                    borderRadius: '14px',
                    cursor: onOpenSentence ? 'pointer' : 'default',
                    textAlign: 'left',
                    fontFamily: 'inherit'
                  }}
                >
                  <SentenceTypeIcon type={sentence.type} size={34} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                    {sentenceText(sentence.thai)}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{length} คำ</span>
                  {onOpenSentence && <ChevronRight style={{ width: '16px', height: '16px', color: '#1662c4', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>ยังไม่มีตัวอย่างประโยคที่ใช้คำนี้</span>
          )}
        </div>
      </VideoDetailLayout>
    </div>
  );
};

export default WordDetailPage;
