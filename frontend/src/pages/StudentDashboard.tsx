import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  RefreshCw, 
  Grid, 
  Flag, 
  Hand,
  Home,
  BookOpen,
  Gamepad2,
  PlayCircle,
  StopCircle,
  RotateCcw,
  Sparkles,
  Aperture,
  History
} from 'lucide-react';

import DictionaryPage from './DictionaryPage';
import CategoryDetailPage from './CategoryDetailPage';
import WordDetailPage from './WordDetailPage';
import GamePage from './GamePage';

// ปลายทาง WebSocket ของ Python Backend (ai-engine/src/03_realtime_inference.py)
const WS_URL = 'ws://127.0.0.1:8000';
const FRAME_SEND_INTERVAL_MS = 100; // ~10 FPS

type WsStatus = 'connecting' | 'connected' | 'disconnected';

interface PredictionMessage {
  type: 'prediction';
  word: string;
  confidence: number;
  tsl_sequence: string[];
  sentence: string;
  frame: string | null;
}

export const StudentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'dict' | 'game'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isBlurBg, setIsBlurBg] = useState<boolean>(false);
  // ค่าเริ่มต้นไม่กลับด้าน (false) เพื่อให้ตรงกับภาพโหมดโครงกระดูกที่ backend ส่งกลับมา
  // (ซึ่งเป็นภาพดิบไม่กลับด้านเสมอ) ป้องกันปัญหาภาพสลับด้านกันเวลาสลับโหมด
  const [isMirrored, setIsMirrored] = useState<boolean>(false);

  // State ตรวจจับคำเดี่ยว
  const [singleWordResult, setSingleWordResult] = useState<{ word: string; confidence: number } | null>(null);
  const [previousWord, setPreviousWord] = useState<string | null>(null);

  // State ตรวจจับประโยค
  const [isRecordingSentence, setIsRecordingSentence] = useState<boolean>(false);
  const [recordedWords, setRecordedWords] = useState<string[]>([]);
  const [transformedWords, setTransformedWords] = useState<string[]>([]);

  // State การเชื่อมต่อ WebSocket กับ Python Backend
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');

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

  // สั่งงานกล้อง
  const startCamera = async (mode: 'user' | 'environment') => {
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

  const toggleSentenceRecording = () => {
    if (!isRecordingSentence) {
      setRecordedWords([]);
      setTransformedWords([]);
    }
    setIsRecordingSentence(!isRecordingSentence);
  };

  const clearSentence = () => {
    setRecordedWords([]);
    setTransformedWords([]);
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

        // อัปเดตกล่องตรวจจับคำเดี่ยว เฉพาะตอนที่คำเปลี่ยนจริง (backend ส่งข้อความทุกเฟรม
        // แม้คำจะยังไม่เปลี่ยน เพื่อคง state ไว้ให้ตรงกับฝั่ง server)
        if (data.word && data.confidence > 0 && data.word !== lastWordRef.current) {
          const previous = lastWordRef.current;
          lastWordRef.current = data.word;
          setPreviousWord(previous);
          setSingleWordResult({ word: data.word, confidence: Math.round(data.confidence * 1000) / 10 });
        }

        // กล่องตรวจจับประโยค: ผูกตรงกับ word buffer / ประโยคที่ backend จัดเรียงให้แล้ว
        setRecordedWords(Array.isArray(data.tsl_sequence) ? data.tsl_sequence : []);
        setTransformedWords(data.sentence ? data.sentence.split(' ').filter(Boolean) : []);

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

  return (
    <div style={{ backgroundColor: '#eaf1fb', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', color: '#1e293b', fontFamily: "'Noto Sans Thai', 'Sarabun', -apple-system, sans-serif", overflow: 'hidden' }}>

      {/* GLOBAL DECORATIVE STYLES */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');

        .sb-nav-item { transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease; }
        .sb-nav-item-inactive:hover { background-color: #eaf2fd !important; color: #0d47a1 !important; transform: translateX(2px); }
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
      `}</style>

      {/* TOPBAR */}
      <header style={{ background: 'linear-gradient(120deg, #0d47a1 0%, #123a80 28%, #1a5aa8 55%, #4fa3e0 82%, #6fbeef 100%)', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, boxShadow: '0 4px 16px -4px rgba(13,71,161,0.4)', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '46px', height: '46px', backgroundColor: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #bfe1f9', boxShadow: '0 0 0 3px rgba(255,255,255,0.15), 0 3px 10px rgba(0,0,0,0.15)' }}>
            <Hand style={{ width: '22px', height: '22px', color: '#0d47a1' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: 0, letterSpacing: '0.2px' }}>
              SignBridge <span style={{ fontWeight: '500', opacity: 0.85 }}>By IT-HTC</span>
            </h1>
            <p style={{ fontSize: '12px', fontWeight: '500', color: '#dbeeff', margin: '1px 0 0 0' }}>
              นวัตกรรมระบบช่วยเรียนรู้ภาษาเขียนไทยสำหรับเด็กบกพร่องทางการได้ยิน
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '9999px', padding: '6px 14px', backdropFilter: 'blur(6px)' }}>
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
          <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#ffffff' }}>
            {!isCameraOn
              ? 'กล้องปิดอยู่'
              : wsStatus === 'connected'
                ? 'ระบบพร้อมใช้งาน'
                : wsStatus === 'connecting'
                  ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์...'
                  : 'ขาดการเชื่อมต่อเซิร์ฟเวอร์'}
          </span>
        </div>
      </header>

      {/* MAIN BODY */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* SIDEBAR */}
        <aside style={{ width: '210px', background: 'linear-gradient(180deg, #ffffff 0%, #f6faff 100%)', borderRight: '1px solid #dce8f7', display: 'flex', flexDirection: 'column', padding: '16px 12px', flexShrink: 0, boxShadow: '6px 0 24px -12px rgba(13,71,161,0.18)', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0d47a1', marginBottom: '14px', padding: '0 6px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#e8f1fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Grid style={{ width: '15px', height: '15px', color: '#0d47a1' }} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '0.2px' }}>ภาพรวม</span>
          </div>

          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #dce8f7 15%, #dce8f7 85%, transparent)', margin: '0 2px 14px 2px' }} />

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {([
              { key: 'home' as const, label: 'หน้าหลัก', Icon: Home },
              { key: 'dict' as const, label: 'คลังศัพท์', Icon: BookOpen },
              { key: 'game' as const, label: 'เกมส์', Icon: Gamepad2 },
            ]).map(({ key, label, Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTab(key);
                    setSelectedCategory(null);
                    setSelectedWord(null);
                  }}
                  className={`sb-nav-item ${isActive ? 'sb-nav-item-active' : 'sb-nav-item-inactive'}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: isActive ? 'linear-gradient(135deg, #0d47a1 0%, #1662c4 100%)' : 'transparent',
                    color: isActive ? '#ffffff' : '#64748b',
                    boxShadow: isActive ? '0 4px 12px -3px rgba(13,71,161,0.4)' : 'none'
                  }}
                >
                  <span
                    className="sb-nav-icon-badge"
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#eef4fc',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <Icon style={{ width: '14px', height: '14px', color: isActive ? '#ffffff' : '#0d47a1' }} />
                  </span>
                  {label}
                </button>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          <div style={{ padding: '10px 6px 2px 6px', borderTop: '1px solid #e7effa', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#6fbeef' }} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>SignBridge · IT-HTC</span>
          </div>
        </aside>

        {/* CONTENT AREA */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'radial-gradient(circle at 100% 0%, #f0f7ff 0%, #eaf1fb 45%)', padding: '24px' }}>
          
          {/* 1. หน้าหลัก */}
          {activeTab === 'home' && (
            <div className="sb-fade-in" style={{ flex: 1, display: 'flex', gap: '20px', overflow: 'hidden' }}>
              
              {/* ฝั่งซ้าย */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
                
                {/* กล่องซ้ายบน */}
                <div style={{ height: '116px', backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', display: 'flex', alignItems: 'stretch', overflow: 'hidden', boxShadow: '0 8px 22px -12px rgba(13,71,161,0.14)', flexShrink: 0 }}>
                  
                  {!isRecordingSentence ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', gap: '16px', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#e8f1fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Aperture style={{ width: '26px', height: '26px', color: '#0d47a1' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>ผลการตรวจจับคำเดี่ยว (Single Word)</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                          {isCameraOn && singleWordResult ? (
                            <>
                              <span style={{ fontSize: '28px', fontWeight: '800', color: '#0d47a1' }}>
                                {singleWordResult.word}
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#16a34a' }}>
                                ({singleWordResult.confidence}%)
                              </span>
                            </>
                          ) : (
                            <span style={{ color: '#94a3b8', letterSpacing: '4px', fontSize: '18px', fontFamily: 'monospace' }}>
                              ------------------
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '7px', backgroundColor: '#e8f1fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Flag style={{ width: '13px', height: '13px', color: '#0d47a1' }} />
                          </div>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>ไวยากรณ์ภาษาไทย</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {transformedWords.length > 0 ? (
                            transformedWords.map((word, idx) => (
                              <React.Fragment key={idx}>
                                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#0d47a1' }}>{word}</span>
                                {idx < transformedWords.length - 1 && <span style={{ color: '#94a3b8' }}>-</span>}
                              </React.Fragment>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8', letterSpacing: '4px', fontSize: '18px', fontFamily: 'monospace' }}>
                              ------------------
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ width: '1px', background: 'linear-gradient(180deg, transparent, #dce8f7 20%, #dce8f7 80%, transparent)', flexShrink: 0 }} />

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '7px', backgroundColor: '#e8f1fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Hand style={{ width: '13px', height: '13px', color: '#0d47a1' }} />
                          </div>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>ไวยากรณ์มือภาษาไทย</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {recordedWords.length > 0 ? (
                            recordedWords.map((word, idx) => (
                              <React.Fragment key={idx}>
                                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#0d47a1' }}>{word}</span>
                                {idx < recordedWords.length - 1 && <span style={{ color: '#94a3b8' }}>-</span>}
                              </React.Fragment>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8', letterSpacing: '4px', fontSize: '18px', fontFamily: 'monospace' }}>
                              ------------------
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                </div>

                {/* Display หน้าจอกล้อง Canvas */}
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
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.5px' }}>LIVE</span>
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

              </div>

              {/* ฝั่งขวา */}
              <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
                
                {/* 1. กล่องบนสุดฝั่งขวา */}
                <div style={{ height: '116px', backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxShadow: '0 8px 22px -12px rgba(13,71,161,0.14)', flexShrink: 0, boxSizing: 'border-box' }}>
                  {!isRecordingSentence ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <History style={{ width: '14px', height: '14px', color: '#0d47a1' }} />
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>คำล่าสุด</span>
                      </div>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: isCameraOn && previousWord ? '#0d47a1' : '#cbd5e1' }}>
                        {isCameraOn && previousWord ? previousWord : '-'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <Sparkles style={{ width: '14px', height: '14px', color: '#0d47a1' }} />
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>คำที่ตรวจจับได้</span>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: recordedWords.length > 0 ? '#0d47a1' : '#94a3b8' }}>
                        {recordedWords.length > 0 ? recordedWords.join(' -> ') : 'ยังไม่มีคำสะสม'}
                      </span>
                    </>
                  )}
                </div>

                {/* 2. กล่องตรงกลางฝั่งขวา */}
                <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e3ecf7', borderRadius: '24px', padding: '16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', boxShadow: '0 8px 20px -12px rgba(13,71,161,0.16)' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.4px', padding: '0 2px' }}>ตรวจจับประโยค</span>

                  <button
                    onClick={toggleSentenceRecording}
                    disabled={!isCameraOn}
                    className="sb-primary-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '9999px',
                      fontWeight: 'bold',
                      fontSize: '13.5px',
                      border: 'none',
                      cursor: isCameraOn ? 'pointer' : 'not-allowed',
                      background: isRecordingSentence 
                        ? 'linear-gradient(135deg, #dc2626, #b91c1c)' 
                        : 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: '#ffffff',
                      boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
                      opacity: isCameraOn ? 1 : 0.4
                    }}
                  >
                    <div style={{ width: '24px', height: '24px', backgroundColor: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isRecordingSentence ? (
                        <StopCircle style={{ width: '15px', height: '15px', color: '#dc2626' }} />
                      ) : (
                        <PlayCircle style={{ width: '15px', height: '15px', color: '#16a34a' }} />
                      )}
                    </div>
                    {isRecordingSentence ? 'แปลผลประโยค' : 'เริ่มอัดประโยค'}
                  </button>

                  <button
                    onClick={clearSentence}
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
                      fontSize: '13px',
                      border: 'none',
                      cursor: isCameraOn ? 'pointer' : 'not-allowed',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      opacity: isCameraOn ? 1 : 0.4
                    }}
                  >
                    <div style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RotateCcw style={{ width: '13px', height: '13px', color: '#64748b' }} />
                    </div>
                    ล้างประโยค
                  </button>
                </div>

                {/* 3. กล่องล่างสุดฝั่งขวา */}
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

          {/* 2. หน้าคลังศัพท์ */}
          {activeTab === 'dict' && (
            selectedWord && selectedCategory ? (
              <WordDetailPage
                wordName={selectedWord}
                categoryName={selectedCategory}
                onBack={() => setSelectedWord(null)}
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

          {/* 3. หน้าเกมส์ */}
          {activeTab === 'game' && (
            <GamePage onCameraStatusChange={setIsCameraOn} />
          )}

        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;