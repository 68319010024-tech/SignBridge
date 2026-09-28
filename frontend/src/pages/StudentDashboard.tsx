import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  RefreshCw,
  Grid,
  Flag,
  Hand,
  Home,
  BookOpen,
  ClipboardCheck,
  PlayCircle,
  StopCircle,
  RotateCcw,
  Sparkles,
  Aperture,
  History,
  Menu,
  X,
  CloudFog,
  Bone,
  MessageSquareText,
  ChevronRight,
  Lightbulb
} from 'lucide-react';

import DictionaryPage from './DictionaryPage';
import CategoryDetailPage from './CategoryDetailPage';
import WordDetailPage from './WordDetailPage';
import GamePage from './GamePage';
import SentenceGroupPage from './SentenceGroupPage';
import SentenceListPage from './SentenceListPage';
import SentenceDetailPage from './SentenceDetailPage';
import { SENTENCES, type SentenceLength } from '../data/sentences';
import { wordsData } from '../data/words';
import { resolveWsUrl } from '../services/wsConfig';
import { applyNormalZoom } from '../services/cameraZoom';
import { useIsMobileView, useIsShortView, useIsTabletPortrait, useIsTabletLandscape } from '../hooks/useIsMobileView';
import { MobileControlButton } from '../components/common/MobileControlButton';
import TooCloseWarning from '../components/webcam/TooCloseWarning';
import { BoxHeader, homeCardStyle, homeWatermarkStyle, homeButtonStyle, homeButtonIconStyle, homeGhostStyle, homeGhostIconStyle } from '../components/common/BoxHeader';
import CameraControlBox from '../components/webcam/CameraControlBox';
import { BLUE_GRADIENT } from '../components/common/theme';
import DetectionStatusBox, { resolveDetectionStatus } from '../components/webcam/DetectionStatusBox';

const WS_URL = resolveWsUrl();
const FRAME_SEND_INTERVAL_MS = 100; // ~10 FPS

type WsStatus = 'connecting' | 'connected' | 'disconnected';

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
  sentence_epoch?: number;
  frame: string | null;
}

// ตัวเลขใต้ชื่อเมนูในแถบด้านข้าง (นับจากข้อมูลจริง)
const TOTAL_WORDS = Object.values(wordsData).reduce((n, words) => n + words.length, 0);
const TOTAL_SENTENCES = SENTENCES[3].length + SENTENCES[4].length;

