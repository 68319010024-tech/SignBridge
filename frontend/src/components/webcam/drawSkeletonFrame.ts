// วาดภาพโครงกระดูก (JPEG base64 ที่ ai-engine วาดกลับมา) ลง canvas
//
// เดิมใช้ <img src="data:..."> + setState ทุกข้อความ (~10 ครั้ง/วินาที) ทำให้ React render ทั้งหน้า
// ทุกครั้ง บนเครื่องช้า (Raspberry Pi) หนักมาก — วาดลง canvas ตรง ๆ ไม่ต้อง render ใหม่
// ถ้าภาพก่อนหน้ายังถอดรหัสไม่เสร็จ จะข้ามภาพใหม่ไปเลย ไม่ให้งานค้างเป็นคิว
const busy = new WeakSet<HTMLCanvasElement>();

const decode = async (base64: string): Promise<CanvasImageSource & { width: number; height: number }> => {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/jpeg' });

  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);

  // เบราว์เซอร์เก่าที่ไม่มี createImageBitmap
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

// คืนค่า true เมื่อวาดสำเร็จ
export const drawSkeletonFrame = async (canvas: HTMLCanvasElement, base64: string): Promise<boolean> => {
  if (busy.has(canvas)) return false;
  busy.add(canvas);
  try {
    const image = await decode(base64);
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    // ตั้งขนาดเฉพาะตอนเปลี่ยน (ตั้งทุกครั้งจะล้างและจองหน่วยความจำ canvas ใหม่)
    if (canvas.width !== image.width) canvas.width = image.width;
    if (canvas.height !== image.height) canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    if ('close' in image && typeof image.close === 'function') image.close();
    return true;
  } catch (err) {
    console.warn('[skeleton] วาดภาพโครงกระดูกไม่สำเร็จ:', err);
    return false;
  } finally {
    busy.delete(canvas);
  }
};
