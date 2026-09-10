// Worker แยกต่างหากที่ทำหน้าที่แค่ "ตีเวลา" (tick) ให้ main thread จับเฟรมจาก canvas
// แล้วส่งไปยัง Backend เท่านั้น — ไม่แตะ DOM/canvas/WebSocket โดยตรง
//
// เหตุผลที่ต้องแยกออกมา: เบราว์เซอร์ (Chromium) หน่วง setInterval/setTimeout บน main
// thread ของแท็บที่ถูกซ่อน/ไม่ได้โฟกัสให้เหลือทำงานได้แค่ ~1 ครั้ง/วินาที ทำให้การส่งเฟรม
// กล้องแบบ ~10 FPS ตกลงเหลือ 1 FPS ทันทีที่ผู้ใช้สลับไปหน้าต่างอื่น ซึ่งไม่พอสำหรับเก็บ
// ท่าทางให้ครบจำนวนเฟรมขั้นต่ำที่โมเดลต้องใช้ทำนายผล ตัวจับเวลาใน Web Worker ไม่ถูกหน่วง
// ด้วยกฎเดียวกัน จึงยังคง tick ได้ต่อเนื่องแม้แท็บจะไม่ได้อยู่ด้านหน้า

let timerId: ReturnType<typeof setInterval> | null = null;

self.onmessage = (event: MessageEvent) => {
  const { type, intervalMs } = event.data || {};

  if (type === 'start') {
    if (timerId !== null) clearInterval(timerId);
    timerId = setInterval(() => {
      self.postMessage('tick');
    }, intervalMs);
  } else if (type === 'stop') {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }
};
