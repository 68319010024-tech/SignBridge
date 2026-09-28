import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  Play,
  RefreshCw,
  Award,
  Zap,
  Camera,
  Flag,
  Hand,
  Timer,
  CloudFog,
  Bone,
  ArrowRight,
  ChevronRight,
  Type,
  ListOrdered,
  Shuffle,
  Aperture
} from 'lucide-react';
import { resolveWsUrl } from '../services/wsConfig';
import { useIsMobileView, useIsShortView, useIsTabletPortrait, useIsTabletLandscape, useIsPhoneLandscape } from '../hooks/useIsMobileView';
import { PageBadge } from '../components/common/PageBadge';
import { MobileControlButton } from '../components/common/MobileControlButton';
import TooCloseWarning from '../components/webcam/TooCloseWarning';
import { drawBlurredImage } from '../components/webcam/drawBlurredImage';
import DetectionStatusBox, { resolveDetectionStatus, describeStatus } from '../components/webcam/DetectionStatusBox';
import CameraControlBox from '../components/webcam/CameraControlBox';
import ResultPopup from '../components/game/ResultPopup';
import { BoxHeader, homeCardStyle, homeWatermarkStyle } from '../components/common/BoxHeader';
import { BLUE_GRADIENT } from '../components/common/theme';

const WS_URL = resolveWsUrl();
const FRAME_SEND_INTERVAL_MS = 100;
// ด้านยาวสุดของภาพที่ส่งไป server — ต้องตรงกับ MAX_PROCESS_DIM ใน ai-engine/src/server.py
const MAX_SEND_DIM = 800;

type Difficulty = 'easy' | 'medium' | 'hard';
type WsStatus = 'connecting' | 'connected' | 'disconnected';

interface SentenceQuestion {
  id: number;
  wordOnly?: string;
  thaiGrammar: { word: string; num: number; color: string }[];
  signGrammar: { word: string; num: number; color: string }[];
}

interface PredictionMessage {
  type: 'prediction';
  word: string;
  confidence: number;
  prediction_id: number;
  too_close?: boolean;
  is_recording?: boolean;
  rejected_id?: number;
  tsl_sequence: string[];
  sentence: string;
  frame: string | null;
}

// ชุดคำศัพท์เดี่ยว 49 คำจาก Dataset MD
const EASY_WORDS_49 = [
  'ร้อน', 'สบายดี', 'หนาว', 'หิว', 'อันตราย', 'กิน', 'ชอบ', 'ต้องการ', 
  'ทำ', 'ไป', 'มา', 'เรียน', 'หยุด', 'ทำไม', 'ที่ไหน', 'เท่าไหร่', 
  'เมื่อไหร่', 'อะไร', 'เขา', 'คุณ', 'ฉัน', 'คน', 'คนขับรถ', 'ครู', 
  'ตำรวจ', 'เพื่อน', 'หมอ', 'ขอโทษ', 'ขอบคุณ', 'สวัสดี', 'วันนี้', 'ตลาด', 
  'บ้าน', 'โรงพยาบาล', 'โรงเรียน', 'ห้องน้ำ', 'เงิน', 'โทรศัพท์', 'น้ำ', 'รถยนต์', 
  'หนังสือ', 'อาหาร', 'ใช่', 'ไม่', 'ไม่ใช่', 'ไม่ได้', 'ไม่เอา', 'ยัง', 'ห้าม'
];

// คำที่โมเดลรวมเป็นคำเดียวกัน (ท่าเหมือนกัน ต่างกันแค่บริบท) — โจทย์คำซ้ายยอมรับคำตอบคำขวา
// ต้องตรงกับ LABEL_MERGE ใน ai-engine/src/02_train_model.py
const WORD_ALIASES: Record<string, string> = {
  'ไม่ใช่': 'ไม่',
};

const isSameSign = (detected: string, expected: string): boolean =>
  detected === expected || WORD_ALIASES[expected] === detected;

// ฟังก์ชันสำหรับสุ่มตำแหน่ง Array
const shuffleArray = <T,>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// สร้าง List คำศัพท์สำหรับโหมดง่ายจากการสุ่ม 49 คำ
const generateEasyQuestions = (): SentenceQuestion[] => {
  return shuffleArray(EASY_WORDS_49).map((word, idx) => ({
    id: idx + 1,
    wordOnly: word,
    thaiGrammar: [{ word, num: 1, color: '#0284c7' }],
    signGrammar: [{ word, num: 1, color: '#0284c7' }]
  }));
};