export const StudentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'dict' | 'sentence' | 'game'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSentenceLength, setSelectedSentenceLength] = useState<SentenceLength | null>(null);
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);

  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isBlurBg, setIsBlurBg] = useState<boolean>(false);
  // ค่าเริ่มต้นไม่กลับด้าน (false) เพื่อให้ตรงกับภาพโหมดโครงกระดูกที่ backend ส่งกลับมา
  // (ซึ่งเป็นภาพดิบไม่กลับด้านเสมอ) ป้องกันปัญหาภาพสลับด้านกันเวลาสลับโหมด
  const [isMirrored, setIsMirrored] = useState<boolean>(false);

  // State ตรวจจับคำเดี่ยว
  const [singleWordResult, setSingleWordResult] = useState<{ word: string; confidence: number; id: number } | null>(null);
  const [isTooClose, setIsTooClose] = useState<boolean>(false);
  // กล่องสถานะการตรวจจับ: server กำลังเก็บท่าอยู่ไหม + ผลล่าสุดที่โชว์ค้างไว้ชั่วครู่ (สำเร็จ/ไม่ชัดเจน)
  const [isReadingSign, setIsReadingSign] = useState<boolean>(false);
  const [statusFlash, setStatusFlash] = useState<{ kind: 'detected'; word: string } | { kind: 'unsure' } | null>(null);
  const [previousWord, setPreviousWord] = useState<string | null>(null);

  // State ตรวจจับประโยค
  const [isRecordingSentence, setIsRecordingSentence] = useState<boolean>(false);
  const [recordedWords, setRecordedWords] = useState<string[]>([]);
  const [transformedWords, setTransformedWords] = useState<string[]>([]);
  // ประโยคที่แปลเสร็จรอบก่อน (กล่อง "ประโยคล่าสุด" ตอนอัดประโยค) — ประโยคปัจจุบันย้ายมาที่นี่เมื่อแสดงครบ 20 วินาที
  // (server ล้างเอง), มีประโยคใหม่มาแทน หรือกดล้าง/เริ่มอัดใหม่ ส่วน ref เก็บประโยคปัจจุบันไว้ใช้ใน callback ของ WebSocket
  const [lastSentence, setLastSentence] = useState<string[]>([]);
  const currentSentenceRef = useRef<string[]>([]);

  // State การเชื่อมต่อ WebSocket กับ Python Backend
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');

  // State ควบคุม Responsive Sidebar: จอเล็ก (มือถือ/แท็บเล็ต) ให้ซ่อน sidebar ไว้เป็นค่าเริ่มต้น
  // แล้วเปิดผ่านปุ่ม hamburger แทน
  const isMobileView = useIsMobileView();
  // จอสูงไม่เกิน 800px (เช่น 1366x768, 1280x720) ย่อกล่องคอลัมน์ขวาให้ไม่เกินขอบล่างของกล้อง
  const isShortView = useIsShortView(800);
  // iPad แนวตั้ง: ใช้ sidebar แบบมือถือ แต่หน้าหลักวางกล่องชุดเดียวกับ PC
  const isTabletPortrait = useIsTabletPortrait();
  // iPad แนวนอน: Safari มีแถบแท็บ/ที่อยู่ เหลือพื้นที่สูงราว 690px — ซ่อนหัวข้อกล่องสถานะให้คอลัมน์ขวาพอดีขอบล่างกล้อง
  const isTabletLandscape = useIsTabletLandscape();
  // กล่องประโยคล่าสุดโผล่ตอนอัดประโยค — จอเตี้ยต้องบีบปุ่มในกล่องตรวจจับประโยคให้เหลือแถวเดียว
  const compactSentenceButtons = isShortView && isRecordingSentence;
  // iPad แนวนอน: ปุ่มในกล่องตรวจจับประโยคเรียงแถวเดียวเสมอ กล่องจะเตี้ยลง ให้ที่เหลือกับกล่องควบคุมกล้อง
  const sentenceButtonsInRow = compactSentenceButtons || isTabletLandscape;
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // State แสดงโครงกระดูก (skeleton overlay) ที่ backend วาดกลับมาให้
  const [isShowSkeleton, setIsShowSkeleton] = useState<boolean>(false);
  const [skeletonFrame, setSkeletonFrame] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sendCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selfieSegRef = useRef<any>(null);
  const animFrameId = useRef<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameTickerRef = useRef<Worker | null>(null);
  const isCameraOnRef = useRef(isCameraOn);
  const isShowSkeletonRef = useRef(isShowSkeleton);
  const lastWordRef = useRef<string | null>(null);
  const lastPredictionIdRef = useRef<number>(-1);
  const lastRejectedIdRef = useRef<number>(-1);
  // รอบการล้างประโยคล่าสุดที่ server แจ้งมา และรอบขั้นต่ำที่ยอมรับข้อมูลประโยค (ดู resetSentence)
  const lastSentenceEpochRef = useRef<number>(0);
  const minSentenceEpochRef = useRef<number>(0);

  // สั่งงานกล้อง
  const startCamera = async (mode: 'user' | 'environment') => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      await applyNormalZoom(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          processSegmentationLoop();
        };
      }
      setIsCameraOn(true);
    } catch (err) {
      console.error("ไม่สามารถเข้าถึงกล้องได้:", err);
      setIsCameraOn(false);
    }
  };

  const stopCamera = () => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera(facingMode);
    }
  };

  // ปุ่มสลับกล้อง / สลับโหมด Mirror
  const switchCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setIsMirrored(!isMirrored); // สลับสถานะ Mirror
    if (isCameraOn) {
      await startCamera(nextMode);
    }
  };

  // โหลด MediaPipe ผ่าน CDN พร้อมระบบป้องกันการค้าง
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

        selfieSegmentation.setOptions({
          modelSelection: 1,
        });

        selfieSegmentation.onResults((results: any) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          canvas.width = results.image.width;
          canvas.height = results.image.height;

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // จัดการการกลับด้านกล้องหน้า (Mirror Effect)
          if (isMirrored) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }

          if (isBlurBg) {
            // 1. วาด Mask ตัวคน
            ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);

            // 2. ตัดเฉพาะตัวคนให้ชัด 100%
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

            // 3. ฉากหลังเบลอ 20px
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
      .catch((err) => console.error("MediaPipe Load Error:", err));

    return () => {
      isMounted = false;
      if (selfieSegRef.current) {
        selfieSegRef.current.close();
      }
    };
  }, [isBlurBg, isMirrored]);

  // Loop ประมวลผลภาพ (มี Fallback กันจอดำ)
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

  // ฟังก์ชันวาดวิดีโอปกติสำรองเมื่อ AI ยังไม่พร้อม
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

    if (isBlurBg) {
      ctx.filter = 'blur(16px)';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      ctx.filter = 'none';
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height / 1.7, canvas.width * 0.38, canvas.height * 0.5, 0, 0, 2 * Math.PI);
      ctx.clip();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.filter = 'none';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    ctx.restore();
  };

  // ล้างประโยคทั้งในหน้าเว็บและใน server (คำสะสม/ประโยคที่แปลแล้วอยู่ฝั่ง server และถูกส่งกลับมาทุกเฟรม
  // ถ้าล้างแค่ state ในหน้าเว็บ คำเก่าจะโผล่กลับมาทันทีในข้อความถัดไป) แล้วรับเฉพาะข้อมูลประโยคจาก
  // รอบใหม่ (sentence_epoch ที่เพิ่มขึ้นหลัง server ล้างเสร็จ) กันข้อความเก่าที่ยังค้างในท่อมาทับ
  const resetSentence = () => {
    if (currentSentenceRef.current.length > 0) setLastSentence(currentSentenceRef.current);
    currentSentenceRef.current = [];
    setRecordedWords([]);
    setTransformedWords([]);
    minSentenceEpochRef.current = lastSentenceEpochRef.current + 1;
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ command: 'reset_sentence' }));
    }
  };

  const toggleSentenceRecording = () => {
    // เริ่มอัดประโยคใหม่ต้องเริ่มจากกล่องว่างเสมอ
    if (!isRecordingSentence) resetSentence();
    setIsRecordingSentence(!isRecordingSentence);
  };

  const clearSentence = () => {
    resetSentence();
  };

  useEffect(() => {
    if (activeTab === 'home') {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab]);

  // เก็บค่าล่าสุดของ state ไว้ใน ref เพื่อให้ callback ของ WebSocket/interval
  // (ที่ตั้งค่าเพียงครั้งเดียวตอน mount) อ่านค่าปัจจุบันได้เสมอโดยไม่ต้อง reconnect
  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
  }, [isCameraOn]);

  useEffect(() => {
    isShowSkeletonRef.current = isShowSkeleton;
    if (!isShowSkeleton) setSkeletonFrame(null);
  }, [isShowSkeleton]);

  // ปิด sidebar drawer อัตโนมัติเมื่อจอขยายกลับไปเป็นโหมด desktop
  useEffect(() => {
    if (!isMobileView) setIsSidebarOpen(false);
  }, [isMobileView]);

  // เชื่อมต่อ WebSocket กับ Python Backend พร้อมระบบ auto-reconnect (exponential backoff)
  useEffect(() => {
    let isUnmounted = false;
    let reconnectDelay = 1000;
    const MAX_RECONNECT_DELAY = 10000;

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
        // session ใหม่ฝั่ง server เริ่มนับรอบประโยคจาก 0 และคำสะสมว่างอยู่แล้ว
        lastSentenceEpochRef.current = 0;
        minSentenceEpochRef.current = 0;
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

        // อัปเดตกล่องตรวจจับคำเดี่ยวทุกครั้งที่มีการทำนายใหม่จริง ๆ (prediction_id เปลี่ยน)
        // backend ส่ง word เดิมซ้ำทุกเฟรม จึงเทียบที่ตัวคำไม่ได้ — ถ้าเทียบที่คำ ผู้ใช้ทำคำเดิมซ้ำ
        // แล้วหน้าจอจะไม่ขยับเลย ส่วน id ใหม่ทำให้คำเดิมเล่นแอนิเมชันซ้ำให้รู้ว่าระบบรับท่าแล้ว
        if (
          data.word &&
          data.word !== '-' &&
          typeof data.prediction_id === 'number' &&
          data.prediction_id !== lastPredictionIdRef.current
        ) {
          lastPredictionIdRef.current = data.prediction_id;
          setPreviousWord(lastWordRef.current);
          lastWordRef.current = data.word;
          setSingleWordResult({
            word: data.word,
            confidence: Math.round(data.confidence * 1000) / 10,
            id: data.prediction_id
          });
          setStatusFlash({ kind: 'detected', word: data.word });
        }

        // จบท่าแล้วแต่ความมั่นใจต่ำ (rejected_id เพิ่ม) → บอกผู้ใช้ให้ลองใหม่ ข้อความแรกหลังเชื่อมต่อใช้เป็นค่าตั้งต้นเฉย ๆ
        if (typeof data.rejected_id === 'number') {
          if (lastRejectedIdRef.current !== -1 && data.rejected_id !== lastRejectedIdRef.current) {
            setStatusFlash({ kind: 'unsure' });
          }
          lastRejectedIdRef.current = data.rejected_id;
        }
        setIsReadingSign(data.is_recording === true);

        setIsTooClose(data.too_close === true);

        // กล่องตรวจจับประโยค: ผูกตรงกับ word buffer / ประโยคที่ backend จัดเรียงให้แล้ว
        const epoch = typeof data.sentence_epoch === 'number' ? data.sentence_epoch : 0;
        lastSentenceEpochRef.current = epoch;
        if (epoch >= minSentenceEpochRef.current) {
          setRecordedWords(Array.isArray(data.tsl_sequence) ? data.tsl_sequence : []);
          const sentenceWords = data.sentence ? data.sentence.split(' ').filter(Boolean) : [];
          const prevSentence = currentSentenceRef.current;
          if (sentenceWords.length > 0 && sentenceWords.join(' ') !== prevSentence.join(' ')) {
            if (prevSentence.length > 0) setLastSentence(prevSentence);
            currentSentenceRef.current = sentenceWords;
          } else if (sentenceWords.length === 0 && prevSentence.length > 0) {
            // server ล้างประโยคที่แสดงครบ 20 วินาทีแล้ว → ย้ายไปกล่องประโยคล่าสุด
            setLastSentence(prevSentence);
            currentSentenceRef.current = [];
          }
          setTransformedWords(sentenceWords);
        }

        // ภาพ skeleton overlay ที่ backend วาดกลับมาให้ (เมื่อเปิดใช้งาน)
        if (isShowSkeletonRef.current && data.frame) {
          setSkeletonFrame(`data:image/jpeg;base64,${data.frame}`);
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = () => {
        // เช็คก่อนเคลียร์ว่า wsRef.current ยังเป็น socket ตัวนี้อยู่จริง — ป้องกันกรณี event
        // onclose ของ socket เก่า (เช่น จาก StrictMode ที่ mount/cleanup/mount ซ้ำตอน dev)
        // มาทำงานช้า แล้วดันไปเคลียร์ wsRef.current ที่ตอนนี้ถูกตั้งเป็น socket ใหม่ (ตัวที่
        // เชื่อมต่อสำเร็จจริง) ไปแล้วโดยไม่ได้ตั้งใจ ซึ่งทำให้หน้าเว็บแสดงว่า "เชื่อมต่อแล้ว"
        // แต่ wsRef.current กลับเป็น null ทำให้ส่งเฟรมไม่ออกเลย
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        if (isUnmounted) return;
        setWsStatus('disconnected');
        setIsTooClose(false);
        setIsReadingSign(false);
        reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  // สตรีมเฟรมไปยัง Backend เป็น base64 JPEG ที่ ~10 FPS พร้อมส่งค่า showSkeleton เพื่อขอให้
  // backend วาดโครงกระดูกกลับมาด้วย
  //
  // จับภาพจาก <video> โดยตรงแทนที่จะอ่านจาก canvasRef (canvas แสดงผลที่ผ่าน Selfie
  // Segmentation) เพราะ canvasRef ถูกวาดผ่าน requestAnimationFrame ซึ่งเบราว์เซอร์จะ "หยุด"
  // สนิททันทีที่แท็บถูกซ่อน (ต่างจาก setInterval ที่แค่ถูกหน่วง) ทำให้ภาพบน canvas ค้างอยู่ที่
  // เฟรมสุดท้ายก่อนแท็บถูกซ่อน แล้วถูกส่งซ้ำเฟรมเดิมไปเรื่อย ๆ แม้ตัวจับเวลาใน Worker จะยังทำงาน
  // ปกติ ส่วน <video> เองยัง decode เฟรมสดจากกล้องต่อเนื่องได้แม้แท็บถูกซ่อน จึงจับภาพจากตรงนี้
  // แทนเพื่อให้ backend เห็นภาพสดเสมอ ไม่ว่าแท็บจะถูกซ่อนอยู่หรือไม่ (เอฟเฟกต์เบลอพื้นหลัง/กลับ
  // ด้านกระจกยังใช้ได้ปกติบน canvasRef ที่แสดงผลบนจอ เพียงแต่ภาพที่ "ส่ง" ไปตรวจจับไม่ผ่านมันแล้ว)
  useEffect(() => {
    const worker = new Worker(new URL('../workers/frameTicker.worker.ts', import.meta.url), {
      type: 'module',
    });
    frameTickerRef.current = worker;

    worker.onerror = (e) => {
      console.error('[frameTicker worker error]', e.message, e);
    };

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

      const base64 = sendCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      if (!base64) return;

      socket.send(JSON.stringify({ image: base64, showSkeleton: isShowSkeletonRef.current, page: 'student' }));
    };

    worker.postMessage({ type: 'start', intervalMs: FRAME_SEND_INTERVAL_MS });

    return () => {
      worker.postMessage({ type: 'stop' });
      worker.terminate();
      frameTickerRef.current = null;
    };
  }, []);

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
    flash: statusFlash
  });

  // กล่องแสดงภาพกล้อง (ใช้ร่วมกันทั้ง layout desktop และ mobile — มี video/canvas ref
  // ตัวเดียวกัน เปลี่ยนแค่ขนาด/ตำแหน่งของ container ที่ห่อมันตามแต่ละ layout)
  const cameraBox = (
    <div
      style={{
        flex: 1,
        backgroundColor: '#000000',
        borderRadius: '32px',
        border: isCameraOn ? '3px solid #0d47a1' : '3px solid #ef4444',
        boxShadow: isCameraOn
          ? '0 0 20px rgba(13, 71, 161, 0.3)'
          : '0 0 20px rgba(239, 68, 68, 0.5)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease-in-out'
      }}
    >
      {isCameraOn && (
        <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '9999px', padding: '6px 14px', zIndex: 3, backdropFilter: 'blur(4px)' }}>
          <span className="sb-live-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.5px' }}>กำลังเปิดกล้อง</span>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: 'none' }}
      />

      {/* Canvas ซ่อนไว้สำหรับจับภาพจาก video ส่งเข้า Backend โดยตรง (ไม่ผ่าน rAF) */}
      <canvas ref={sendCanvasRef} style={{ display: 'none' }} />

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
            zIndex: 2
          }}
        />
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
    </div>
  );

  // กล่องผลคำเดี่ยว / ผลประโยค (ตอนอัดประโยค) — ซ้ายบนของ PC
  const resultBox = (
    <div style={{ ...homeCardStyle, height: '116px', display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
      <Hand style={{ ...homeWatermarkStyle, width: '130px', height: '130px', right: '-20px', top: '-18px' }} />

      {!isRecordingSentence ? (
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', gap: '18px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: BLUE_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px -10px rgba(22,98,196,0.7)', flexShrink: 0 }}>
            <Aperture style={{ width: '28px', height: '28px', color: '#ffffff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#64748b' }}>ผลการตรวจจับคำเดี่ยว (Single Word)</span>
            {isCameraOn && singleWordResult ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span key={singleWordResult.id} className="sb-word-pop" style={{ fontSize: '30px', fontWeight: 800, color: '#0d47a1', lineHeight: 1.2 }}>
                  {singleWordResult.word}
                </span>
                {/* แถบความมั่นใจ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a' }}>ความมั่นใจ {singleWordResult.confidence}%</span>
                  <div style={{ height: '6px', borderRadius: '9999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{ width: `${singleWordResult.confidence}%`, height: '100%', borderRadius: '9999px', background: 'linear-gradient(90deg, #22c55e, #16a34a)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', lineHeight: '36px' }}>ทำท่าภาษามือหน้ากล้องเพื่อเริ่มตรวจจับ</span>
            )}
          </div>
        </div>
      ) : (
        <>
          {[
            { icon: Flag, title: 'ไวยากรณ์ภาษาไทย', words: transformedWords },
            { icon: Hand, title: 'ไวยากรณ์ภาษามือไทย', words: recordedWords },
          ].map((col, colIndex) => (
            <React.Fragment key={col.title}>
              {colIndex > 0 && <div style={{ width: '1px', background: 'linear-gradient(180deg, transparent, #dce8f7 20%, #dce8f7 80%, transparent)', flexShrink: 0 }} />}
              <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '14px 18px', minWidth: 0 }}>
                <BoxHeader icon={col.icon} title={col.title} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {col.words.length > 0 ? (
                    col.words.map((word, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <ChevronRight style={{ width: '14px', height: '14px', color: '#94a3b8' }} />}
                        <span style={{ fontSize: '16px', fontWeight: 800, color: '#0d47a1', backgroundColor: '#eef4fc', padding: '3px 12px', borderRadius: '10px' }}>{word}</span>
                      </React.Fragment>
                    ))
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8' }}>ยังไม่มีคำ</span>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );

  // กล่องคำล่าสุด / คำที่สะสมตอนอัดประโยค — ขวาบนของ PC
  const lastWordBox = (
    <div style={{ ...homeCardStyle, height: '116px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '6px', textAlign: 'center', flexShrink: 0 }}>
      {!isRecordingSentence ? (
        <>
          <History style={{ ...homeWatermarkStyle, width: '84px', height: '84px', right: '-14px', top: '-14px' }} />
          <BoxHeader icon={History} title="คำล่าสุด" />
          <span style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, color: isCameraOn && previousWord ? '#0d47a1' : '#cbd5e1', lineHeight: 1.2 }}>
            {isCameraOn && previousWord ? previousWord : '-'}
          </span>
        </>
      ) : (
        <>
          <Sparkles style={{ ...homeWatermarkStyle, width: '84px', height: '84px', right: '-14px', top: '-14px' }} />
          <BoxHeader icon={Sparkles} title="คำที่ตรวจจับได้" />
          <span style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: recordedWords.length > 0 ? '#0d47a1' : '#94a3b8' }}>
            {recordedWords.length > 0 ? recordedWords.join(' › ') : 'ยังไม่มีคำสะสม'}
          </span>
        </>
      )}
    </div>
  );

  // กล่องประโยคล่าสุด (เฉพาะโหมดอัดประโยค) — ความสูงคงที่แบบกล่องสถานะ กล่องตรวจจับประโยค/ควบคุมกล้อง
  // ด้านล่างเป็น flex:1 จึงหดให้เอง คอลัมน์ขวาจึงยังจบตรงขอบล่างกล้อง
  const lastSentenceBox = isRecordingSentence && (
    <div style={{ ...homeCardStyle, height: isTabletLandscape ? '54px' : isShortView ? '60px' : '84px', padding: isShortView ? '4px 12px' : '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isShortView ? '3px' : '6px', flexShrink: 0 }}>
      <MessageSquareText style={{ ...homeWatermarkStyle, width: '70px', height: '70px', right: '-12px', top: '-12px' }} />
      <BoxHeader icon={History} title="ประโยคล่าสุด" size={isShortView ? 'sm' : 'md'} />
      <span
        key={lastSentence.join(' ')}
        className="sb-word-pop"
        title={lastSentence.join(' ')}
        style={{ position: 'relative', alignSelf: 'center', maxWidth: '100%', fontSize: isShortView ? '13px' : '14px', fontWeight: 800, color: lastSentence.length > 0 ? '#0d47a1' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {lastSentence.length > 0 ? lastSentence.join(' ') : 'ยังไม่มีประโยค'}
      </span>
    </div>
  );

  // กล่องตรวจจับประโยค
  const sentenceBox = (
    <div style={{ ...homeCardStyle, flex: isTabletLandscape ? '0 0 auto' : 1, minHeight: 'min-content', padding: isTabletLandscape ? '10px 14px' : isShortView ? '12px 14px' : '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isTabletLandscape ? '6px' : isShortView ? '8px' : '12px' }}>
      <MessageSquareText style={{ ...homeWatermarkStyle, width: '96px', height: '96px', right: '-18px', top: '-16px' }} />
      <BoxHeader icon={MessageSquareText} title="ตรวจจับประโยค" size={isShortView ? 'sm' : 'md'} />

      {/* จอเตี้ยตอนอัดประโยค (มีกล่องประโยคล่าสุดเพิ่มมา): วางสองปุ่มเรียงแถวเดียวให้คอลัมน์ไม่เกินขอบกล้อง */}
      <div style={{ display: 'flex', flexDirection: sentenceButtonsInRow ? 'row' : 'column', gap: sentenceButtonsInRow ? '6px' : (isShortView ? '8px' : '12px') }}>
      <button
        onClick={toggleSentenceRecording}
        disabled={!isCameraOn}
        className="sb-primary-btn"
        style={{
          ...homeButtonStyle,
          padding: sentenceButtonsInRow ? '7px 8px' : '10px 12px',
          fontSize: sentenceButtonsInRow ? '12.5px' : '13.5px',
          gap: sentenceButtonsInRow ? '5px' : '8px',
          flex: sentenceButtonsInRow ? 1 : undefined,
          minWidth: 0,
          cursor: isCameraOn ? 'pointer' : 'not-allowed',
          background: isRecordingSentence
            ? 'linear-gradient(135deg, #b91c1c, #ef4444)'
            : 'linear-gradient(135deg, #15803d, #22c55e)',
          color: '#ffffff',
          boxShadow: isRecordingSentence ? '0 8px 18px -8px rgba(220,38,38,0.6)' : '0 8px 18px -8px rgba(22,163,74,0.6)',
          opacity: isCameraOn ? 1 : 0.4
        }}
      >
        <span style={{ ...homeButtonIconStyle, backgroundColor: 'rgba(255,255,255,0.22)' }}>
          {isRecordingSentence ? (
            <StopCircle style={{ width: '15px', height: '15px', color: '#ffffff' }} />
          ) : (
            <PlayCircle style={{ width: '15px', height: '15px', color: '#ffffff' }} />
          )}
        </span>
        {isRecordingSentence ? (sentenceButtonsInRow ? 'แปลผล' : 'แปลผลประโยค') : (sentenceButtonsInRow ? 'เริ่มอัด' : 'เริ่มอัดประโยค')}
      </button>

      <button
        onClick={clearSentence}
        disabled={!isCameraOn}
        className="sb-ghost-btn"
        style={{
          ...homeButtonStyle,
          ...homeGhostStyle,
          padding: sentenceButtonsInRow ? '6px 8px' : homeGhostStyle.padding,
          fontSize: sentenceButtonsInRow ? '12.5px' : '13px',
          gap: sentenceButtonsInRow ? '5px' : '8px',
          flex: sentenceButtonsInRow ? 1 : undefined,
          minWidth: 0,
          cursor: isCameraOn ? 'pointer' : 'not-allowed',
          opacity: isCameraOn ? 1 : 0.4
        }}
      >
        <span style={homeGhostIconStyle}>
          <RotateCcw style={{ width: '13px', height: '13px', color: '#0d47a1' }} />
        </span>
        {sentenceButtonsInRow ? 'ล้าง' : 'ล้างประโยค'}
      </button>
      </div>
    </div>
  );

  // กล่องควบคุมกล้อง (component เดียวกับหน้าโหมดฝึกฝน)
  const cameraControlBox = (
    <CameraControlBox
      isCameraOn={isCameraOn}
      onToggleCamera={toggleCamera}
      onSwitchCamera={switchCamera}
      isBlurBg={isBlurBg}
      onToggleBlur={() => setIsBlurBg(!isBlurBg)}
      isShowSkeleton={isShowSkeleton}
      onToggleSkeleton={() => setIsShowSkeleton(!isShowSkeleton)}
      compact={isShortView}
      grow={isTabletLandscape}
    />
  );

  return (
    // ใช้ 100dvh แทน 100vh: บน iPad/iPhone Safari, 100vh คำนวณจากความสูงจอสูงสุด (เหมือน address
    // bar ถูกซ่อนอยู่เสมอ) ซึ่งสูงกว่าพื้นที่แสดงผลจริงเวลามี address bar/toolbar โผล่มา ทำให้ layout
    // ที่ตั้งใจให้พอดีจอเป๊ะ (overflow: hidden ไม่มี scroll) มีส่วนล่างเกินจอจริงไปโดยไม่มีทางเลื่อนไปดูได้
    // 100dvh คำนวณจากพื้นที่แสดงผลที่มองเห็นจริง ณ ขณะนั้น จึงพอดีจอเสมอ
    <div style={{ backgroundColor: '#eaf1fb', width: '100vw', height: '100dvh', display: 'flex', flexDirection: 'column', color: '#1e293b', fontFamily: "'Noto Sans Thai', 'Sarabun', -apple-system, sans-serif", overflow: 'hidden' }}>

      {/* GLOBAL DECORATIVE STYLES */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');

        .sb-nav-item { transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease; }
        .sb-topbar { background: linear-gradient(120deg, #0d47a1 0%, #123a80 28%, #1a5aa8 55%, #4fa3e0 82%, #6fbeef 100%); }
        .sb-topbar > * { position: relative; }
        .sb-topbar > .sb-topbar-orb, .sb-topbar > .sb-topbar-shine { position: absolute; }
        .sb-topbar-orb { border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.18), rgba(255,255,255,0) 70%); pointer-events: none; animation: sb-topbar-orb 10s ease-in-out infinite; }
        @keyframes sb-topbar-orb { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(40px, 18px); } }
        .sb-topbar-shine { top: 0; bottom: 0; width: 180px; left: -200px; background: linear-gradient(100deg, transparent, rgba(255,255,255,0.16), transparent); pointer-events: none; animation: sb-topbar-shine 7s ease-in-out infinite; }
        @keyframes sb-topbar-shine { 0% { left: -200px; } 45%, 100% { left: 110%; } }
        .sb-topbar-ring { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, #ffffff, #6fbeef, #bfe1f9, #ffffff); animation: sb-topbar-spin 6s linear infinite; opacity: 0.9; }
        @keyframes sb-topbar-spin { to { transform: rotate(360deg); } }
        .sb-topbar-wave { transform-origin: 70% 80%; animation: sb-topbar-wave 5s ease-in-out infinite; }
        @keyframes sb-topbar-wave { 0%, 76%, 100% { transform: rotate(0deg); } 80% { transform: rotate(16deg); } 84% { transform: rotate(-10deg); } 88% { transform: rotate(14deg); } 92% { transform: rotate(-6deg); } }
        @media (prefers-reduced-motion: reduce) { .sb-topbar-orb, .sb-topbar-shine, .sb-topbar-ring, .sb-topbar-wave { animation: none !important; } }
        .sb-nav-item { outline: none; }
        .sb-nav-item:focus-visible { box-shadow: 0 0 0 3px rgba(22,98,196,0.35) !important; }
        .sb-nav-item-inactive:hover { background-color: #ffffff !important; border-color: #e3ecf7 !important; box-shadow: 0 8px 18px -12px rgba(13,71,161,0.35) !important; transform: translateX(3px); }
        .sb-nav-item-inactive:hover .sb-nav-icon-badge { background-color: #dbeafe !important; }

        .sb-primary-btn { transition: filter 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease; }
        .sb-primary-btn:hover { filter: brightness(1.07); box-shadow: 0 6px 16px rgba(13,71,161,0.3); }
        .sb-primary-btn:active { transform: scale(0.98); }

        .sb-ghost-btn { transition: background-color 0.2s ease, box-shadow 0.2s ease; }
        .sb-ghost-btn:not(:disabled):hover { background-color: #eef4fc !important; }

        .sb-scroll::-webkit-scrollbar { width: 8px; }
        .sb-scroll::-webkit-scrollbar-track { background: transparent; }
        .sb-scroll::-webkit-scrollbar-thumb { background: #c7dbf5; border-radius: 10px; }
        .sb-scroll::-webkit-scrollbar-thumb:hover { background: #9cc0ea; }

        @keyframes sb-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(1.25); } }
        .sb-live-dot { animation: sb-pulse 1.6s ease-in-out infinite; }

        @keyframes sb-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .sb-fade-in { animation: sb-fade-in 0.45s ease-out; }

        @keyframes sb-word-pop { 0% { transform: scale(0.85); opacity: 0.4; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
        .sb-word-pop { display: inline-block; animation: sb-word-pop 0.4s ease-out; }
      `}</style>

      {/* TOPBAR */}
      <header className="sb-topbar" style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, boxShadow: '0 4px 16px -4px rgba(13,71,161,0.4)', position: 'relative', zIndex: 2, overflow: 'hidden' }}>
        <span className="sb-topbar-orb" style={{ width: '220px', height: '220px', left: '32%', top: '-150px' }} />
        <span className="sb-topbar-orb" style={{ width: '160px', height: '160px', right: '14%', top: '-40px', animationDelay: '-4s' }} />
        <span className="sb-topbar-shine" />
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45) 30%, rgba(255,255,255,0.45) 70%, transparent)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {isMobileView && (
            <button
              onClick={() => setIsSidebarOpen((open) => !open)}
              aria-label={isSidebarOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              style={{
                width: '38px',
                height: '38px',
                flexShrink: 0,
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.3)',
                backgroundColor: 'rgba(255,255,255,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {isSidebarOpen ? (
                <X style={{ width: '20px', height: '20px', color: '#ffffff' }} />
              ) : (
                <Menu style={{ width: '20px', height: '20px', color: '#ffffff' }} />
              )}
            </button>
          )}
          <div style={{ position: 'relative', width: '50px', height: '50px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="sb-topbar-ring" />
            <div style={{ position: 'relative', width: '44px', height: '44px', backgroundColor: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,0,0,0.18)' }}>
              <Hand className="sb-topbar-wave" style={{ width: '22px', height: '22px', color: '#0d47a1' }} />
            </div>
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: 0, letterSpacing: '0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              SignBridge <span style={{ fontWeight: '500', opacity: 0.85 }}>By IT-HTC</span>
            </h1>
            <p style={{ fontSize: '12px', fontWeight: '500', color: '#dbeeff', margin: '1px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              นวัตกรรมระบบช่วยเรียนรู้ภาษาเขียนไทยสำหรับเด็กบกพร่องทางการได้ยิน
            </p>
          </div>
        </div>

        {/* บนจอมือถือ/แท็บเล็ตย่อเหลือแค่จุดสี ไม่ใส่ข้อความ เพราะพื้นที่แคบจนไปทับชื่อแอพ */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '9999px', padding: isMobileView ? '8px' : '6px 14px', backdropFilter: 'blur(6px)', flexShrink: 0 }}>
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: isCameraOn && wsStatus === 'connected' ? '#4ade80' : '#f87171',
              boxShadow: isCameraOn && wsStatus === 'connected' ? '0 0 8px #4ade80' : '0 0 8px #f87171'
            }}
            className={isCameraOn && wsStatus === 'connected' ? 'sb-live-dot' : ''}
          />
          {!isMobileView && (
            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#ffffff', whiteSpace: 'nowrap' }}>
              {!isCameraOn
                ? 'กล้องปิดอยู่'
                : wsStatus === 'connected'
                  ? 'ระบบพร้อมใช้งาน'
                  : wsStatus === 'connecting'
                    ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์...'
                    : 'ขาดการเชื่อมต่อเซิร์ฟเวอร์'}
            </span>
          )}
        </div>
      </header>

      {/* MAIN BODY */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* SIDEBAR BACKDROP (เฉพาะโหมด mobile ตอนเปิดเมนู) */}
        {isMobileView && isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            style={{ position: 'fixed', top: '72px', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)', zIndex: 39 }}
          />
        )}

        {/* SIDEBAR */}
        <aside
          style={{
            width: '210px',
            background: 'linear-gradient(180deg, #ffffff 0%, #f6faff 100%)',
            borderRight: '1px solid #dce8f7',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 12px',
            flexShrink: 0,
            boxShadow: isMobileView ? '8px 0 24px -8px rgba(13,71,161,0.3)' : '6px 0 24px -12px rgba(13,71,161,0.18)',
            position: isMobileView ? 'fixed' : 'relative',
            top: isMobileView ? '72px' : undefined,
            left: 0,
            height: isMobileView ? 'calc(100dvh - 72px)' : undefined,
            transform: isMobileView ? (isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
            transition: isMobileView ? 'transform 0.25s ease' : undefined,
            zIndex: 40
          }}
        >
          <div style={{ padding: '2px 6px', marginBottom: '14px' }}>
            <BoxHeader icon={Grid} title="ภาพรวม" />
          </div>

          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #dce8f7 15%, #dce8f7 85%, transparent)', margin: '0 2px 14px 2px' }} />

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {([
              { key: 'home' as const, label: 'หน้าหลัก', sub: 'แปลภาษามือสด', Icon: Home },
              { key: 'dict' as const, label: 'คลังศัพท์', sub: `${TOTAL_WORDS} คำ · ${Object.keys(wordsData).length} หมวด`, Icon: BookOpen },
              { key: 'sentence' as const, label: 'ตัวอย่างประโยค', sub: `${TOTAL_SENTENCES} ประโยค`, Icon: MessageSquareText },
              { key: 'game' as const, label: 'โหมดฝึกฝน', sub: '3 ระดับ · จับเวลา', Icon: ClipboardCheck },
            ]).map(({ key, label, sub, Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTab(key);
                    setSelectedCategory(null);
                    setSelectedWord(null);
                    setSelectedSentenceLength(null);
                    setSelectedSentenceId(null);
                    if (isMobileView) setIsSidebarOpen(false);
                  }}
                  className={`sb-nav-item ${isActive ? 'sb-nav-item-active' : 'sb-nav-item-inactive'}`}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px 8px 8px',
                    borderRadius: '16px',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    background: isActive ? BLUE_GRADIENT : 'transparent',
                    boxShadow: isActive ? '0 10px 20px -10px rgba(22,98,196,0.75)' : 'none'
                  }}
                >
                  <span
                    className="sb-nav-icon-badge"
                    style={{
                      position: 'relative',
                      width: '34px',
                      height: '34px',
                      borderRadius: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#eef4fc',
                      border: isActive ? '1px solid rgba(255,255,255,0.35)' : '1px solid #e3ecf7',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <Icon style={{ width: '17px', height: '17px', color: isActive ? '#ffffff' : '#0d47a1' }} />
                  </span>
                  <span style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: isActive ? '#ffffff' : '#334155', whiteSpace: 'nowrap' }}>{label}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: isActive ? 'rgba(255,255,255,0.8)' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
                  </span>
                  {isActive && <ChevronRight style={{ position: 'relative', width: '16px', height: '16px', color: '#ffffff', flexShrink: 0 }} />}
                </button>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          {/* เคล็ดลับการวางตัวหน้ากล้อง — สาเหตุหลักที่ AI ทายผิดคือนั่งใกล้กล้องเกินไป */}
          <div style={{ ...homeCardStyle, borderRadius: '18px', padding: '12px', marginBottom: '12px', background: 'linear-gradient(160deg, #ffffff 0%, #eef5ff 100%)' }}>
            <Lightbulb style={{ ...homeWatermarkStyle, width: '64px', height: '64px', right: '-12px', top: '-10px', opacity: 0.07 }} />
            <BoxHeader icon={Lightbulb} title="เคล็ดลับ" size="sm" />
            <p style={{ position: 'relative', margin: '8px 0 0 0', fontSize: '11.5px', fontWeight: 600, color: '#475569', lineHeight: 1.5 }}>
              ให้เห็นศีรษะถึงช่วงอก และทำมือที่ระดับอก AI จะอ่านท่าได้แม่นยำขึ้น
            </p>
          </div>

          <div style={{ padding: '10px 6px 2px 6px', borderTop: '1px solid #e7effa', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: BLUE_GRADIENT }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>SignBridge · IT-HTC</span>
          </div>
        </aside>

        {/* CONTENT AREA */}
        {/* overflow: 'auto' เสมอ (ไม่ใช่แค่ตอน isMobileView) ไว้เป็นทางเลื่อนสำรอง — ตอนเนื้อหาพอดี
            จอ auto จะไม่โชว์ scrollbar เลยไม่ต่างจาก hidden แต่ถ้าจอไหนเนื้อหาเกิน (เช่น แท็บเล็ตขนาด
            กลางที่ grid คำศัพท์ยังยัดไม่พอ) จะเลื่อนดูได้แทนที่จะถูกตัดจนมองไม่เห็นเฉยๆ */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', WebkitOverflowScrolling: 'touch', background: 'radial-gradient(circle at 100% 0%, #f0f7ff 0%, #eaf1fb 45%)', padding: isTabletPortrait ? '16px' : isMobileView ? '12px' : '24px' }}>

          {/* 1. หน้าหลัก */}
          {activeTab === 'home' && (isMobileView && !isTabletPortrait ? (
            // ไม่ใส่ flex:1/minHeight:0 ที่นี่โดยตั้งใจ: ให้ความสูงคำนวณจาก content จริง แล้วปล่อยให้
            // <main> ด้านบน (ซึ่งตั้ง overflow:auto ไว้แล้ว) เป็นตัวเลื่อนเพียงจุดเดียว ถ้าตั้ง flex:1
            // + minHeight:0 ตรงนี้ด้วย จะกลายเป็นบีบอัด content ให้พอดีกรอบแทนการล้นแล้วเลื่อนดูได้
            <div className="sb-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* กล่องสถานะผลตรวจจับ (ย่อ) */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '18px', padding: '12px 14px', flexShrink: 0, boxShadow: '0 6px 16px -10px rgba(13,71,161,0.16)' }}>
                {!isRecordingSentence ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>คำเดี่ยว (Single Word)</span>
                      {isCameraOn && previousWord && (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#94a3b8' }}>
                          ล่าสุด: <span style={{ color: '#64748b' }}>{previousWord}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px' }}>
                      {isCameraOn && singleWordResult ? (
                        <>
                          <span key={singleWordResult.id} className="sb-word-pop" style={{ fontSize: '22px', fontWeight: '800', color: '#0d47a1' }}>{singleWordResult.word}</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#16a34a' }}>({singleWordResult.confidence}%)</span>
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8', letterSpacing: '3px', fontSize: '15px', fontFamily: 'monospace' }}>--------</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Flag style={{ width: '12px', height: '12px', color: '#0d47a1', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', flexShrink: 0 }}>ไวยากรณ์ไทย:</span>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: transformedWords.length > 0 ? '#0d47a1' : '#94a3b8' }}>
                        {transformedWords.length > 0 ? transformedWords.join(' - ') : '-'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Hand style={{ width: '12px', height: '12px', color: '#0d47a1', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', flexShrink: 0 }}>ไวยากรณ์มือ:</span>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: recordedWords.length > 0 ? '#0d47a1' : '#94a3b8' }}>
                        {recordedWords.length > 0 ? recordedWords.join(' - ') : '-'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* กล่องแสดงภาพกล้อง: ใช้ aspect-ratio แทน flex:1 เพื่อให้ความสูงรวมของหน้าคำนวณได้แน่นอน
                  (ไม่งั้นทั้งกล่องนี้และ toolbar ด้านล่างจะแย่งพื้นที่กันจนบางส่วนหลุดจอ) */}
              <div style={{ width: '100%', aspectRatio: '3 / 4', display: 'flex', flexShrink: 0 }}>
                {cameraBox}
              </div>

              {/* แถบไอคอนควบคุม: แตะไอคอนเพื่อสั่งงานฟังก์ชันนั้นทันที (แทนการ์ดเต็มจอที่เบียดกันบนมือถือ) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
                <MobileControlButton
                  icon={Camera}
                  label={isCameraOn ? 'ปิดกล้อง' : 'เปิดกล้อง'}
                  active
                  variant={isCameraOn ? 'default' : 'danger'}
                  onClick={toggleCamera}
                />
                <MobileControlButton
                  icon={RefreshCw}
                  label="สลับกล้อง"
                  disabled={!isCameraOn}
                  onClick={switchCamera}
                />
                <MobileControlButton
                  icon={isRecordingSentence ? StopCircle : PlayCircle}
                  label={isRecordingSentence ? 'แปลผลประโยค' : 'เริ่มอัดประโยค'}
                  active
                  variant={isRecordingSentence ? 'danger' : 'success'}
                  disabled={!isCameraOn}
                  onClick={toggleSentenceRecording}
                />
                <MobileControlButton
                  icon={RotateCcw}
                  label="ล้างประโยค"
                  disabled={!isCameraOn}
                  onClick={clearSentence}
                />
                <MobileControlButton
                  icon={CloudFog}
                  label="เบลอพื้นหลัง"
                  active={isBlurBg}
                  disabled={!isCameraOn}
                  onClick={() => setIsBlurBg((v) => !v)}
                />
                <MobileControlButton
                  icon={Bone}
                  label="แสดงโครงกระดูก"
                  active={isShowSkeleton}
                  disabled={!isCameraOn}
                  onClick={() => setIsShowSkeleton((v) => !v)}
                />
              </div>
            </div>
          ) : isTabletPortrait ? (
            // แท็บเล็ตแนวตั้ง: กล่องชุดเดียวกับ PC — แถวบน (ผลตรวจจับ | คำล่าสุด) เหมือน PC, กล้องยืดเต็มที่ว่าง,
            // แถวล่างเรียงกล่องในคอลัมน์ขวาของ PC เป็น 3 ช่อง ทั้งหมดพอดีจอเดียวไม่ต้องเลื่อน
            <div className="sb-fade-in" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{resultBox}</div>
                <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>{lastWordBox}</div>
              </div>

              {cameraBox}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {lastSentenceBox}
                  <DetectionStatusBox status={detectionStatus} />
                </div>
                {sentenceBox}
                {cameraControlBox}
              </div>
            </div>
          ) : (
            <div className="sb-fade-in" style={{ flex: 1, display: 'flex', gap: '20px', overflow: 'hidden' }}>

              {/* ฝั่งซ้าย */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
                {resultBox}

                {/* Display หน้าจอกล้อง Canvas */}
                {cameraBox}
              </div>

              {/* ฝั่งขวา */}
              <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: isTabletLandscape ? '8px' : isShortView ? '12px' : '16px', flexShrink: 0 }}>
                {lastWordBox}
                {/* iPad แนวนอนใช้ช่องไฟ 8px แต่ช่องแรกต้อง 16px เท่าฝั่งซ้าย กล่องถัดไปจะได้เริ่มตรงขอบบนกล้อง */}
                {isTabletLandscape && <div style={{ flexShrink: 0 }} />}
                {lastSentenceBox}

                {/* กล่องสถานะการตรวจจับ — ความสูงคงที่ กล่องด้านล่างเป็น flex:1 จึงหดให้เอง
                    ขอบล่างของคอลัมน์ขวายังตรงกับขอบล่างกล้องพอดี */}
                <DetectionStatusBox status={detectionStatus} height={isTabletLandscape ? 48 : isShortView ? 60 : 84} hideHeader={isTabletLandscape} />
                {sentenceBox}
                {cameraControlBox}
              </div>

            </div>
          ))}

          {/* 2. หน้าคลังศัพท์ */}
          {activeTab === 'dict' && (
            selectedWord && selectedCategory ? (
              <WordDetailPage
                wordName={selectedWord}
                categoryName={selectedCategory}
                onBack={() => setSelectedWord(null)}
                onOpenSentence={(length, id) => {
                  setActiveTab('sentence');
                  setSelectedSentenceLength(length);
                  setSelectedSentenceId(id);
                }}
              />
            ) : selectedCategory ? (
              <CategoryDetailPage
                categoryName={selectedCategory}
                onBack={() => setSelectedCategory(null)}
                onSelectWord={(word) => setSelectedWord(word)}
              />
            ) : (
              <DictionaryPage onSelectCategory={(category) => setSelectedCategory(category)} />
            )
          )}

          {/* 3. หน้าตัวอย่างประโยค: เลือกกลุ่ม 3/4 คำ → เลือกประโยค → วิดีโอ + ไวยากรณ์ */}
          {activeTab === 'sentence' && (
            selectedSentenceLength && selectedSentenceId ? (
              <SentenceDetailPage
                length={selectedSentenceLength}
                sentenceId={selectedSentenceId}
                onBack={() => setSelectedSentenceId(null)}
              />
            ) : selectedSentenceLength ? (
              <SentenceListPage
                length={selectedSentenceLength}
                onBack={() => setSelectedSentenceLength(null)}
                onSelectSentence={(id) => setSelectedSentenceId(id)}
              />
            ) : (
              <SentenceGroupPage onSelectLength={(length) => setSelectedSentenceLength(length)} />
            )
          )}

          {/* 4. หน้าทบทวนไวยากรณ์ (GamePage — เกมจริงจะแยกทำเป็นเมนูใหม่ภายหลัง) */}
          {activeTab === 'game' && (
            <GamePage onCameraStatusChange={setIsCameraOn} />
          )}

        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;