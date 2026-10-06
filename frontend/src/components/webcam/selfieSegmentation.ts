// โหลด MediaPipe Selfie Segmentation (AI ตัดพื้นหลัง ใช้ทำเบลอพื้นหลัง) แบบครั้งเดียวต่อหน้า
//
// เดิมสร้างโมเดลใหม่ทุกครั้งที่กดเปิด/ปิดเบลอหรือสลับกล้อง และโหลดตั้งแต่เปิดหน้าแม้ไม่ได้ใช้เบลอ
// ซึ่งช้ามากบน Raspberry Pi — ตอนนี้โหลดตอนกดเปิดเบลอครั้งแรก แล้วใช้ตัวเดิมต่อไป
const BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation';

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(script);
  });

export const createSelfieSegmentation = async (onResults: (results: any) => void): Promise<any> => {
  await loadScript(`${BASE_URL}/selfie_segmentation.js`);
  const SelfieSegmentation = (window as any).SelfieSegmentation;
  if (typeof SelfieSegmentation === 'undefined') throw new Error('SelfieSegmentation not available');
  const seg = new SelfieSegmentation({ locateFile: (file: string) => `${BASE_URL}/${file}` });
  seg.setOptions({ modelSelection: 1 });
  seg.onResults(onResults);
  return seg;
};