// ชุดประโยค 3 คำ (10 ประโยค) และ 4 คำ (10 ประโยค) จากไฟล์ MD
const baseQuestionPool: Record<Difficulty, SentenceQuestion[]> = {
  easy: generateEasyQuestions(),
  medium: [
    {
      id: 1,
      thaiGrammar: [{ word: 'ฉัน', num: 1, color: '#7c3aed' }, { word: 'กิน', num: 2, color: '#f97316' }, { word: 'อาหาร', num: 3, color: '#0284c7' }],
      signGrammar: [{ word: 'ฉัน', num: 1, color: '#7c3aed' }, { word: 'อาหาร', num: 2, color: '#0284c7' }, { word: 'กิน', num: 3, color: '#f97316' }]
    },
    {
      id: 2,
      thaiGrammar: [{ word: 'เขา', num: 1, color: '#7c3aed' }, { word: 'ชอบ', num: 2, color: '#f97316' }, { word: 'ครู', num: 3, color: '#0284c7' }],
      signGrammar: [{ word: 'เขา', num: 1, color: '#7c3aed' }, { word: 'ครู', num: 2, color: '#0284c7' }, { word: 'ชอบ', num: 3, color: '#f97316' }]
    },
    {
      id: 3,
      // เดิม thaiGrammar ใช้ "ไหน" แต่ signGrammar ใช้ "ที่ไหน" (คำละคำ) ทำให้หาลำดับภาษามือ
      // ของคำนี้ไม่เจอ (แสดงเลข (0)) แก้ให้ใช้คำเดียวกันทั้งสองฝั่ง
      thaiGrammar: [{ word: 'คุณ', num: 1, color: '#7c3aed' }, { word: 'ไป', num: 2, color: '#f97316' }, { word: 'ที่ไหน', num: 3, color: '#10b981' }],
      signGrammar: [{ word: 'คุณ', num: 1, color: '#7c3aed' }, { word: 'ไป', num: 2, color: '#f97316' }, { word: 'ที่ไหน', num: 3, color: '#10b981' }]
    },
    {
      id: 4,
      thaiGrammar: [{ word: 'หมอ', num: 1, color: '#7c3aed' }, { word: 'มา', num: 2, color: '#f97316' }, { word: 'บ้าน', num: 3, color: '#0284c7' }],
      signGrammar: [{ word: 'หมอ', num: 1, color: '#7c3aed' }, { word: 'บ้าน', num: 2, color: '#0284c7' }, { word: 'มา', num: 3, color: '#f97316' }]
    },
    {
      id: 5,
      thaiGrammar: [{ word: 'ฉัน', num: 1, color: '#7c3aed' }, { word: 'หิว', num: 2, color: '#f97316' }, { word: 'น้ำ', num: 3, color: '#0284c7' }],
      signGrammar: [{ word: 'ฉัน', num: 1, color: '#7c3aed' }, { word: 'น้ำ', num: 2, color: '#0284c7' }, { word: 'หิว', num: 3, color: '#f97316' }]
    },
    {
      id: 6,
      thaiGrammar: [{ word: 'เพื่อน', num: 1, color: '#7c3aed' }, { word: 'ไป', num: 2, color: '#f97316' }, { word: 'ตลาด', num: 3, color: '#0284c7' }],
      signGrammar: [{ word: 'เพื่อน', num: 1, color: '#7c3aed' }, { word: 'ตลาด', num: 2, color: '#0284c7' }, { word: 'ไป', num: 3, color: '#f97316' }]
    },
    {
      id: 7,
      thaiGrammar: [{ word: 'ตำรวจ', num: 1, color: '#7c3aed' }, { word: 'มา', num: 2, color: '#f97316' }, { word: 'โรงเรียน', num: 3, color: '#0284c7' }],
      signGrammar: [{ word: 'ตำรวจ', num: 1, color: '#7c3aed' }, { word: 'โรงเรียน', num: 2, color: '#0284c7' }, { word: 'มา', num: 3, color: '#f97316' }]
    },
    {
      id: 8,
      thaiGrammar: [{ word: 'คุณ', num: 1, color: '#7c3aed' }, { word: 'ต้องการ', num: 2, color: '#f97316' }, { word: 'อะไร', num: 3, color: '#10b981' }],
      signGrammar: [{ word: 'คุณ', num: 1, color: '#7c3aed' }, { word: 'ต้องการ', num: 2, color: '#f97316' }, { word: 'อะไร', num: 3, color: '#10b981' }]
    },
    {
      id: 9,
      // เดิมใช้ "อ่าน" ซึ่งไม่ได้อยู่ในชุดคำศัพท์ 49 คำที่โมเดลถูกเทรน (ตรวจจับไม่ได้จริง)
      // เปลี่ยนเป็น "ชอบ" แทนเพื่อให้ยังคงเล่นได้ด้วยคำที่โมเดลรู้จัก
      thaiGrammar: [{ word: 'เขา', num: 1, color: '#7c3aed' }, { word: 'ชอบ', num: 2, color: '#f97316' }, { word: 'หนังสือ', num: 3, color: '#0284c7' }],
      signGrammar: [{ word: 'เขา', num: 1, color: '#7c3aed' }, { word: 'หนังสือ', num: 2, color: '#0284c7' }, { word: 'ชอบ', num: 3, color: '#f97316' }]
    },
    {
      id: 10,
      thaiGrammar: [{ word: 'คนขับรถ', num: 1, color: '#7c3aed' }, { word: 'หยุด', num: 2, color: '#f97316' }, { word: 'รถยนต์', num: 3, color: '#0284c7' }],
      signGrammar: [{ word: 'คนขับรถ', num: 1, color: '#7c3aed' }, { word: 'รถยนต์', num: 2, color: '#0284c7' }, { word: 'หยุด', num: 3, color: '#f97316' }]
    }
  ],
  hard: [
    {
      id: 1,
      thaiGrammar: [{ word: 'ฉัน', num: 1, color: '#7c3aed' }, { word: 'ไป', num: 2, color: '#f97316' }, { word: 'โรงเรียน', num: 3, color: '#0284c7' }, { word: 'วันนี้', num: 4, color: '#10b981' }],
      signGrammar: [{ word: 'วันนี้', num: 1, color: '#10b981' }, { word: 'ฉัน', num: 2, color: '#7c3aed' }, { word: 'โรงเรียน', num: 3, color: '#0284c7' }, { word: 'ไป', num: 4, color: '#f97316' }]
    },
    {
      id: 2,
      // เดิมใช้ "เอา" แยกจาก "ไม่" ซึ่ง "เอา" เดี่ยว ๆ ไม่ได้อยู่ในชุดคำศัพท์ที่เทรน
      // (มีแต่คำรวม "ไม่เอา") เปลี่ยนเป็น "ชอบ" แทนเพื่อให้ทุกคำตรวจจับได้จริง
      thaiGrammar: [{ word: 'เขา', num: 1, color: '#7c3aed' }, { word: 'ไม่', num: 2, color: '#ef4444' }, { word: 'ชอบ', num: 3, color: '#f97316' }, { word: 'โทรศัพท์', num: 4, color: '#0284c7' }],
      signGrammar: [{ word: 'เขา', num: 1, color: '#7c3aed' }, { word: 'โทรศัพท์', num: 2, color: '#0284c7' }, { word: 'ชอบ', num: 3, color: '#f97316' }, { word: 'ไม่', num: 4, color: '#ef4444' }]
    },
    {
      id: 3,
      thaiGrammar: [{ word: 'คุณ', num: 1, color: '#7c3aed' }, { word: 'ชอบ', num: 2, color: '#f97316' }, { word: 'กิน', num: 3, color: '#f97316' }, { word: 'อะไร', num: 4, color: '#10b981' }],
      signGrammar: [{ word: 'คุณ', num: 1, color: '#7c3aed' }, { word: 'กิน', num: 2, color: '#f97316' }, { word: 'ชอบ', num: 3, color: '#f97316' }, { word: 'อะไร', num: 4, color: '#10b981' }]
    },
    {
      id: 4,
      thaiGrammar: [{ word: 'วันนี้', num: 1, color: '#10b981' }, { word: 'เพื่อน', num: 2, color: '#7c3aed' }, { word: 'มา', num: 3, color: '#f97316' }, { word: 'บ้าน', num: 4, color: '#0284c7' }],
      signGrammar: [{ word: 'วันนี้', num: 1, color: '#10b981' }, { word: 'เพื่อน', num: 2, color: '#7c3aed' }, { word: 'บ้าน', num: 3, color: '#0284c7' }, { word: 'มา', num: 4, color: '#f97316' }]
    },
    {
      id: 5,
      thaiGrammar: [{ word: 'ฉัน', num: 1, color: '#7c3aed' }, { word: 'ไม่', num: 2, color: '#ef4444' }, { word: 'ชอบ', num: 3, color: '#f97316' }, { word: 'ร้อน', num: 4, color: '#0284c7' }],
      signGrammar: [{ word: 'ฉัน', num: 1, color: '#7c3aed' }, { word: 'ร้อน', num: 2, color: '#0284c7' }, { word: 'ชอบ', num: 3, color: '#f97316' }, { word: 'ไม่', num: 4, color: '#ef4444' }]
    },
    {
      id: 6,
      thaiGrammar: [{ word: 'หมอ', num: 1, color: '#7c3aed' }, { word: 'ไป', num: 2, color: '#f97316' }, { word: 'โรงพยาบาล', num: 3, color: '#0284c7' }, { word: 'เมื่อไหร่', num: 4, color: '#10b981' }],
      signGrammar: [{ word: 'หมอ', num: 1, color: '#7c3aed' }, { word: 'โรงพยาบาล', num: 2, color: '#0284c7' }, { word: 'ไป', num: 3, color: '#f97316' }, { word: 'เมื่อไหร่', num: 4, color: '#10b981' }]
    },
    {
      id: 7,
      // เดิมใช้ "ขับ" เดี่ยว ๆ ซึ่งไม่ได้อยู่ในชุดคำศัพท์ที่เทรน (มีแต่คำรวม "คนขับรถ")
      // เปลี่ยนเป็น "หยุด" แทนเพื่อให้ทุกคำตรวจจับได้จริง
      thaiGrammar: [{ word: 'ตำรวจ', num: 1, color: '#7c3aed' }, { word: 'ห้าม', num: 2, color: '#ef4444' }, { word: 'หยุด', num: 3, color: '#f97316' }, { word: 'รถยนต์', num: 4, color: '#0284c7' }],
      signGrammar: [{ word: 'ตำรวจ', num: 1, color: '#7c3aed' }, { word: 'รถยนต์', num: 2, color: '#0284c7' }, { word: 'หยุด', num: 3, color: '#f97316' }, { word: 'ห้าม', num: 4, color: '#ef4444' }]
    },
    {
      id: 8,
      // เดิมใช้ "ได้" แยกจาก "ไม่" ซึ่ง "ได้" เดี่ยว ๆ ไม่ได้อยู่ในชุดคำศัพท์ที่เทรน
      // (มีแต่คำรวม "ไม่ได้") เปลี่ยนเป็น "ต้องการ" แทนเพื่อให้ทุกคำตรวจจับได้จริง
      thaiGrammar: [{ word: 'เขา', num: 1, color: '#7c3aed' }, { word: 'ไม่', num: 2, color: '#ef4444' }, { word: 'ต้องการ', num: 3, color: '#f97316' }, { word: 'เงิน', num: 4, color: '#0284c7' }],
      signGrammar: [{ word: 'เขา', num: 1, color: '#7c3aed' }, { word: 'เงิน', num: 2, color: '#0284c7' }, { word: 'ต้องการ', num: 3, color: '#f97316' }, { word: 'ไม่', num: 4, color: '#ef4444' }]
    },
    {
      id: 9,
      thaiGrammar: [{ word: 'คุณ', num: 1, color: '#7c3aed' }, { word: 'ต้องการ', num: 2, color: '#f97316' }, { word: 'น้ำ', num: 3, color: '#0284c7' }, { word: 'เท่าไหร่', num: 4, color: '#10b981' }],
      signGrammar: [{ word: 'คุณ', num: 1, color: '#7c3aed' }, { word: 'น้ำ', num: 2, color: '#0284c7' }, { word: 'ต้องการ', num: 3, color: '#f97316' }, { word: 'เท่าไหร่', num: 4, color: '#10b981' }]
    },
    {
      id: 10,
      thaiGrammar: [{ word: 'คนขับรถ', num: 1, color: '#7c3aed' }, { word: 'ไม่', num: 2, color: '#ef4444' }, { word: 'ไป', num: 3, color: '#f97316' }, { word: 'ตลาด', num: 4, color: '#0284c7' }],
      signGrammar: [{ word: 'คนขับรถ', num: 1, color: '#7c3aed' }, { word: 'ตลาด', num: 2, color: '#0284c7' }, { word: 'ไป', num: 3, color: '#f97316' }, { word: 'ไม่', num: 4, color: '#ef4444' }]
    }
  ]
};

// สีประจำโหมดคงเดิม (เขียว/ส้ม/แดง) — gradient ใช้กับหัวการ์ดและปุ่มในหน้าเลือกโหมด
// timeLimit = เวลาจับต่อรอบ (วินาที): ง่าย 60 / ปานกลาง 90 / ยาก 120
const difficultyMeta: Record<Difficulty, { label: string; sub: string; color: string; glow: string; gradient: string; level: number; timeLimit: number }> = {
  easy: { label: 'ง่าย', sub: 'ทดสอบคำศัพท์เดี่ยว', color: '#10b981', glow: 'rgba(16, 185, 129, 0.3)', gradient: 'linear-gradient(135deg, #047857 0%, #10b981 55%, #34d399 100%)', level: 1, timeLimit: 60 },
  medium: { label: 'ปานกลาง', sub: 'ประโยคง่ายๆ 3 คำ', color: '#f97316', glow: 'rgba(249, 115, 22, 0.3)', gradient: 'linear-gradient(135deg, #c2410c 0%, #f97316 55%, #fb923c 100%)', level: 2, timeLimit: 90 },
  hard: { label: 'ยาก', sub: 'ประโยคยาว 4 คำ', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)', gradient: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 55%, #f87171 100%)', level: 3, timeLimit: 120 },
};

// สิ่งที่ผู้ใช้ต้องทำในแต่ละโหมด (แสดงบนการ์ดหน้าเลือกโหมด)
const difficultyFeatures: Record<Difficulty, { icon: React.ComponentType<{ style?: React.CSSProperties }>; text: string }[]> = {
  easy: [
    { icon: Type, text: 'ทำท่าคำศัพท์ทีละคำ' },
    { icon: Shuffle, text: `สุ่มจากคลังศัพท์ ${EASY_WORDS_49.length} คำ` },
    { icon: Timer, text: `จับเวลา ${difficultyMeta.easy.timeLimit} วินาที` },
  ],
  medium: [
    { icon: ListOrdered, text: 'ทำท่าเรียงตามไวยากรณ์ภาษามือ' },
    { icon: Shuffle, text: `สุ่มจาก ${baseQuestionPool.medium.length} ประโยค 3 คำ` },
    { icon: Timer, text: `จับเวลา ${difficultyMeta.medium.timeLimit} วินาที` },
  ],
  hard: [
    { icon: ListOrdered, text: 'ทำท่าเรียงตามไวยากรณ์ภาษามือ' },
    { icon: Shuffle, text: `สุ่มจาก ${baseQuestionPool.hard.length} ประโยค 4 คำ` },
    { icon: Timer, text: `จับเวลา ${difficultyMeta.hard.timeLimit} วินาที` },
  ],
};

