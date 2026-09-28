import React from 'react';
import { Hand, Languages, MessageSquareText, Lightbulb } from 'lucide-react';
import { useIsMobileView } from '../hooks/useIsMobileView';
import {
  SENTENCES,
  SentenceLength,
  SentenceWord,
  sentenceText,
  sentenceVideoSrc,
  grammarPattern,
  SENTENCE_TYPE_STYLE
} from '../data/sentences';
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

interface SentenceDetailPageProps {
  length: SentenceLength;
  sentenceId: string;
  onBack: () => void;
}

// ลำดับคำเป็นกล่องต่อกันพร้อมหน้าที่ของคำใต้แต่ละกล่อง (เช่น ฉัน/ประธาน › อาหาร/กรรม › กิน/กริยา)
const WordOrder: React.FC<{ words: SentenceWord[]; solid?: boolean }> = ({ words, solid }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', flexWrap: 'wrap' }}>
    {words.map((x, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span style={{ color: '#94a3b8', fontSize: '18px', fontWeight: 700, lineHeight: '38px' }}>›</span>}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <Chip solid={solid}>{x.word}</Chip>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>{x.role}</span>
        </div>
      </React.Fragment>
    ))}
  </div>
);

export const SentenceDetailPage: React.FC<SentenceDetailPageProps> = ({ length, sentenceId, onBack }) => {
  const isMobileView = useIsMobileView();
  const isCompactView = useIsMobileView(1366);

  const sentence = SENTENCES[length].find((s) => s.id === sentenceId);
  if (!sentence) return null;
  const typeStyle = SENTENCE_TYPE_STYLE[sentence.type];

  return (
    <div className="sb-detail-fade" style={detailPageContainerStyle(isMobileView, !isCompactView)}>
      <style>{DETAIL_PAGE_STYLES}</style>

      <PageHeader
        onBack={onBack}
        badgeIcon={MessageSquareText}
        badgeText={`ประโยค ${length} คำ`}
        title={sentenceText(sentence.thai)}
        isMobileView={isMobileView}
      />

      <VideoDetailLayout
        isMobileView={isMobileView}
        isCompactView={isCompactView}
        video={<VideoBox src={sentenceVideoSrc(length, sentence)} label={`ประโยค${sentence.type}`} isCompactView={isCompactView} />}
      >
        <div>
          <SectionTitle icon={Hand} title="ไวยากรณ์ภาษามือ" hint={grammarPattern(sentence.tsl)} />
          <WordOrder words={sentence.tsl} solid />
        </div>

        <Divider />

        <div>
          <SectionTitle icon={Languages} title="ไวยากรณ์ภาษาไทย" hint={grammarPattern(sentence.thai)} />
          <WordOrder words={sentence.thai} />
        </div>

        <Divider />

        <div>
          <SectionTitle icon={MessageSquareText} title="รูปแบบประโยค" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SentenceTypeIcon type={sentence.type} size={46} />
            <span style={{ fontSize: '16px', fontWeight: 800, color: typeStyle.fg, backgroundColor: typeStyle.bg, padding: '6px 16px', borderRadius: '9999px' }}>
              ประโยค{sentence.type}
            </span>
          </div>
        </div>

        {/* ดันกล่องคำอธิบายลงไปชิดล่าง ให้กล่องที่สูงเท่าวิดีโอดูเต็ม ไม่มีที่ว่างก้อนใหญ่ด้านล่าง */}
        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', backgroundColor: '#f6faff', border: '1px solid #e3ecf7', borderRadius: '14px', padding: '12px 14px', flexShrink: 0 }}>
          <Lightbulb style={{ width: '18px', height: '18px', color: '#1662c4', flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155', lineHeight: 1.55 }}>{sentence.note}</span>
        </div>
      </VideoDetailLayout>
    </div>
  );
};

export default SentenceDetailPage;
