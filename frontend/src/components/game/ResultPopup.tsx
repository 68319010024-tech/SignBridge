import React, { useEffect, useState } from 'react';
import { Trophy, Star, RotateCcw, CircleCheck, LayoutGrid, Timer, Zap } from 'lucide-react';

interface ResultPopupProps {
  score: number;
  // คะแนนต่อข้อที่ตอบถูก (ใช้คำนวณจำนวนข้อที่ถูก)
  pointsPerCorrect: number;
  level: number;
  levelLabel: string;
  timeLimit: number;
  gradient: string;
  glow: string;
  onReplay: () => void;
  onChooseMode: () => void;
}

// จำนวนข้อที่ต้องตอบถูกเพื่อได้ 1 / 2 / 3 ดาว (ตอนนี้ใช้เกณฑ์เดียวกันทุกระดับ แยกไว้เผื่อปรับรายระดับ)
const STAR_THRESHOLDS: Record<number, [number, number, number]> = {
  1: [3, 5, 10],
  2: [3, 5, 10],
  3: [3, 5, 10],
};

const MESSAGES = ['ลองอีกครั้งนะ สู้ ๆ!', 'ทำได้ดี! ฝึกต่ออีกนิด', 'เก่งมาก! ใกล้เต็มแล้ว', 'ยอดเยี่ยมมาก!'];

const CONFETTI_COLORS = ['#fde047', '#ffffff', '#86efac', '#93c5fd', '#fca5a5', '#fdba74'];

const POPUP_STYLES = `
  @keyframes sb-pop-in { 0% { opacity: 0; transform: translateY(24px) scale(0.92); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  .sb-result-card { animation: sb-pop-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
  @keyframes sb-confetti-fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(190px) rotate(540deg); opacity: 0; } }
  .sb-confetti { position: absolute; top: 0; width: 7px; height: 11px; border-radius: 2px; animation: sb-confetti-fall 2.6s ease-in infinite; }
  @keyframes sb-trophy-ring { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.55); } 80% { box-shadow: 0 0 0 18px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }
  .sb-trophy { animation: sb-trophy-ring 1.8s ease-out infinite; }
  @keyframes sb-trophy-bob { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-5px) rotate(4deg); } }
  .sb-trophy-icon { animation: sb-trophy-bob 2.4s ease-in-out infinite; }
  @keyframes sb-star-in { 0% { opacity: 0; transform: scale(0.2) rotate(-40deg); } 70% { transform: scale(1.25) rotate(8deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
  .sb-star { opacity: 0; animation: sb-star-in 0.45s ease-out forwards; }
  .sb-result-primary { transition: transform 0.15s ease, filter 0.2s ease; }
  .sb-result-primary:hover { filter: brightness(1.07); transform: translateY(-1px); }
  .sb-result-primary:active { transform: scale(0.98); }
  .sb-result-ghost { transition: background-color 0.2s ease; }
  .sb-result-ghost:hover { background-color: #eef4fc !important; }
`;

// หน้าต่างสรุปผลเมื่อหมดเวลาในหน้าทบทวนไวยากรณ์
export const ResultPopup: React.FC<ResultPopupProps> = ({
  score,
  pointsPerCorrect,
  level,
  levelLabel,
  timeLimit,
  gradient,
  glow,
  onReplay,
  onChooseMode
}) => {
  const correct = Math.round(score / pointsPerCorrect);
  const thresholds = STAR_THRESHOLDS[level] ?? STAR_THRESHOLDS[1];
  const stars = thresholds.filter((t) => correct >= t).length;

  // นับคะแนนขึ้นจาก 0 ให้ดูมีชีวิต
  const [shownScore, setShownScore] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShownScore(Math.round(score * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const stats = [
    { icon: CircleCheck, value: `${correct} ข้อ`, label: 'ตอบถูก' },
    { icon: Timer, value: `${timeLimit} วิ`, label: 'เวลา' },
    { icon: Zap, value: levelLabel, label: 'ระดับ' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at 50% 40%, rgba(22,98,196,0.35), rgba(15,23,42,0.8))', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <style>{POPUP_STYLES}</style>

      <div className="sb-result-card" style={{ width: '100%', maxWidth: '420px', backgroundColor: '#ffffff', borderRadius: '32px', overflow: 'hidden', boxShadow: `0 30px 60px -20px rgba(15,23,42,0.55), 0 0 0 1px rgba(255,255,255,0.6)` }}>
        {/* HERO: สีประจำระดับ + พลุกระดาษ + ถ้วยรางวัล */}
        <div style={{ position: 'relative', overflow: 'hidden', background: gradient, padding: '30px 24px 26px', textAlign: 'center', color: '#ffffff' }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="sb-confetti"
              style={{ left: `${(i * 37) % 100}%`, backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length], animationDelay: `${(i % 6) * 0.35}s`, animationDuration: `${2.2 + (i % 4) * 0.35}s` }}
            />
          ))}
          <div className="sb-trophy" style={{ position: 'relative', width: '84px', height: '84px', margin: '0 auto 14px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.22)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <Trophy className="sb-trophy-icon" style={{ width: '42px', height: '42px', color: '#ffffff' }} />
          </div>
          <div style={{ position: 'relative', fontSize: '28px', fontWeight: 800, lineHeight: 1.2 }}>หมดเวลา!</div>
          <div style={{ position: 'relative', fontSize: '14px', color: 'rgba(255,255,255,0.88)', marginTop: '4px' }}>
            ระดับ{levelLabel} · {timeLimit} วินาที
          </div>
        </div>

        {/* BODY: ดาว + ข้อความ + คะแนน + สถิติ + ปุ่ม */}
        <div style={{ padding: '22px 26px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', marginTop: '-44px' }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="sb-star"
                style={{ animationDelay: `${0.35 + i * 0.18}s`, width: i === 1 ? '54px' : '44px', height: i === 1 ? '54px' : '44px', marginTop: i === 1 ? '-8px' : 0, borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: '0 8px 18px -8px rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Star style={{ width: i === 1 ? '30px' : '24px', height: i === 1 ? '30px' : '24px', color: i < stars ? '#f59e0b' : '#cbd5e1', fill: i < stars ? '#fbbf24' : '#e2e8f0' }} />
              </span>
            ))}
          </div>

          <div style={{ fontSize: '17px', fontWeight: 800, color: '#1e293b' }}>{MESSAGES[stars]}</div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '60px', fontWeight: 800, lineHeight: 1, background: gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{shownScore}</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#64748b' }}>คะแนน</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', width: '100%' }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', backgroundColor: '#f8fbff', border: '1px solid #e8f0fa', borderRadius: '16px', padding: '10px 6px' }}>
                <s.icon style={{ width: '18px', height: '18px', color: '#1662c4' }} />
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap' }}>{s.value}</span>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8' }}>{s.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '2px' }}>
            <button
              onClick={onReplay}
              className="sb-result-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '13px', borderRadius: '9999px', border: 'none', background: gradient, color: '#ffffff', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: `0 12px 24px -10px ${glow}`, fontFamily: 'inherit' }}
            >
              <RotateCcw style={{ width: '18px', height: '18px' }} />
              เล่นระดับ{levelLabel}อีกครั้ง
            </button>
            <button
              onClick={onChooseMode}
              className="sb-result-ghost"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', borderRadius: '9999px', border: '1px solid #e3ecf7', backgroundColor: '#f8fbff', color: '#0d47a1', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <LayoutGrid style={{ width: '17px', height: '17px' }} />
              เลือกระดับอื่น
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultPopup;