// ตัวอย่างโจทย์บนหัวการ์ด: โหมดง่ายเป็นคำเดี่ยว, กลาง/ยากเป็นลำดับภาษามือของประโยคแรกในชุด
const difficultyExample: Record<Difficulty, string[]> = {
  easy: ['สวัสดี'],
  medium: baseQuestionPool.medium[0].signGrammar.map((x) => x.word),
  hard: baseQuestionPool.hard[0].signGrammar.map((x) => x.word),
};

// คะแนนต่อข้อที่ตอบถูก (ใช้ทั้งตอนบวกคะแนน, ป้าย +N และจำนวนข้อที่ถูกในหน้าสรุปผล)
const POINTS_PER_CORRECT = 10;

// ลูกเล่นของกล่องในหน้าฝึก: ปุ่ม START เต้นเบา ๆ ชวนกด, คะแนนเด้งเมื่อเพิ่ม
const GAME_BOX_STYLES = `
  @keyframes sb-start-pulse { 0% { box-shadow: 0 0 0 0 rgba(22,98,196,0.45); } 70% { box-shadow: 0 0 0 12px rgba(22,98,196,0); } 100% { box-shadow: 0 0 0 0 rgba(22,98,196,0); } }
  .sb-start-btn { animation: sb-start-pulse 1.8s ease-out infinite; transition: transform 0.2s ease; }
  .sb-start-btn:hover { transform: scale(1.08); }
  @keyframes sb-score-pop { 0% { transform: scale(0.6); opacity: 0.3; } 60% { transform: scale(1.18); } 100% { transform: scale(1); opacity: 1; } }
  .sb-score-pop { display: inline-block; animation: sb-score-pop 0.45s ease-out; }
  @keyframes sb-score-gain { 0% { opacity: 0; transform: translateY(8px) scale(0.6); } 20% { opacity: 1; transform: translateY(0) scale(1.15); } 70% { opacity: 1; transform: translateY(-4px) scale(1); } 100% { opacity: 0; transform: translateY(-14px) scale(0.95); } }
  .sb-score-gain { opacity: 0; animation: sb-score-gain 1.6s ease-out forwards; text-shadow: 0 2px 6px rgba(22,163,74,0.25); }
`;

const MODE_CARD_STYLES = `
  @keyframes sb-mode-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  .sb-mode-card { opacity: 0; animation: sb-mode-in 0.45s ease-out forwards; transition: transform 0.3s ease, box-shadow 0.3s ease; }
  .sb-mode-card:hover { transform: translateY(-6px); box-shadow: 0 22px 44px -16px var(--sb-glow), 0 0 0 2px var(--sb-glow) !important; }
  .sb-mode-card:active { transform: translateY(-2px) scale(0.98); }
  .sb-mode-card .sb-mode-watermark { transition: transform 0.5s ease, opacity 0.5s ease; }
  .sb-mode-card:hover .sb-mode-watermark { transform: rotate(-10deg) scale(1.12); opacity: 0.28; }
  .sb-mode-card .sb-mode-arrow { transition: transform 0.25s ease; }
  .sb-mode-card:hover .sb-mode-arrow { transform: translateX(4px); }
  @keyframes sb-mode-chip-in { from { opacity: 0; transform: translateY(8px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .sb-mode-chip { opacity: 0; animation: sb-mode-chip-in 0.4s ease-out forwards; }
`;

interface GamePageProps {
  onCameraStatusChange?: (status: boolean) => void;
}

