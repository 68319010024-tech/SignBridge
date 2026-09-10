import React, { useState, useEffect, useRef } from 'react';
import { 
  Gamepad2, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Award, 
  Zap,
  Camera,
  Flag,
  Hand,
  Timer,
  Radar
} from 'lucide-react';

const WS_URL = 'ws://127.0.0.1:8000';
const FRAME_SEND_INTERVAL_MS = 100;

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

const difficultyMeta: Record<Difficulty, { label: string; sub: string; color: string; glow: string }> = {
  easy: { label: 'ง่าย', sub: 'ทดสอบคำศัพท์เดี่ยว', color: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
  medium: { label: 'ปานกลาง', sub: 'ประโยคง่ายๆ 3 คำ', color: '#f97316', glow: 'rgba(249, 115, 22, 0.3)' },
  hard: { label: 'ยาก', sub: 'ประโยคยาว 4 คำ', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)' },
};

interface GamePageProps {
  onCameraStatusChange?: (status: boolean) => void;
}

export const GamePage: React.FC<GamePageProps> = ({ onCameraStatusChange }) => {
  const [gameState, setGameState] = useState<'select' | 'playing' | 'result'>('select');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [hoveredDiff, setHoveredDiff] = useState<Difficulty | null>(null);
  
  const [questionPool, setQuestionPool] = useState<Record<Difficulty, SentenceQuestion[]>>(baseQuestionPool);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(45);
  
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
  const [wordEvent, setWordEvent] = useState<{ word: string; id: number } | null>(null);
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

  const isCameraOnRef = useRef(isCameraOn);
  const isShowSkeletonRef = useRef(isShowSkeleton);

  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
  }, [isCameraOn]);

  useEffect(() => {
    isShowSkeletonRef.current = isShowSkeleton;
    if (!isShowSkeleton) setSkeletonFrame(null);
  }, [isShowSkeleton]);

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
            ctx.filter = 'blur(20px)';
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
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
      if (selfieSegRef.current) {
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

    if (isMirrored) {
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
          setWordEvent({ word: data.word, id: data.prediction_id });
        }

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

      const ctx = sendCanvas.getContext('2d');
      if (!ctx) return;

      sendCanvas.width = video.videoWidth;
      sendCanvas.height = video.videoHeight;
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
    setTimeLeft(45);
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
    setScore((prev) => prev + 10);

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
      if (wordEvent.word === currentQ.wordOnly) {
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

    if (wordEvent.word === nextExpected) {
      const newLocked = [...currentLocked, wordEvent.word];
      lockedWordsRef.current = newLocked;
      setLockedWords(newLocked);
      if (newLocked.length === targetSeq.length) {
        handleCorrectAnswer();
      }
    }
    // ทำผิดคำ/ผิดลำดับ: ไม่ต้องทำอะไร (ไม่รีเซ็ต ไม่ตัดคะแนน) คำที่ล็อคไว้แล้วยังคงอยู่
  }, [wordEvent, isTimerRunning, lastResultStatus, difficulty, currentQ]);

  // นับเวลาถอยหลัง 45 วินาที
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', background: 'radial-gradient(circle at 100% 0%, #f0f7ff 0%, #eaf1fb 45%)', color: '#1e293b', height: '100%', boxSizing: 'border-box' }}>

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

      {/* 1. หน้าเลือกโหมดการเล่น */}
      {gameState === 'select' && (
        <div className="sb-game-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '84px', height: '84px', background: 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)', border: '2px solid #0d47a1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px auto', boxShadow: '0 8px 24px rgba(13, 71, 161, 0.2)' }}>
              <Gamepad2 style={{ width: '44px', height: '44px', color: '#0d47a1' }} />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '9999px', padding: '4px 14px', marginBottom: '10px', boxShadow: '0 4px 12px -6px rgba(13,71,161,0.18)' }}>
              <Zap style={{ width: '13px', height: '13px', color: '#0d47a1' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0d47a1' }}>โหมดฝึกฝน</span>
            </div>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
              เกมส์ทบทวนไวยากรณ์ภาษามือ
            </h2>
            <p style={{ fontSize: '16px', color: '#64748b', marginTop: '8px' }}>
              เลือกโหมดการเล่นที่ต้องการฝึกฝน
            </p>
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => {
              const meta = difficultyMeta[diff];
              const isHovered = hoveredDiff === diff;
              return (
                <button
                  key={diff}
                  onClick={() => handleSelectDifficulty(diff)}
                  onMouseEnter={() => setHoveredDiff(diff)}
                  onMouseLeave={() => setHoveredDiff(null)}
                  style={{
                    width: '208px',
                    padding: '28px 20px',
                    borderRadius: '24px',
                    border: isHovered ? `2px solid ${meta.color}` : '1px solid #e3ecf7',
                    backgroundColor: '#ffffff',
                    color: isHovered ? meta.color : '#1e293b',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.3s ease',
                    transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
                    boxShadow: isHovered ? `0 14px 30px ${meta.glow}` : '0 4px 14px rgba(13, 71, 161, 0.06)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: meta.color, opacity: isHovered ? 1 : 0.35, transition: 'opacity 0.3s ease' }} />
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: isHovered ? `${meta.color}1a` : '#f4f8fd', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.3s ease' }}>
                    <Zap style={{ width: '32px', height: '32px', color: meta.color }} />
                  </div>
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>{meta.label}</span>
                  <span style={{ fontSize: '13px', color: '#64748b', textAlign: 'center' }}>{meta.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. หน้าเล่นเกมส์หลัก */}
      {gameState === 'playing' && (
        <div className="sb-game-fade" style={{ flex: 1, display: 'flex', gap: '20px', overflow: 'hidden' }}>
          
          {/* ฝั่งซ้าย: SYNTAX BOARD (ด้านบน) + WEBCAM DISPLAY (ด้านล่าง) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            
            {/* SYNTAX BOARD */}
            <div style={{ height: '116px', backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', display: 'flex', alignItems: 'stretch', overflow: 'hidden', boxShadow: '0 8px 22px -12px rgba(13,71,161,0.14)', flexShrink: 0 }}>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '7px', backgroundColor: '#e8f1fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Flag style={{ width: '13px', height: '13px', color: '#0d47a1' }} />
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                    {difficulty === 'easy' ? 'ภาษาไทย' : 'ไวยากรณ์ภาษาไทย'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isTimerRunning ? (
                    difficulty === 'easy' ? (
                      <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0d47a1' }}>{currentQ.wordOnly}</span>
                    ) : (
                      currentQ.thaiGrammar.map((item, idx) => (
                        <React.Fragment key={idx}>
                          <span style={{ fontSize: '18px', fontWeight: 'bold', color: item.color }}>{item.word} ({getSignOrderIndex(currentQ, item.word)})</span>
                          {idx < currentQ.thaiGrammar.length - 1 && <span style={{ color: '#94a3b8' }}>-</span>}
                        </React.Fragment>
                      ))
                    )
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: 'bold' }}>กด START เพื่อเริ่มเกมส์</span>
                  )}
                </div>
              </div>

              <div style={{ width: '1px', background: 'linear-gradient(180deg, transparent, #dce8f7 20%, #dce8f7 80%, transparent)', flexShrink: 0 }} />

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '7px', backgroundColor: '#e8f1fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Hand style={{ width: '13px', height: '13px', color: '#0d47a1' }} />
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                    {difficulty === 'easy' ? 'ภาษามือไทย' : 'ไวยากรณ์มือภาษาไทย'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isTimerRunning ? (
                    difficulty === 'easy' ? (
                      <span style={{ fontSize: '20px', fontWeight: 'bold', color: wordEvent?.word ? '#0d47a1' : '#94a3b8' }}>
                        {wordEvent?.word || '------------------'}
                      </span>
                    ) : (
                      // แสดงช่องว่างตามจำนวนคำของโจทย์เสมอ (เช่น __ - __ - __) คำที่ล็อคแล้ว
                      // ขึ้นสีน้ำเงินทึบ ส่วนช่องถัดไปที่กำลังรอ ถ้ามีคำที่ AI ตรวจจับล่าสุดอยู่
                      // (ไม่ว่าจะถูกหรือผิด) จะโชว์ขึ้นมาแบบสด ๆ ให้เห็นว่าระบบกำลังเห็นอะไรอยู่
                      currentQ.signGrammar.map((_, idx) => {
                        const isLocked = idx < lockedWords.length;
                        const isLiveSlot = idx === lockedWords.length;
                        const liveWord = isLiveSlot ? wordEvent?.word : null;
                        const display = isLocked ? lockedWords[idx] : liveWord;

                        return (
                          <React.Fragment key={idx}>
                            {display ? (
                              <span
                                style={{
                                  fontSize: '18px',
                                  fontWeight: 'bold',
                                  color: isLocked ? '#0d47a1' : '#f97316',
                                }}
                              >
                                {display}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '18px', fontFamily: 'monospace' }}>__</span>
                            )}
                            {idx < currentQ.signGrammar.length - 1 && <span style={{ color: '#94a3b8' }}>-</span>}
                          </React.Fragment>
                        );
                      })
                    )
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: 'bold' }}>กด START เพื่อเริ่มเกมส์</span>
                  )}
                </div>
              </div>

            </div>

            {/* WEBCAM DISPLAY */}
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
                    กดปุ่ม START สีน้ำเงินทางขวามือเพื่อเริ่มเกมส์!
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

          </div>

          {/* ฝั่งขวา: แผงควบคุม + ปุ่ม START */}
          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', flexShrink: 0 }}>
            
            {/* BOX 1: ปุ่ม START วงกลม */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 8px 20px -12px rgba(13,71,161,0.16)' }}>
              <button
                onClick={handlePressStart}
                disabled={isTimerRunning}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: isTimerRunning ? '#e2e8f0' : 'linear-gradient(135deg, #0d47a1, #1662c4)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isTimerRunning ? 'not-allowed' : 'pointer',
                  boxShadow: isTimerRunning ? 'none' : '0 6px 18px rgba(13, 71, 161, 0.45)',
                  transition: 'transform 0.2s ease',
                  opacity: isTimerRunning ? 0.6 : 1
                }}
                onMouseEnter={(e) => !isTimerRunning && (e.currentTarget.style.transform = 'scale(1.08)')}
                onMouseLeave={(e) => !isTimerRunning && (e.currentTarget.style.transform = 'scale(1)')}
              >
                <Play style={{ width: '30px', height: '30px', color: isTimerRunning ? '#94a3b8' : '#ffffff', marginLeft: '4px', fill: isTimerRunning ? '#94a3b8' : '#ffffff' }} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: isTimerRunning ? '#94a3b8' : '#0d47a1' }}>
                {isTimerRunning ? 'กำลังเล่น' : 'START'}
              </span>
            </div>

            {/* BOX 2: สถานะการตรวจจับ ถูก / ผิด */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', boxShadow: '0 8px 20px -12px rgba(13,71,161,0.16)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Radar style={{ width: '11px', height: '11px', color: '#94a3b8' }} />
                <span style={{ fontSize: '11px', color: '#64748b' }}>สถานะการตรวจจับ</span>
              </div>
              {lastResultStatus === 'correct' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 'bold', fontSize: '14px' }}>
                  <CheckCircle2 style={{ width: '18px', height: '18px' }} />
                  <span>ถูกต้อง!</span>
                </div>
              )}
              {lastResultStatus === 'wrong' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 'bold', fontSize: '14px' }}>
                  <XCircle style={{ width: '18px', height: '18px' }} />
                  <span>ผิด! ลองใหม่</span>
                </div>
              )}
              {!lastResultStatus && (
                <span style={{ fontSize: '13px', color: isTimerRunning ? '#0d47a1' : '#64748b', fontWeight: 'bold' }}>
                  {isTimerRunning ? 'กำลังรอภาษามือ...' : 'กด START เพื่อเริ่ม'}
                </span>
              )}
            </div>

            {/* BOX 3: เวลาถอยหลัง 45 วินาที */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -12px rgba(13,71,161,0.16)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Timer style={{ width: '12px', height: '12px', color: '#94a3b8' }} />
                <span style={{ fontSize: '12px', color: '#64748b' }}>เวลาถอยหลัง</span>
              </div>
              <div style={{ width: '74px', height: '74px', borderRadius: '50%', border: `4px solid ${timeLeft <= 10 ? '#ef4444' : '#0d47a1'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 14px ${timeLeft <= 10 ? 'rgba(239,68,68,0.3)' : 'rgba(13, 71, 161, 0.2)'}`, transition: 'border-color 0.3s ease, box-shadow 0.3s ease' }}>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', lineHeight: 1 }}>
                  {timeLeft}
                </span>
                <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>วินาที</span>
              </div>
            </div>

            {/* BOX 4: คะแนนสะสม */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -12px rgba(13,71,161,0.16)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                <Award style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>คะแนนสะสม</span>
              <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e293b', marginTop: '2px' }}>
                {score}
              </span>
            </div>

            {/* BOX 5: กล่องควบคุมกล้อง */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', padding: '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px', boxShadow: '0 8px 20px -12px rgba(13,71,161,0.16)' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.4px', padding: '0 2px' }}>ควบคุมกล้อง</span>

              <button
                onClick={toggleCamera}
                className="sb-primary-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '9999px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  background: isCameraOn ? 'linear-gradient(135deg, #0d47a1, #1662c4)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#ffffff',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ width: '22px', height: '22px', backgroundColor: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera style={{ width: '13px', height: '13px', color: isCameraOn ? '#0d47a1' : '#ef4444' }} />
                </div>
                {isCameraOn ? 'เปิดกล้อง' : 'ปิดกล้อง'}
              </button>

              <button
                onClick={switchCamera}
                disabled={!isCameraOn}
                className="sb-ghost-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '9999px',
                  fontWeight: 'bold',
                  fontSize: '12.5px',
                  border: 'none',
                  cursor: isCameraOn ? 'pointer' : 'not-allowed',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  opacity: isCameraOn ? 1 : 0.4
                }}
              >
                <div style={{ width: '20px', height: '20px', border: '1px solid #cbd5e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw style={{ width: '12px', height: '12px', color: '#64748b' }} />
                </div>
                สลับกล้อง
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', color: '#334155', padding: '6px 10px', borderRadius: '9999px', fontWeight: 'bold', fontSize: '11.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => setIsBlurBg(!isBlurBg)}
                    disabled={!isCameraOn}
                    style={{
                      width: '32px',
                      height: '16px',
                      borderRadius: '9999px',
                      border: 'none',
                      padding: '2px',
                      cursor: isCameraOn ? 'pointer' : 'not-allowed',
                      backgroundColor: isBlurBg ? '#0d47a1' : '#cbd5e1',
                      opacity: isCameraOn ? 1 : 0.4,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        transform: isBlurBg ? 'translateX(16px)' : 'translateX(0px)',
                        transition: 'transform 0.3s'
                      }}
                    />
                  </button>
                  <span>เบลอพื้นหลัง</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', color: '#334155', padding: '6px 10px', borderRadius: '9999px', fontWeight: 'bold', fontSize: '11.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => setIsShowSkeleton(!isShowSkeleton)}
                    disabled={!isCameraOn}
                    style={{
                      width: '32px',
                      height: '16px',
                      borderRadius: '9999px',
                      border: 'none',
                      padding: '2px',
                      cursor: isCameraOn ? 'pointer' : 'not-allowed',
                      backgroundColor: isShowSkeleton ? '#0d47a1' : '#cbd5e1',
                      opacity: isCameraOn ? 1 : 0.4,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        transform: isShowSkeleton ? 'translateX(16px)' : 'translateX(0px)',
                        transition: 'transform 0.3s'
                      }}
                    />
                  </button>
                  <span>แสดงโครงกระดูก</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 3. RESULT OVERLAY */}
      {gameState === 'result' && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="sb-game-fade" style={{ backgroundColor: '#ffffff', border: '2px solid #0d47a1', borderRadius: '32px', padding: '36px 48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', boxShadow: '0 24px 48px rgba(13, 71, 161, 0.3)' }}>
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'linear-gradient(160deg, #fef9c3 0%, #fde68a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.35)' }}>
              <Award style={{ width: '52px', height: '52px', color: '#f59e0b' }} />
            </div>
            <h2 style={{ fontSize: '30px', fontWeight: 800, color: '#1e293b', margin: 0 }}>หมดเวลา 45 วินาที!</h2>
            <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>คะแนนรวมที่คุณทำได้ในโหมดนี้</p>
            <div style={{ fontSize: '56px', fontWeight: 800, color: '#0d47a1', lineHeight: 1 }}>
              {score} <span style={{ fontSize: '22px', fontWeight: 700, color: '#64748b' }}>แต้ม</span>
            </div>
            <button
              onClick={() => setGameState('select')}
              className="sb-result-btn"
              style={{
                background: 'linear-gradient(135deg, #0d47a1, #1662c4)',
                color: '#ffffff',
                border: 'none',
                padding: '13px 32px',
                borderRadius: '9999px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(13, 71, 161, 0.35)',
                transition: 'filter 0.2s ease, box-shadow 0.2s ease'
              }}
            >
              เลือกโหมดและเล่นใหม่
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default GamePage;