// ส่งภาพกล้องให้ AI แบบโหมดเบา (IS_LITE_UI — /ai2/ บน Pi)
//
// แบบปกติส่ง 10 ภาพ/วินาทีเสมอ และเข้ารหัส JPEG ด้วย toDataURL ซึ่งทำบน main thread (ระหว่างนั้นกด/เลื่อนหน้าไม่ได้)
// แต่ ai-engine ที่รันบน Pi เครื่องเดียวกันประมวลผลได้ช้ากว่านั้น ภาพส่วนเกินถูกทิ้งที่ server ทั้งที่เสีย CPU เข้ารหัสไปแล้ว
// แบบนี้: ส่งภาพใหม่เมื่อ AI ตอบภาพก่อนหน้าแล้ว (ไม่เกิน 10 ภาพ/วินาทีเท่าเดิม) และใช้ toBlob ให้เบราว์เซอร์เข้ารหัสนอก main thread
export class LiteFrameSender {
  private waiting = false;
  private sentAt = 0;

  constructor(
    private readonly minIntervalMs: number,
    // server ไม่ตอบ (เช่น ข้อความหาย) → ส่งใหม่ได้หลังเวลานี้ กันการส่งค้างไปตลอด
    private readonly replyTimeoutMs = 1000
  ) {}

  // ถึงเวลาส่งภาพถัดไปหรือยัง — เช็คก่อนวาดภาพลง canvas จะได้ไม่วาดทิ้งเปล่า ๆ
  ready(): boolean {
    const elapsed = performance.now() - this.sentAt;
    if (elapsed < this.minIntervalMs) return false;
    return !this.waiting || elapsed >= this.replyTimeoutMs;
  }

  // ได้คำตอบจาก AI แล้ว / เชื่อมต่อใหม่ — คืนค่าเวลา (ms) ที่ต้องรอก่อนส่งภาพถัดไปได้ (ไม่ให้เกิน 10 ภาพ/วินาที)
  // ให้ผู้เรียกตั้งเวลาส่งเอง ถ้ารอ tick ถัดไปของ worker จะเสียเวลาเปล่าอีกถึง 100ms ภาพที่ AI ได้จะลดเหลือครึ่งเดียว
  onReply(): number {
    this.waiting = false;
    return Math.max(0, this.minIntervalMs - (performance.now() - this.sentAt));
  }

  send(canvas: HTMLCanvasElement, socket: WebSocket, quality: number, buildMessage: (base64: string) => string): void {
    this.waiting = true;
    this.sentAt = performance.now();
    const fail = () => {
      this.waiting = false;
    };
    canvas.toBlob(
      (blob) => {
        if (!blob || socket.readyState !== WebSocket.OPEN) return fail();
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = String(reader.result).split(',')[1];
          if (!base64 || socket.readyState !== WebSocket.OPEN) return fail();
          socket.send(buildMessage(base64));
        };
        reader.onerror = fail;
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      quality
    );
  }
}