export const GamePage: React.FC<GamePageProps> = ({ onCameraStatusChange }) => {
  const isMobileView = useIsMobileView();
  // จอสูงไม่เกิน 800px ย่อกล่องคอลัมน์ขวาให้ไม่เกินขอบล่างของกล้อง (เกณฑ์เดียวกับหน้าหลัก)
  const isShortView = useIsShortView(800);
  // จอแท็บเล็ต (เช่น iPad แนวนอน) ยังใช้ layout ฝั่งซ้าย/ขวาแบบ desktop อยู่ (ไม่ต้องสแต็กแนวตั้ง)
  // แต่สูงไม่พอให้แผงควบคุมขวา 5 กล่องพอดีเป๊ะแบบจอใหญ่ เลยต้องเปิด scroll ให้แถวนี้ไว้เป็นทางเลือก
  const isTabletView = useIsMobileView(1366);
  // กล่องคอลัมน์ขวาแบบย่อ: จอเตี้ย หรือแท็บเล็ตแนวนอน (iPad 1180x820 สูงไม่พอให้ 5 กล่องขนาดเต็ม)
  const compactColumn = isShortView || isTabletView;
  // จอเตี้ยมาก (เช่นโน้ตบุ๊ก 1280x720): กล่องเวลา/คะแนนวางหัวกล่องกับค่าเป็นแถวเดียว ให้คอลัมน์ขวาไม่เกินขอบล่างกล้อง
  const isTightColumn = useIsShortView(740);
  // iPad แนวตั้ง: ใช้กล่องชุดเดียวกับ PC เรียงใต้กล้อง
  const isTabletPortrait = useIsTabletPortrait();
  // มือถือแนวนอน: โจทย์ + กล้องซ้าย สถิติ/START/ปุ่มควบคุมในคอลัมน์ขวา ให้ทั้งหมดพอดีจอ
  const isPhoneLandscape = useIsPhoneLandscape();
  // มือถือแนวตั้ง: ปุ่ม START อยู่ใต้กล้อง (ไม่ใช่ทางขวาแบบจอใหญ่)
  const isPhonePortrait = isMobileView && !isTabletPortrait && !isPhoneLandscape;
  // iPad แนวนอน: ซ่อนหัวข้อกล่องสถานะ/เวลาถอยหลัง/คะแนนสะสม เหลือแต่ค่า ให้คอลัมน์ขวาพอดีขอบล่างกล้อง
  const hideBoxHeaders = useIsTabletLandscape();
  const [gameState, setGameState] = useState<'select' | 'playing' | 'result'>('select');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  
  const [questionPool, setQuestionPool] = useState<Record<Difficulty, SentenceQuestion[]>>(baseQuestionPool);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(difficultyMeta.easy.timeLimit);
  
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [lastResultStatus, setLastResultStatus] = useState<'correct' | 'wrong' | null>(null);

  // ควบคุมกล้อง
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isBlurBg, setIsBlurBg] = useState<boolean>(false);
  // ค่าเริ่มต้นไม่กลับด้าน (false) เพื่อให้ตรงกับภาพโหมดโครงกระดูกที่ backend ส่งกลับมา
  // (ซึ่งเป็นภาพดิบไม่กลับด้านเสมอ) ป้องกันปัญหาภาพสลับด้านกันเวลาสลับโหมด
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [isShowSkeleton, setIsShowSkeleton] = useState<boolean>(false);
  const [skeletonFrame, setSkeletonFrame] = useState<string | null>(null);

  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');

  // wordEvent เปลี่ยนเป็น object ใหม่ทุกครั้งที่ backend ทำนายท่าทางใหม่จริง ๆ (ผูกกับ
  // prediction_id) แม้คำที่ได้จะซ้ำกับครั้งก่อนก็ตาม เพื่อให้ effect ที่ตรวจคำตอบทำงานทุกครั้ง
  // ที่มีท่าทางใหม่แน่ ๆ ไม่ใช่แค่ตอนค่า string เปลี่ยน (ถ้าใช้ string เฉย ๆ ตอนคำซ้ำกับครั้ง
  // ก่อนจะไม่ trigger effect เพราะ React มองว่าค่าไม่เปลี่ยน)
  const [wordEvent, setWordEvent] = useState<{ word: string; id: number; confidence: number } | null>(null);
  // คำที่ทำถูกแล้วและ "ล็อค" ไว้ตามลำดับของโจทย์ (โหมดกลาง/ยาก) - สะสมฝั่ง client เอง
  // ไม่ได้อิง word_buffer ของ backend เพราะ buffer ฝั่งนั้นมี timeout/ขนาดของตัวเองที่ออกแบบ
  // มาสำหรับหน้า Dashboard ไม่ใช่สำหรับ flow ของเกม
  const [lockedWords, setLockedWords] = useState<string[]>([]);
  // อ่านค่า lockedWords ปัจจุบันแบบ sync ได้โดยไม่ต้องใส่ lockedWords ไว้ใน dependency array
  // ของ effect ตรวจคำตอบ — ถ้าใส่ไว้ effect จะ trigger ซ้ำทันทีที่ setLockedWords อัปเดตค่า
  // (จาก dependency เปลี่ยน) ทั้งที่ wordEvent ยังเป็นตัวเดิม ทำให้เอาคำเดิมไปเทียบกับคำถัดไป
  // ที่เลื่อนตำแหน่งไปแล้วซ้ำอีกรอบ กลายเป็นมองว่าผิดและรีเซ็ตทันทีหลังล็อคคำถูกไปหมาด ๆ
  const lockedWordsRef = useRef<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sendCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selfieSegRef = useRef<any>(null);
  const animFrameId = useRef<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameTickerRef = useRef<Worker | null>(null);
  const lastPredictionIdRef = useRef<number>(-1);
  const [isTooClose, setIsTooClose] = useState<boolean>(false);
  // กล่องสถานะการตรวจจับ (แบบเดียวกับหน้าหลัก): server กำลังเก็บท่าอยู่ไหม + ผลล่าสุดที่โชว์ค้างไว้ชั่วครู่
  const [isReadingSign, setIsReadingSign] = useState<boolean>(false);
  const [statusFlash, setStatusFlash] = useState<{ kind: 'detected'; word: string } | { kind: 'unsure' } | null>(null);
  const lastRejectedIdRef = useRef<number>(-1);

  const isCameraOnRef = useRef(isCameraOn);
  const isShowSkeletonRef = useRef(isShowSkeleton);
  // loop วาดภาพกล้อง (requestAnimationFrame) ถูกสร้างครั้งเดียวตอนเปิดกล้อง จึงต้องอ่านค่าล่าสุดผ่าน ref
  const isBlurBgRef = useRef(isBlurBg);
  const isMirroredRef = useRef(isMirrored);

  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
  }, [isCameraOn]);

  useEffect(() => {
    isShowSkeletonRef.current = isShowSkeleton;
    if (!isShowSkeleton) setSkeletonFrame(null);
  }, [isShowSkeleton]);

  useEffect(() => {
    isBlurBgRef.current = isBlurBg;
    isMirroredRef.current = isMirrored;
  }, [isBlurBg, isMirrored]);

  // ล้างค่าคำทายสะสม
  const clearPredictions = () => {
    setWordEvent(null);
    setLockedWords([]);
    lockedWordsRef.current = [];
  };

  // สตาร์ทกล้อง
  const startCamera = async (mode: 'user' | 'environment' = 'user') => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          processSegmentationLoop();
        };
      }
      setIsCameraOn(true);
      onCameraStatusChange?.(true);
    } catch (err) {
      console.error('ไม่สามารถเข้าถึงกล้องได้:', err);
      setIsCameraOn(false);
      onCameraStatusChange?.(false);
    }
  };

  const stopCamera = () => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    onCameraStatusChange?.(false);
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera(facingMode);
    }
  };

  const switchCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setIsMirrored(!isMirrored);
    if (isCameraOn) {
      await startCamera(nextMode);
    }
  };

  // โหลด MediaPipe Selfie Segmentation
  useEffect(() => {
    let isMounted = true;

    const loadScript = (src: string) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(script);
      });
    };

    loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js')
      .then(() => {
        if (!isMounted || typeof (window as any).SelfieSegmentation === 'undefined') return;

        const selfieSegmentation = new (window as any).SelfieSegmentation({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });

        selfieSegmentation.setOptions({ modelSelection: 1 });

        selfieSegmentation.onResults((results: any) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          canvas.width = results.image.width;
          canvas.height = results.image.height;

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (isMirrored) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }

          if (isBlurBg) {
            ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-over';
            // Safari ไม่รองรับ ctx.filter — ใช้ drawBlurredImage ที่มีวิธีสำรอง
            drawBlurredImage(ctx, results.image, canvas.width, canvas.height, 20);
          } else {
            ctx.filter = 'none';
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
          }

          ctx.restore();
        });

        selfieSegRef.current = selfieSegmentation;
      })
      .catch((err) => console.error('MediaPipe Load Error:', err));

    return () => {
      isMounted = false;
      if (selfieSegRef.current) selfieSegRef.current.close();
    };
  }, [isBlurBg, isMirrored]);

  const processSegmentationLoop = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      // AI ตัดพื้นหลัง (Selfie Segmentation) ใช้เฉพาะตอนเปิดเบลอพื้นหลัง — ถ้ารันทุกเฟรมตลอดเวลา
      // iPad จะทำงานหนักจนร้อนและช้าลงเมื่อใช้ไปนาน ๆ (ภาพและผลตรวจจับหน่วง)
      if (selfieSegRef.current && isBlurBgRef.current) {
        try {
          await selfieSegRef.current.send({ image: video });
        } catch (e) {
          drawFallbackVideo(video, canvas);
        }
      } else {
        drawFallbackVideo(video, canvas);
      }
    }
    animFrameId.current = requestAnimationFrame(processSegmentationLoop);
  };

  const drawFallbackVideo = (video: HTMLVideoElement, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.save();

    if (isMirroredRef.current) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.filter = 'none';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  // เชื่อมต่อ WebSocket และรับข้อมูลจาก Backend
  useEffect(() => {
    let isUnmounted = false;
    let reconnectDelay = 1000;

    const connect = () => {
      if (isUnmounted) return;
      setWsStatus('connecting');

      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectDelay = 1000;
        // เชื่อมต่อใหม่ = session ใหม่ฝั่ง server ที่นับ prediction_id จาก 0 ใหม่ ต้องล้างค่าเดิม
        // ไม่งั้นท่าแรกของ session ใหม่อาจได้ id ตรงกับค่าเก่าพอดีแล้วถูกมองข้ามไป
        lastPredictionIdRef.current = -1;
        lastRejectedIdRef.current = -1;
        setWsStatus('connected');
      };

      socket.onmessage = (event) => {
        let data: PredictionMessage;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!data || data.type !== 'prediction') return;

        // ยึดตาม prediction_id เพื่อรับรู้เฉพาะ "ท่าทางใหม่ที่เพิ่งทำนายจริง ๆ" เท่านั้น
        // (backend ส่ง word เดิมซ้ำทุกเฟรมตราบใดที่ยังไม่มีท่าทางใหม่ ถ้าไม่เช็คตรงนี้จะทำให้
        // เกมยังคงเทียบคำเดิมซ้ำ ๆ ไปเรื่อย ๆ แม้ผู้ใช้จะวางมือลงไปแล้วก็ตาม)
        if (
          data.word &&
          data.word !== '-' &&
          typeof data.prediction_id === 'number' &&
          data.prediction_id !== lastPredictionIdRef.current
        ) {
          lastPredictionIdRef.current = data.prediction_id;
          setWordEvent({ word: data.word, id: data.prediction_id, confidence: Math.round(data.confidence * 1000) / 10 });
          setStatusFlash({ kind: 'detected', word: data.word });
        }

        setIsTooClose(data.too_close === true);

        // จบท่าแล้วแต่ความมั่นใจต่ำ (rejected_id เพิ่ม) → บอกให้ลองใหม่ ข้อความแรกหลังเชื่อมต่อใช้เป็นค่าตั้งต้นเฉย ๆ
        if (typeof data.rejected_id === 'number') {
          if (lastRejectedIdRef.current !== -1 && data.rejected_id !== lastRejectedIdRef.current) {
            setStatusFlash({ kind: 'unsure' });
          }
          lastRejectedIdRef.current = data.rejected_id;
        }
        setIsReadingSign(data.is_recording === true);

        // ภาพ Skeleton
        if (isShowSkeletonRef.current && data.frame) {
          setSkeletonFrame(`data:image/jpeg;base64,${data.frame}`);
        }
      };

      socket.onerror = () => socket.close();

      socket.onclose = () => {
        // เช็คก่อนเคลียร์ว่า wsRef.current ยังเป็น socket ตัวนี้อยู่จริง — ป้องกัน onclose
        // ของ socket เก่า (เช่น จาก StrictMode mount/cleanup/mount ซ้ำตอน dev) มาทำงานช้า
        // แล้วเคลียร์ wsRef.current ที่ตอนนี้เป็น socket ใหม่ (ตัวที่เชื่อมต่อสำเร็จจริง) ทิ้งไป
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        if (isUnmounted) return;
        setWsStatus('disconnected');
        setIsTooClose(false);
        setIsReadingSign(false);
        reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 10000);
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, []);

  // ส่งภาพ BGR เข้า WebSocket
  useEffect(() => {
    const worker = new Worker(new URL('../workers/frameTicker.worker.ts', import.meta.url), {
      type: 'module',
    });
    frameTickerRef.current = worker;

    worker.onmessage = () => {
      const video = videoRef.current;
      const sendCanvas = sendCanvasRef.current;
      const socket = wsRef.current;

      if (!isCameraOnRef.current || !video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      if (!sendCanvas || !socket || socket.readyState !== WebSocket.OPEN) return;
      // เฟรมก่อนหน้ายังอัปโหลดไม่เสร็จ (เน็ตช้า) → ข้ามเฟรมนี้ ไม่ให้เฟรมค้างเป็นคิวจน delay สะสมยาวขึ้นเรื่อย ๆ
      if (socket.bufferedAmount > 0) return;

      const ctx = sendCanvas.getContext('2d');
      if (!ctx) return;

      // ย่อให้ด้านยาวไม่เกิน MAX_SEND_DIM (เท่ากับที่ server ย่อก่อนประมวลผลอยู่แล้ว) ภาพที่ AI ได้เท่าเดิม
      // แต่ข้อมูลที่ต้องส่งเหลือไม่ถึงครึ่ง
      const scale = Math.min(1, MAX_SEND_DIM / Math.max(video.videoWidth, video.videoHeight));
      sendCanvas.width = Math.round(video.videoWidth * scale);
      sendCanvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, sendCanvas.width, sendCanvas.height);

      const base64 = sendCanvas.toDataURL('image/jpeg', 0.95).split(',')[1];
      if (!base64) return;

      socket.send(JSON.stringify({ image: base64, showSkeleton: isShowSkeletonRef.current, page: 'game' }));
    };

    worker.postMessage({ type: 'start', intervalMs: FRAME_SEND_INTERVAL_MS });

    return () => {
      worker.postMessage({ type: 'stop' });
      worker.terminate();
    };
  }, []);

  const handleSelectDifficulty = (selectedDiff: Difficulty) => {
    setDifficulty(selectedDiff);
    setQuestionPool({
      easy: generateEasyQuestions(),
      medium: shuffleArray(baseQuestionPool.medium),
      hard: shuffleArray(baseQuestionPool.hard)
    });
    setScore(0);
    setQuestionIndex(0);
    setTimeLeft(difficultyMeta[selectedDiff].timeLimit);
    setIsTimerRunning(false);
    setIsAnswerRevealed(false);
    setLastResultStatus(null);
    clearPredictions();
    setGameState('playing');
    startCamera(facingMode);
  };

  const handlePressStart = () => {
    clearPredictions();
    setIsTimerRunning(true);
  };

  const handleCorrectAnswer = () => {
    if (gameState !== 'playing' || !isTimerRunning) return;
    setIsAnswerRevealed(true);
    setLastResultStatus('correct');
    setScore((prev) => prev + POINTS_PER_CORRECT);

    setTimeout(() => {
      setIsAnswerRevealed(false);
      setLastResultStatus(null);
      clearPredictions();
      setQuestionIndex((prev) => prev + 1);
    }, 1200);
  };

  const handleWrongAnswer = () => {
    if (gameState !== 'playing' || !isTimerRunning) return;
    setLastResultStatus('wrong');
    setTimeout(() => {
      setLastResultStatus(null);
      clearPredictions();
    }, 1000);
  };

  const currentPool = questionPool[difficulty];
  const currentQ = currentPool[questionIndex % currentPool.length];

  // หาลำดับที่คำ ๆ หนึ่งควรถูกทำ ตามลำดับภาษามือไทย (signGrammar) ของโจทย์ข้อนั้น
  // ใช้แสดงเลขกำกับในวงเล็บบนกล่อง "ไวยากรณ์ภาษาไทย" เพื่อบอกผู้เล่นว่าคำนี้ต้องทำเป็นลำดับที่เท่าไหร่
  const getSignOrderIndex = (question: SentenceQuestion, word: string): number => {
    const idx = question.signGrammar.findIndex((item) => item.word === word);
    return idx === -1 ? 0 : idx + 1;
  };

  // ระบบตรวจจับเปรียบเทียบคำตอบ — ทำงานทุกครั้งที่มี wordEvent ใหม่ (ท่าทางใหม่จริง ๆ เท่านั้น)
  //
  // โหมดง่าย: เทียบคำที่ตรวจจับได้กับคำตอบตรง ๆ ทันที
  // โหมดกลาง/ยาก: ไม่ใช้การคำนวณไวยากรณ์ใด ๆ เลย แค่เทียบกับ "คำถัดไปที่ต้องทำ" ตามลำดับภาษามือ
  // (signGrammar) ของโจทย์ ถ้าตรงคำถัดไปก็ล็อคคำนั้นไว้ (เก็บใน lockedWords) แล้วรอทำคำถัดไป
  // ถ้าทำผิดคำ/ผิดลำดับ จะไม่รีเซ็ตคำที่ล็อคไปแล้ว แค่เพิกเฉยคำที่ผิด ปล่อยให้ลองทำคำถัดไป
  // (ตำแหน่งเดิม) ใหม่ได้เรื่อย ๆ จนกว่าจะถูก
  useEffect(() => {
    if (!wordEvent) return;
    if (!isTimerRunning || lastResultStatus !== null || !currentQ) return;

    if (difficulty === 'easy') {
      if (currentQ.wordOnly && isSameSign(wordEvent.word, currentQ.wordOnly)) {
        handleCorrectAnswer();
      } else {
        handleWrongAnswer();
      }
      return;
    }

    const targetSeq = currentQ.signGrammar.map((item) => item.word);
    // อ่านจาก ref แทน state โดยตรง เพื่อไม่ต้องใส่ lockedWords ใน dependency array (ดูหมายเหตุ
    // ตรงประกาศ lockedWordsRef ด้านบนว่าทำไมถึงต้องเลี่ยง)
    const currentLocked = lockedWordsRef.current;
    const nextExpected = targetSeq[currentLocked.length];

    if (nextExpected && isSameSign(wordEvent.word, nextExpected)) {
      const newLocked = [...currentLocked, nextExpected];
      lockedWordsRef.current = newLocked;
      setLockedWords(newLocked);
      if (newLocked.length === targetSeq.length) {
        handleCorrectAnswer();
      }
    }
    // ทำผิดคำ/ผิดลำดับ: ไม่ต้องทำอะไร (ไม่รีเซ็ต ไม่ตัดคะแนน) คำที่ล็อคไว้แล้วยังคงอยู่
  }, [wordEvent, isTimerRunning, lastResultStatus, difficulty, currentQ]);

  // นับเวลาถอยหลังตามเวลาของโหมด (difficultyMeta[...].timeLimit)
  useEffect(() => {
    let timer: any;
    if (gameState === 'playing' && isTimerRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      stopCamera();
      setIsTimerRunning(false);
      clearPredictions();
      setGameState('result');
    }
    return () => clearInterval(timer);
  }, [gameState, isTimerRunning, timeLeft]);

  // กล่องแสดงภาพกล้อง (ใช้ร่วมกันทั้ง layout desktop และ mobile เหมือนกับหน้า Student)
  const gameCameraBox = (
    <div
      style={{
        flex: 1,
        backgroundColor: '#000000',
        borderRadius: '32px',
        border: lastResultStatus === 'correct'
          ? '4px solid #10b981'
          : lastResultStatus === 'wrong'
          ? '4px solid #ef4444'
          : '3px solid #0d47a1',
        boxShadow: lastResultStatus === 'correct'
          ? '0 0 30px rgba(16, 185, 129, 0.8)'
          : lastResultStatus === 'wrong'
          ? '0 0 30px rgba(239, 68, 68, 0.8)'
          : '0 0 20px rgba(13, 71, 161, 0.3)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border 0.3s ease, box-shadow 0.3s ease'
      }}
    >
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />

      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: isCameraOn ? 'block' : 'none'
        }}
      />

      <TooCloseWarning show={isCameraOn && wsStatus === 'connected' && isTooClose} />

      {isCameraOn && isShowSkeleton && skeletonFrame && (
        <img
          src={skeletonFrame}
          alt="โครงกระดูกที่ตรวจจับได้"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            zIndex: 10,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* MODE + LIVE BADGE */}
      {isCameraOn && (
        <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '9999px', padding: '6px 14px', zIndex: 15, backdropFilter: 'blur(4px)' }}>
          <span className="sb-pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: difficultyMeta[difficulty].color, boxShadow: `0 0 6px ${difficultyMeta[difficulty].color}` }} />
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>{difficultyMeta[difficulty].label}</span>
        </div>
      )}

      {!isCameraOn && (
        <div style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
            <Camera style={{ width: '24px', height: '24px', color: '#ef4444' }} />
          </div>
          <p style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '20px', margin: 0, textShadow: '0 0 8px rgba(239,68,68,0.4)' }}>
            กรุณากดเปิดกล้อง
          </p>
          <p style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '20px', margin: '4px 0 0 0', textShadow: '0 0 8px rgba(239,68,68,0.4)' }}>
            ก่อนใช้งานระบบ
          </p>
        </div>
      )}

      {isCameraOn && !isTimerRunning && (
        <div style={{ position: 'absolute', backgroundColor: 'rgba(255,255,255,0.94)', padding: '16px 28px', borderRadius: '24px', border: '2px solid #0d47a1', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 10 }}>
          <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#0d47a1', margin: 0 }}>
            กดปุ่ม START สีน้ำเงิน{isPhonePortrait ? 'ด้านล่าง' : 'ทางขวามือ'}เพื่อเริ่มทบทวน!
          </p>
        </div>
      )}

      {/* ปุ่มจำลองทดสอบระบบ */}
      {isCameraOn && isTimerRunning && (
        <div style={{ position: 'absolute', bottom: '20px', display: 'flex', gap: '12px', zIndex: 10 }}>
          <button
            onClick={handleCorrectAnswer}
            className="sb-sim-btn"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.9)',
              border: '1px solid #ffffff',
              color: '#ffffff',
              padding: '8px 20px',
              borderRadius: '9999px',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            จำลองภาษามือถูกต้อง
          </button>
          <button
            onClick={handleWrongAnswer}
            className="sb-sim-btn"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.9)',
              border: '1px solid #ffffff',
              color: '#ffffff',
              padding: '8px 20px',
              borderRadius: '9999px',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            จำลองทำผิด
          </button>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (!statusFlash) return;
    const t = setTimeout(() => setStatusFlash(null), 2500);
    return () => clearTimeout(t);
  }, [statusFlash]);

  const detectionStatus = resolveDetectionStatus({
    isCameraOn,
    isConnected: wsStatus === 'connected',
    isTooClose,
    isReadingSign,
    flash: statusFlash,
    answer: lastResultStatus,
    waitingForStart: !isTimerRunning
  });
  const statusLook = describeStatus(detectionStatus);

  // กระดานโจทย์ — โหมดง่าย: ซ้ายโจทย์ ขวาผลตรวจจับ (แบบกล่องผลคำเดี่ยวในหน้าหลัก)
  // โหมดกลาง/ยาก: โจทย์ภาษาไทย (ซ้าย) / ท่าที่ทำได้ตามลำดับภาษามือ (ขวา)
  const syntaxBoard = (
    difficulty === 'easy' ? (
    <div style={{ ...homeCardStyle, height: '116px', display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
      <Hand style={{ ...homeWatermarkStyle, width: '130px', height: '130px', right: '-20px', top: '-18px' }} />
      {[
        {
          icon: Flag,
          label: 'โจทย์ (ภาษาไทย)',
          content: isTimerRunning ? (
            <span key={currentQ.wordOnly} className="sb-word-pop" style={{ fontSize: '30px', fontWeight: 800, color: '#0d47a1', lineHeight: 1.2 }}>{currentQ.wordOnly}</span>
          ) : null
        },
        {
          icon: Aperture,
          label: 'ผลการตรวจจับคำเดี่ยว',
          content: isTimerRunning ? (
            wordEvent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span key={wordEvent.id} className="sb-word-pop" style={{ fontSize: '30px', fontWeight: 800, color: '#0d47a1', lineHeight: 1.2 }}>{wordEvent.word}</span>
                {/* แถบความมั่นใจ (เหมือนหน้าหลัก) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '110px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a' }}>ความมั่นใจ {wordEvent.confidence}%</span>
                  <div style={{ height: '6px', borderRadius: '9999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{ width: `${wordEvent.confidence}%`, height: '100%', borderRadius: '9999px', background: 'linear-gradient(90deg, #22c55e, #16a34a)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', lineHeight: '36px' }}>ทำท่าภาษามือหน้ากล้อง</span>
            )
          ) : null
        }
      ].map((half, i) => (
        <React.Fragment key={half.label}>
          {i > 0 && <div style={{ width: '1px', background: 'linear-gradient(180deg, transparent, #dce8f7 20%, #dce8f7 80%, transparent)', flexShrink: 0 }} />}
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', gap: '18px', minWidth: 0 }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: BLUE_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px -10px rgba(22,98,196,0.7)', flexShrink: 0 }}>
              <half.icon style={{ width: '28px', height: '28px', color: '#ffffff' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#64748b' }}>{half.label}</span>
              {half.content ?? <span style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', lineHeight: '36px' }}>กด START เพื่อเริ่มทบทวน</span>}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
    ) : (
    // SYNTAX BOARD (กลาง/ยาก): โจทย์ภาษาไทย (ซ้าย) / ท่าที่ทำได้ตามลำดับภาษามือ (ขวา)
    <div style={{ ...homeCardStyle, height: '116px', display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
      <Hand style={{ ...homeWatermarkStyle, width: '130px', height: '130px', right: '-20px', top: '-18px' }} />

      {/* ฝั่งซ้าย: โจทย์ */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '14px 18px', minWidth: 0 }}>
        <BoxHeader icon={Flag} title="ไวยากรณ์ภาษาไทย" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {isTimerRunning ? (
            (
              currentQ.thaiGrammar.map((item, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight style={{ width: '14px', height: '14px', color: '#94a3b8' }} />}
                  {/* สีประจำคำ + เลขลำดับที่ต้องทำในภาษามือ */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '17px', fontWeight: 800, color: item.color, backgroundColor: `${item.color}14`, border: `1px solid ${item.color}33`, padding: '3px 10px 3px 12px', borderRadius: '10px' }}>
                    {item.word}
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: item.color, color: '#ffffff', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {getSignOrderIndex(currentQ, item.word)}
                    </span>
                  </span>
                </React.Fragment>
              ))
            )
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 700 }}>กด START เพื่อเริ่มทบทวน</span>
          )}
        </div>
      </div>

      <div style={{ width: '1px', background: 'linear-gradient(180deg, transparent, #dce8f7 20%, #dce8f7 80%, transparent)', flexShrink: 0 }} />

      {/* ฝั่งขวา: ท่าที่ตรวจจับได้ตามลำดับภาษามือ */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '14px 18px', minWidth: 0 }}>
        <BoxHeader icon={Hand} title="ไวยากรณ์ภาษามือไทย" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {isTimerRunning ? (
            (
              // ช่องตามจำนวนคำของโจทย์: ล็อคแล้ว = น้ำเงินทึบ, ช่องที่กำลังรอ = คำที่ AI เห็นล่าสุด
              // (กรอบส้ม ไม่ว่าจะถูกหรือผิด ให้เห็นว่าระบบกำลังอ่านอะไร), ยังไม่ถึง = ช่องประ
              currentQ.signGrammar.map((_, idx) => {
                const isLocked = idx < lockedWords.length;
                const isLiveSlot = idx === lockedWords.length;
                const liveWord = isLiveSlot ? wordEvent?.word : null;
                const display = isLocked ? lockedWords[idx] : liveWord;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight style={{ width: '14px', height: '14px', color: '#94a3b8' }} />}
                    {display ? (
                      <span style={{ fontSize: '17px', fontWeight: 800, padding: '3px 12px', borderRadius: '10px', color: isLocked ? '#ffffff' : '#c2410c', background: isLocked ? BLUE_GRADIENT : '#fff7ed', border: isLocked ? '1px solid transparent' : '1px solid #fdba74' }}>
                        {display}
                      </span>
                    ) : (
                      <span style={{ minWidth: '44px', textAlign: 'center', fontSize: '15px', fontWeight: 800, padding: '3px 10px', borderRadius: '10px', color: isLiveSlot ? '#1662c4' : '#cbd5e1', border: `1.5px dashed ${isLiveSlot ? '#93c5fd' : '#dbe3ee'}` }}>
                        {idx + 1}
                      </span>
                    )}
                  </React.Fragment>
                );
              })
            )
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 700 }}>กด START เพื่อเริ่มทบทวน</span>
          )}
        </div>
      </div>
    </div>
    )
  );

  // ปุ่ม START — สูง 116px เท่ากระดานโจทย์ ขอบบนล่างจะได้ตรงกัน
  const startBox = (
    <div style={{ ...homeCardStyle, height: '116px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
      <Play style={{ ...homeWatermarkStyle, width: '84px', height: '84px', right: '-14px', top: '-14px' }} />
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <button
          onClick={handlePressStart}
          disabled={isTimerRunning}
          className={isTimerRunning ? undefined : 'sb-start-btn'}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: isTimerRunning ? '#e2e8f0' : BLUE_GRADIENT,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isTimerRunning ? 'not-allowed' : 'pointer',
            boxShadow: isTimerRunning ? 'none' : '0 8px 18px -6px rgba(22,98,196,0.65)',
            flexShrink: 0
          }}
        >
          <Play style={{ width: '28px', height: '28px', color: isTimerRunning ? '#94a3b8' : '#ffffff', marginLeft: '4px', fill: isTimerRunning ? '#94a3b8' : '#ffffff' }} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: '18px', fontWeight: 800, color: isTimerRunning ? '#94a3b8' : '#0d47a1' }}>{isTimerRunning ? 'กำลังฝึก' : 'START'}</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{isTimerRunning ? 'ทำท่าหน้ากล้องได้เลย' : 'กดเพื่อเริ่มจับเวลา'}</span>
        </div>
      </div>
    </div>
  );

  // เวลาถอยหลัง — วงแหวนนับถอยหลังตามเวลาที่เหลือ (แดงเมื่อเหลือ ≤ 10 วินาที)
  const timerBox = (
    <div style={{ ...homeCardStyle, padding: compactColumn ? '10px 14px' : '14px', flex: hideBoxHeaders ? 1 : undefined, display: 'flex', flexDirection: isTightColumn && !hideBoxHeaders ? 'row' : 'column', alignItems: isTightColumn || hideBoxHeaders ? 'center' : undefined, justifyContent: isTabletPortrait ? 'flex-start' : isTightColumn && !hideBoxHeaders ? 'space-between' : 'center', gap: compactColumn ? '4px' : '6px', flexShrink: 0 }}>
      <Timer style={{ ...homeWatermarkStyle, width: '84px', height: '84px', right: '-14px', top: '-14px' }} />
      {!hideBoxHeaders && <BoxHeader icon={Timer} title="เวลาถอยหลัง" size={compactColumn ? 'sm' : 'md'} />}
      {(() => {
        // iPad แนวตั้ง: หัวข้ออยู่บน วงเวลาขยายเต็มที่ว่างที่เหลือของกล่อง (กล่องสูงตามกล่องควบคุมกล้องในแถวเดียวกัน)
        const ring = isTabletPortrait ? 140 : hideBoxHeaders ? 76 : isTightColumn ? 52 : compactColumn ? 60 : 72;
        const stroke = isTabletPortrait ? 10 : 6;
        const radius = ring / 2 - stroke / 2 - 2;
        const circumference = 2 * Math.PI * radius;
        const ratio = Math.max(0, Math.min(1, timeLeft / difficultyMeta[difficulty].timeLimit));
        const danger = timeLeft <= 10;
        return (
          <div style={{ position: 'relative', alignSelf: 'center', width: `${ring}px`, height: `${ring}px`, margin: isTabletPortrait ? 'auto 0' : undefined }}>
            <svg width={ring} height={ring} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={ring / 2} cy={ring / 2} r={radius} fill="none" stroke="#e8f1fd" strokeWidth={stroke} />
              <circle
                cx={ring / 2}
                cy={ring / 2}
                r={radius}
                fill="none"
                stroke={danger ? '#ef4444' : '#1662c4'}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={-circumference * (1 - ratio)}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: isTabletPortrait ? '40px' : hideBoxHeaders ? '24px' : isTightColumn ? '18px' : compactColumn ? '20px' : '24px', fontWeight: 800, color: danger ? '#ef4444' : '#1e293b', lineHeight: 1 }}>{timeLeft}</span>
              <span style={{ fontSize: isTabletPortrait ? '13px' : '9.5px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>วินาที</span>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // คะแนนสะสม
  const scoreBox = (
    <div style={{ ...homeCardStyle, flex: 1, minHeight: 'min-content', padding: compactColumn ? '10px 14px' : '14px', display: 'flex', flexDirection: isTightColumn && !hideBoxHeaders ? 'row' : 'column', alignItems: isTightColumn ? 'center' : undefined, justifyContent: 'center', gap: '6px' }}>
      <Award style={{ ...homeWatermarkStyle, width: '96px', height: '96px', right: '-18px', top: '-16px' }} />
      {!hideBoxHeaders && <BoxHeader icon={Award} title="คะแนนสะสม" size={compactColumn ? 'sm' : 'md'} />}
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
          <span key={score} className="sb-score-pop" style={{ fontSize: hideBoxHeaders ? '32px' : isTightColumn ? '28px' : compactColumn ? '32px' : '40px', fontWeight: 800, color: '#1e293b' }}>{score}</span>
          {score > 0 && (
            <span key={`gain-${score}`} className="sb-score-gain" style={{ position: 'absolute', left: '100%', top: '-2px', marginLeft: '2px', fontSize: '17px', fontWeight: 800, color: '#16a34a', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              +{POINTS_PER_CORRECT}
            </span>
          )}
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>คะแนน</span>
        </div>
      </div>
    </div>
  );

  // กล่องควบคุมกล้อง (component เดียวกับหน้าหลัก)
  const cameraControlBox = (
    <CameraControlBox
      isCameraOn={isCameraOn}
      onToggleCamera={toggleCamera}
      onSwitchCamera={switchCamera}
      isBlurBg={isBlurBg}
      onToggleBlur={() => setIsBlurBg(!isBlurBg)}
      isShowSkeleton={isShowSkeleton}
      onToggleSkeleton={() => setIsShowSkeleton(!isShowSkeleton)}
      compact={compactColumn}
      grow={hideBoxHeaders}
    />
  );

  // มือถือ: กระดานโจทย์แบบย่อ
  const mobileSyntaxBoard = (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '18px', padding: '12px 14px', flexShrink: 0, boxShadow: '0 6px 16px -10px rgba(13,71,161,0.16)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <Flag style={{ width: '12px', height: '12px', color: '#0d47a1', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', flexShrink: 0 }}>
          {difficulty === 'easy' ? 'ภาษาไทย:' : 'ไวยากรณ์ไทย:'}
        </span>
        {isTimerRunning ? (
          difficulty === 'easy' ? (
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0d47a1' }}>{currentQ.wordOnly}</span>
          ) : (
            currentQ.thaiGrammar.map((item, idx) => (
              <React.Fragment key={idx}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: item.color }}>{item.word} ({getSignOrderIndex(currentQ, item.word)})</span>
                {idx < currentQ.thaiGrammar.length - 1 && <span style={{ color: '#94a3b8' }}>-</span>}
              </React.Fragment>
            ))
          )
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>กด START เพื่อเริ่มทบทวน</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <Hand style={{ width: '12px', height: '12px', color: '#0d47a1', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', flexShrink: 0 }}>
          {difficulty === 'easy' ? 'ภาษามือ:' : 'ไวยากรณ์มือ:'}
        </span>
        {isTimerRunning ? (
          difficulty === 'easy' ? (
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: wordEvent?.word ? '#0d47a1' : '#94a3b8' }}>
              {wordEvent?.word || '------------'}
            </span>
          ) : (
            currentQ.signGrammar.map((_, idx) => {
              const isLocked = idx < lockedWords.length;
              const isLiveSlot = idx === lockedWords.length;
              const liveWord = isLiveSlot ? wordEvent?.word : null;
              const display = isLocked ? lockedWords[idx] : liveWord;
              return (
                <React.Fragment key={idx}>
                  {display ? (
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: isLocked ? '#0d47a1' : '#f97316' }}>{display}</span>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>__</span>
                  )}
                  {idx < currentQ.signGrammar.length - 1 && <span style={{ color: '#94a3b8' }}>-</span>}
                </React.Fragment>
              );
            })
          )
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>กด START เพื่อเริ่มทบทวน</span>
        )}
      </div>
    </div>
  );

  // มือถือ: สถิติแบบย่อ เวลา / คะแนน / สถานะการตรวจจับ
  const mobileStats = (
    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
      <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '14px', padding: '8px', textAlign: 'center', boxShadow: '0 4px 12px -8px rgba(13,71,161,0.18)' }}>
        <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8' }}>เวลา</div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: timeLeft <= 10 ? '#ef4444' : '#1e293b' }}>{timeLeft}s</div>
      </div>
      <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '14px', padding: '8px', textAlign: 'center', boxShadow: '0 4px 12px -8px rgba(13,71,161,0.18)' }}>
        <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8' }}>คะแนน</div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: '#1e293b' }}>{score}</div>
      </div>
      <div style={{ flex: 1.5, backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '14px', padding: '8px', textAlign: 'center', boxShadow: '0 4px 12px -8px rgba(13,71,161,0.18)' }}>
        <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8' }}>สถานะ</div>
        <div style={{ fontSize: '11.5px', fontWeight: 800, color: statusLook.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {statusLook.text}
        </div>
      </div>
    </div>
  );

  // มือถือ: ปุ่ม START เต็มความกว้าง
  const mobileStartButton = (
    <button
      onClick={handlePressStart}
      disabled={isTimerRunning}
      className="sb-primary-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        padding: '11px',
        borderRadius: '9999px',
        border: 'none',
        fontWeight: 'bold',
        fontSize: '15px',
        cursor: isTimerRunning ? 'not-allowed' : 'pointer',
        background: isTimerRunning ? '#e2e8f0' : 'linear-gradient(135deg, #0d47a1, #1662c4)',
        color: isTimerRunning ? '#94a3b8' : '#ffffff',
        boxShadow: isTimerRunning ? 'none' : '0 6px 18px rgba(13, 71, 161, 0.35)',
        flexShrink: 0
      }}
    >
      <Play style={{ width: '18px', height: '18px', fill: isTimerRunning ? '#94a3b8' : '#ffffff' }} />
      {isTimerRunning ? 'กำลังเล่น' : 'START'}
    </button>
  );

  // มือถือ: ปุ่มไอคอนควบคุมกล้อง 4 ปุ่ม — แนวตั้งเรียงแถวเดียว แนวนอนเป็นตาราง 2x2 ในคอลัมน์ขวา
  // (ชื่อ "แสดงโครงกระดูก" ยาวเกินปุ่มที่แคบลง จึงใช้ "โครงกระดูก")
  const mobileControls = (
    <div style={isPhoneLandscape ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', flexShrink: 0 } : { display: 'flex', gap: '8px', flexShrink: 0 }}>
      <MobileControlButton
        icon={Camera}
        label={isCameraOn ? 'ปิดกล้อง' : 'เปิดกล้อง'}
        active
        variant={isCameraOn ? 'default' : 'danger'}
        onClick={toggleCamera}
        slim
      />
      <MobileControlButton
        icon={RefreshCw}
        label="สลับกล้อง"
        disabled={!isCameraOn}
        onClick={switchCamera}
        slim
      />
      <MobileControlButton
        icon={CloudFog}
        label="เบลอพื้นหลัง"
        active={isBlurBg}
        disabled={!isCameraOn}
        onClick={() => setIsBlurBg((v) => !v)}
        slim
      />
      <MobileControlButton
        icon={Bone}
        label="โครงกระดูก"
        active={isShowSkeleton}
        disabled={!isCameraOn}
        onClick={() => setIsShowSkeleton((v) => !v)}
        slim
      />
    </div>
  );

  return (
    // ไม่ใส่ padding ของตัวเอง: <main> ใน StudentDashboard ใส่ padding ไว้แล้ว ถ้าซ้อนอีกชั้นกล้องจะเล็กกว่าหน้าหลัก
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, background: 'radial-gradient(circle at 100% 0%, #f0f7ff 0%, #eaf1fb 45%)', color: '#1e293b', height: isMobileView && !isTabletPortrait && gameState !== 'playing' ? 'auto' : '100%', boxSizing: 'border-box' }}>

      <style>{`
        @keyframes sb-game-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .sb-game-fade { animation: sb-game-fade-in 0.45s ease-out; }
        @keyframes sb-pulse-ring { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } }
        .sb-pulse-dot { animation: sb-pulse-ring 1.4s ease-in-out infinite; }
        .sb-sim-btn { transition: filter 0.2s ease, transform 0.15s ease; }
        .sb-sim-btn:hover { filter: brightness(1.1); }
        .sb-sim-btn:active { transform: scale(0.96); }
        .sb-primary-btn { transition: filter 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease; }
        .sb-primary-btn:hover { filter: brightness(1.07); box-shadow: 0 6px 16px rgba(13,71,161,0.3); }
        .sb-ghost-btn { transition: background-color 0.2s ease, box-shadow 0.2s ease; }
        .sb-ghost-btn:not(:disabled):hover { background-color: #eef4fc !important; }
        .sb-result-btn:hover { filter: brightness(1.08); box-shadow: 0 8px 22px rgba(13, 71, 161, 0.4) !important; }
      `}</style>

      {/* Canvas สำหรับประมวลผลส่งเข้า Backend */}
      <canvas ref={sendCanvasRef} style={{ display: 'none' }} />

      {/* 1. หน้าเลือกโหมดการเล่น — บนมือถือ/แท็บเล็ตวางการ์ดเรียงแนวตั้งแทนแถวแนวนอน และไม่บังคับ
          จัดกึ่งกลางแนวตั้งแบบเต็มจอ (ไม่งั้นบนจอเตี้ยเนื้อหาจะโดนตัดจนกดปุ่มเริ่มเกมไม่ได้) */}
      {gameState === 'select' && (
        <div
          className="sb-game-fade"
          style={{
            flex: isMobileView ? undefined : 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: isMobileView ? 'flex-start' : 'center',
            gap: isMobileView ? '24px' : '32px',
            padding: isMobileView ? '12px 0' : 0
          }}
        >
          <style>{MODE_CARD_STYLES}</style>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: isMobileView ? '64px' : '80px', height: isMobileView ? '64px' : '80px', background: 'linear-gradient(135deg, #0d47a1 0%, #1662c4 55%, #3b8fe0 100%)', borderRadius: isMobileView ? '20px' : '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', boxShadow: '0 14px 30px -10px rgba(22, 98, 196, 0.55)', transform: 'rotate(-4deg)' }}>
              <ClipboardCheck style={{ width: isMobileView ? '30px' : '38px', height: isMobileView ? '30px' : '38px', color: '#ffffff', transform: 'rotate(4deg)' }} />
            </div>
            <PageBadge icon={Zap} text="โหมดฝึกฝน" marginBottom="10px" />
            <h2 style={{ fontSize: isMobileView ? '22px' : '30px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
              ทบทวนไวยากรณ์ภาษามือ
            </h2>
            <p style={{ fontSize: isMobileView ? '14px' : '15px', color: '#64748b', margin: '8px 0 0 0' }}>
              เลือกระดับที่ต้องการฝึกฝน แล้วทำท่าภาษามือหน้ากล้องให้ตรงกับโจทย์
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobileView ? '1fr' : 'repeat(3, minmax(0, 330px))', gap: isMobileView ? '14px' : '22px', width: isMobileView ? '100%' : undefined, maxWidth: isMobileView ? '420px' : undefined }}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff, index) => {
              const meta = difficultyMeta[diff];
              const example = difficultyExample[diff];
              return (
                <button
                  key={diff}
                  className="sb-mode-card"
                  onClick={() => handleSelectDifficulty(diff)}
                  style={{
                    ['--sb-glow' as string]: meta.glow,
                    animationDelay: `${index * 0.07}s`,
                    position: 'relative',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e3ecf7',
                    borderRadius: '24px',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px -14px rgba(13,71,161,0.22)',
                    textAlign: 'left',
                    fontFamily: 'inherit'
                  } as React.CSSProperties}
                >
                  {/* HERO: สีประจำโหมด + ระดับ (สายฟ้า 1-3) + ตัวอย่างโจทย์ที่ค่อย ๆ โผล่ทีละคำ */}
                  <div style={{ position: 'relative', overflow: 'hidden', background: meta.gradient, padding: isMobileView ? '16px 18px' : '20px 20px 18px', color: '#ffffff' }}>
                    <Zap className="sb-mode-watermark" style={{ position: 'absolute', right: '-18px', top: '-14px', width: '120px', height: '120px', color: '#ffffff', opacity: 0.16 }} />

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <Zap style={{ width: '24px', height: '24px', color: '#ffffff' }} />
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11.5px', fontWeight: 800, backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', padding: '3px 10px', borderRadius: '9999px' }}>
                        ระดับ {meta.level}
                        {[1, 2, 3].map((n) => (
                          <Zap key={n} style={{ width: '11px', height: '11px', color: '#ffffff', opacity: n <= meta.level ? 1 : 0.35, fill: n <= meta.level ? '#ffffff' : 'none' }} />
                        ))}
                      </span>
                    </div>

                    <div style={{ position: 'relative', fontSize: isMobileView ? '22px' : '24px', fontWeight: 800, lineHeight: 1.2 }}>{meta.label}</div>
                    <div style={{ position: 'relative', fontSize: '13.5px', color: 'rgba(255,255,255,0.88)', marginTop: '2px', marginBottom: '12px' }}>{meta.sub}</div>

                    <div style={{ position: 'relative', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Hand style={{ width: '12px', height: '12px' }} />
                      {diff === 'easy' ? 'ตัวอย่างโจทย์' : 'ตัวอย่างลำดับภาษามือ'}
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                      {example.map((word, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <ChevronRight className="sb-mode-chip" style={{ width: '13px', height: '13px', color: 'rgba(255,255,255,0.75)', animationDelay: `${0.2 + i * 0.16 - 0.08}s` }} />}
                          <span className="sb-mode-chip" style={{ animationDelay: `${0.2 + i * 0.16}s`, fontSize: '13px', fontWeight: 800, backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.34)', padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                            {word}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* BODY: สิ่งที่ต้องทำในโหมดนี้ + ปุ่มเริ่ม */}
                  <div style={{ padding: isMobileView ? '14px 18px 18px' : '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    {difficultyFeatures[diff].map((f) => (
                      <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 600, color: '#475569' }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '9px', backgroundColor: `${meta.color}1a`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <f.icon style={{ width: '15px', height: '15px' }} />
                        </span>
                        {f.text}
                      </div>
                    ))}

                    <div style={{ flex: 1, minHeight: '4px' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: meta.gradient, color: '#ffffff', padding: '10px 10px 10px 18px', borderRadius: '9999px', boxShadow: `0 10px 20px -10px ${meta.glow}` }}>
                      <span style={{ fontSize: '14.5px', fontWeight: 800 }}>เริ่มฝึกระดับ{meta.label}</span>
                      <span style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowRight className="sb-mode-arrow" style={{ width: '16px', height: '16px' }} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. หน้าเล่นเกมส์หลัก — บนมือถือ/แท็บเล็ตใช้ layout สแต็กแนวตั้ง + ปุ่มไอคอนย่อ
          (เหมือนหน้า Student) แทนแผงควบคุม 220px คงที่ที่ใช้งานไม่ได้บนจอแคบ */}
      {gameState === 'playing' && (isMobileView && !isTabletPortrait ? (
        // มือถือ: พอดีจอเดียวไม่ต้องเลื่อน — โจทย์/สถิติ/START/ปุ่มขนาดคงที่ กล้องยืดเต็มพื้นที่ที่เหลือ (ไม่ล็อกสัดส่วน 3:4)
        // แนวนอน: โจทย์ + กล้องซ้าย สถิติ/START/ปุ่มในคอลัมน์ขวา
        <div className="sb-game-fade" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isPhoneLandscape ? 'row' : 'column', gap: '10px' }}>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mobileSyntaxBoard}
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              {gameCameraBox}
            </div>
          </div>
          {isPhoneLandscape ? (
            <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              {mobileStats}
              {mobileStartButton}
              {mobileControls}
            </div>
          ) : (
            <>
              {mobileStats}
              {mobileStartButton}
              {mobileControls}
            </>
          )}
        </div>
      ) : isTabletPortrait ? (
        // แท็บเล็ตแนวตั้ง: กล่องชุดเดียวกับ PC — แถวบน (กระดานโจทย์ | START) เหมือน PC, กล้องยืดเต็มที่ว่าง,
        // แถวล่างเรียงกล่องในคอลัมน์ขวาของ PC เป็น 3 ช่อง ทั้งหมดพอดีจอเดียวไม่ต้องเลื่อน
        <div className="sb-game-fade" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <style>{GAME_BOX_STYLES}</style>
          <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{syntaxBoard}</div>
            <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>{startBox}</div>
          </div>

          {gameCameraBox}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <DetectionStatusBox status={detectionStatus} height={84} />
              {scoreBox}
            </div>
            {timerBox}
            {cameraControlBox}
          </div>
        </div>
      ) : (
        /* จอ desktop จริง (>1366px) คง overflow: hidden ไว้ตามเดิม เพราะสูงพอให้แผงขวาพอดีเป๊ะอยู่แล้ว
           ส่วนจอแท็บเล็ต (iPad แนวนอน) เปิด auto ไว้เป็นทางเลื่อนสำรอง กันแผงขวาโดนตัดจนกดใช้ไม่ได้ */
        <div className="sb-game-fade" style={{ flex: 1, display: 'flex', gap: '20px', overflow: isTabletView ? 'auto' : 'hidden', WebkitOverflowScrolling: 'touch' }}>

          {/* ฝั่งซ้าย: SYNTAX BOARD (ด้านบน) + WEBCAM DISPLAY (ด้านล่าง) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            {syntaxBoard}

            {/* WEBCAM DISPLAY */}
            {gameCameraBox}
          </div>

          {/* ฝั่งขวา: 5 กล่องแบบ PC — แท็บเล็ตแนวนอน (iPad) สูงไม่พอให้กล่องขนาดเต็ม จึงใช้ขนาดย่อแบบจอเตี้ย */}
          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: hideBoxHeaders ? '8px' : compactColumn ? '12px' : '16px', height: '100%', flexShrink: 0 }}>
            <style>{GAME_BOX_STYLES}</style>
            {startBox}
            {/* iPad แนวนอนใช้ช่องไฟ 8px แต่ช่องแรกต้อง 16px เท่าฝั่งซ้าย กล่องสถานะจะได้เริ่มตรงขอบบนกล้อง */}
            {hideBoxHeaders && <div style={{ flexShrink: 0 }} />}
            <DetectionStatusBox status={detectionStatus} height={hideBoxHeaders ? 48 : compactColumn ? 60 : 84} hideHeader={hideBoxHeaders} />
            {hideBoxHeaders ? (
              // iPad แนวนอน: เวลากับคะแนนวางคู่กันแถวเดียว (ไม่มีหัวข้อแล้ว) ให้ที่เหลือกับกล่องควบคุมกล้อง
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {timerBox}
                {scoreBox}
              </div>
            ) : (
              <>
                {timerBox}
                {scoreBox}
              </>
            )}
            {cameraControlBox}
          </div>

        </div>
      ))}

      {/* 3. RESULT OVERLAY */}
      {gameState === 'result' && (
        <ResultPopup
          score={score}
          pointsPerCorrect={POINTS_PER_CORRECT}
          level={difficultyMeta[difficulty].level}
          levelLabel={difficultyMeta[difficulty].label}
          timeLimit={difficultyMeta[difficulty].timeLimit}
          gradient={difficultyMeta[difficulty].gradient}
          glow={difficultyMeta[difficulty].glow}
          onReplay={() => handleSelectDifficulty(difficulty)}
          onChooseMode={() => setGameState('select')}
        />
      )}

    </div>
  );
};

export default GamePage;