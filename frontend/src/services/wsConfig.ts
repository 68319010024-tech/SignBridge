// ปลายทาง WebSocket ของ AI Engine (ai-engine/src/server.py)
//
// - เปิดจาก localhost/127.0.0.1 (dev เครื่อง local): ชี้ไป engine ที่รันอยู่บนเครื่องเดียวกัน
// - เปิดจากโดเมนอื่น (เช่น webapp.htc.ac.th ผ่าน iPad/มือถือ): ต้องต่อผ่าน host+protocol
//   ของหน้าเว็บเอง ไม่ใช่ 127.0.0.1 (ซึ่งจะหมายถึงตัวเครื่องที่เปิดเว็บเอง ไม่ใช่เครื่อง engine)
//   โดย path /ai/ws/ ต้องถูก reverse proxy (เช่น Nginx Proxy Manager) ไปยัง container ของ ai-engine
// - ตั้ง VITE_WS_URL ตอน build เพื่อ override ค่านี้ได้เสมอ
export function resolveWsUrl(): string {
  const override = import.meta.env.VITE_WS_URL;
  if (override) return override;

  const { protocol, hostname, host } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://127.0.0.1:8000';
  }
  const wsProtocol = protocol === 'https:' ? 'wss' : 'ws';
  return `${wsProtocol}://${host}/ai/ws/`;
}
