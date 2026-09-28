// วาดภาพแบบเบลอลงบน canvas (ใช้ทำพื้นหลังเบลอ)
// Safari บน iPhone/iPad ไม่รองรับ ctx.filter — ตั้งค่าแล้วไม่มีผลอะไร ภาพจึงไม่เบลอเลย (Chrome/Android รองรับ)
// เบราว์เซอร์ที่ไม่รองรับจึงใช้วิธีสำรอง: ย่อภาพลงเล็กมากแล้วขยายกลับ การปรับภาพให้เรียบ (image smoothing)
// ตอนขยายจะทำให้ภาพเบลอแทน
const supportsCanvasFilter =
  typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

let smallCanvas: HTMLCanvasElement | null = null;

export const drawBlurredImage = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
  radius: number
) => {
  if (supportsCanvasFilter) {
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(image, 0, 0, width, height);
    ctx.filter = 'none';
    return;
  }

  // ย่อลงราว radius/2 เท่า ได้ความเบลอใกล้เคียง blur(radius) ของ ctx.filter
  const factor = Math.max(2, radius / 2);
  const w = Math.max(1, Math.round(width / factor));
  const h = Math.max(1, Math.round(height / factor));
  if (!smallCanvas) smallCanvas = document.createElement('canvas');
  // ตั้งขนาดใหม่เฉพาะตอนเปลี่ยน (การตั้ง width/height จะล้างและจองหน่วยความจำ canvas ใหม่ทุกครั้ง)
  if (smallCanvas.width !== w) smallCanvas.width = w;
  if (smallCanvas.height !== h) smallCanvas.height = h;
  const smallCtx = smallCanvas.getContext('2d');
  if (!smallCtx) return;

  smallCtx.imageSmoothingEnabled = true;
  smallCtx.imageSmoothingQuality = 'high';
  smallCtx.drawImage(image, 0, 0, w, h);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(smallCanvas, 0, 0, width, height);
};
