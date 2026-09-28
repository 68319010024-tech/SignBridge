import React from 'react';
import { BoxHeader, homeCardStyle } from '../common/BoxHeader';
import { Radar, CameraOff, WifiOff, ScanFace, CheckCircle2, CircleAlert, Hand, Loader, XCircle, Play } from 'lucide-react';

// สถานะของระบบตรวจจับ ใช้ทั้งหน้าหลักและหน้าทบทวนไวยากรณ์
// (correct/wrong/press-start มีเฉพาะหน้าทบทวนไวยากรณ์ที่มีโจทย์ให้เทียบ)
export type DetectionStatus =
  | { kind: 'camera-off' }
  | { kind: 'press-start' }
  | { kind: 'correct' }
  | { kind: 'wrong' }
  | { kind: 'connecting' }
  | { kind: 'too-close' }
  | { kind: 'detected'; word: string }
  | { kind: 'unsure' }
  | { kind: 'reading' }
  | { kind: 'ready' };

type IconType = React.ComponentType<{ style?: React.CSSProperties; className?: string }>;

const LOOK: Record<DetectionStatus['kind'], { icon: IconType; color: string; bg: string; text: string }> = {
  'camera-off': { icon: CameraOff, color: '#94a3b8', bg: '#f1f5f9', text: 'กล้องปิดอยู่' },
  'press-start': { icon: Play, color: '#64748b', bg: '#f1f5f9', text: 'กด START เพื่อเริ่ม' },
  'correct': { icon: CheckCircle2, color: '#16a34a', bg: '#dcfce7', text: 'ถูกต้อง!' },
  'wrong': { icon: XCircle, color: '#dc2626', bg: '#fee2e2', text: 'ผิด! ลองใหม่' },
  'connecting': { icon: WifiOff, color: '#94a3b8', bg: '#f1f5f9', text: 'กำลังเชื่อมต่อระบบ...' },
  'too-close': { icon: ScanFace, color: '#a16207', bg: '#fef9c3', text: 'อยู่ใกล้กล้องเกินไป' },
  'detected': { icon: CheckCircle2, color: '#16a34a', bg: '#dcfce7', text: 'ตรวจจับสำเร็จ' },
  'unsure': { icon: CircleAlert, color: '#dc2626', bg: '#fee2e2', text: 'ไม่ชัดเจน ลองใหม่' },
  'reading': { icon: Loader, color: '#1662c4', bg: '#e8f1fd', text: 'กำลังอ่านท่าทาง...' },
  'ready': { icon: Hand, color: '#0d47a1', bg: '#e8f1fd', text: 'พร้อม รอภาษามือ' },
};

// ข้อความ/สี/ไอคอนของสถานะ — ใช้ร่วมกับช่องสถานะแบบย่อบนมือถือด้วย
export const describeStatus = (status: DetectionStatus) => {
  const look = LOOK[status.kind];
  return { ...look, text: status.kind === 'detected' ? `ตรวจจับได้: ${status.word}` : look.text };
};

// ลำดับความสำคัญ: ปัญหาที่ต้องแก้ก่อน (กล้อง/การเชื่อมต่อ/ระยะ) > ผลตรวจคำตอบ (หน้าทบทวน) >
// ยังไม่กด START (หน้าทบทวน) > ผลล่าสุด > กำลังทำท่า > พร้อม
// ผลล่าสุดต้องมาก่อน "กำลังทำท่า" ไม่งั้นคนที่ทำท่าถัดไปต่อทันทีจะไม่เห็นผลเลย (โดนทับในเฟรมถัดไป)
export const resolveDetectionStatus = (s: {
  isCameraOn: boolean;
  isConnected: boolean;
  isTooClose: boolean;
  isReadingSign: boolean;
  flash: { kind: 'detected'; word: string } | { kind: 'unsure' } | null;
  answer?: 'correct' | 'wrong' | null;
  waitingForStart?: boolean;
}): DetectionStatus => {
  if (!s.isCameraOn) return { kind: 'camera-off' };
  if (!s.isConnected) return { kind: 'connecting' };
  if (s.isTooClose) return { kind: 'too-close' };
  if (s.answer) return { kind: s.answer };
  if (s.waitingForStart) return { kind: 'press-start' };
  if (s.flash) return s.flash;
  if (s.isReadingSign) return { kind: 'reading' };
  return { kind: 'ready' };
};

// height ไม่ระบุ = ยืดเต็มที่ว่าง (flex: 1) ใช้ในคอลัมน์แคบของแท็บเล็ต
// hideHeader: ไม่แสดงหัวข้อ "สถานะการตรวจจับ" (iPad แนวนอนที่คอลัมน์ขวาสูงไม่พอ) เหลือแค่ป้ายสถานะ
export const DetectionStatusBox: React.FC<{ status: DetectionStatus; height?: number; hideHeader?: boolean }> = ({ status, height, hideHeader = false }) => {
  const { icon: Icon, ...look } = describeStatus(status);
  const text = look.text;
  const compact = height !== undefined && height < 70;

  return (
    <div
      style={{
        ...homeCardStyle,
        height: height !== undefined ? `${height}px` : undefined,
        flex: height === undefined ? 1 : undefined,
        padding: compact ? '4px 12px' : '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: compact ? '3px' : '6px',
        flexShrink: 0,
        minHeight: 0,
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        @keyframes sb-status-spin { to { transform: rotate(360deg); } }
        .sb-status-spin { animation: sb-status-spin 1.2s linear infinite; }
        @keyframes sb-status-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        .sb-status-in { animation: sb-status-in 0.25s ease-out; }
      `}</style>

      {!hideHeader && <BoxHeader icon={Radar} title="สถานะการตรวจจับ" size={compact ? 'sm' : 'md'} />}

      {/* key เปลี่ยนตามสถานะ/คำ → เล่นแอนิเมชันเข้าใหม่ทุกครั้งที่สถานะเปลี่ยน */}
      <div
        key={status.kind === 'detected' ? `detected-${status.word}` : status.kind}
        className="sb-status-in"
        style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: look.bg, color: look.color, padding: '5px 12px', borderRadius: '9999px', maxWidth: '100%' }}
      >
        <Icon style={{ width: '15px', height: '15px', flexShrink: 0 }} className={status.kind === 'reading' ? 'sb-status-spin' : undefined} />
        <span style={{ fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      </div>
    </div>
  );
};

export default DetectionStatusBox;
