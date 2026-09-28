// กล้องหน้าของ iPad รุ่นใหม่เป็นเลนส์มุมกว้างพิเศษ (ultra-wide) เบราว์เซอร์จึงเปิดมาแบบซูมออกเยอะ
// ถ้ากล้องรองรับการซูม (Safari/Chrome บอกผ่าน getCapabilities().zoom โดยค่า 1 = 1x แบบแอปกล้อง)
// ตั้งเป็น 1x ให้ภาพเหมือนกล้องปกติ — กล้องที่ไม่รองรับหรือเป็น 1x อยู่แล้วจะไม่มีอะไรเปลี่ยน
export async function applyNormalZoom(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track || typeof track.getCapabilities !== 'function') return;
  const zoom = (track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number } }).zoom;
  if (!zoom || zoom.min > 1 || zoom.max < 1) return;
  const current = (track.getSettings() as MediaTrackSettings & { zoom?: number }).zoom;
  if (current === 1) return;
  try {
    await track.applyConstraints({ advanced: [{ zoom: 1 } as MediaTrackConstraintSet] });
  } catch (err) {
    console.warn('ตั้งค่าซูมกล้องไม่ได้:', err);
  }
}
