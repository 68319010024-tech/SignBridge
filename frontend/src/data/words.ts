// รายการคำศัพท์ในคลังศัพท์ (แยกตามหมวด) และไอคอนประจำคำ — ใช้ทั้งหน้ารวมหมวดหมู่และหน้ารายการคำในหมวด
import {
  BookOpen, type LucideIcon,
  Flame, FaceSlightlySmiling, Snowflake, Soup, TriangleAlert,
  Utensils, ThumbsUp, Target, Hammer, LogOut, LogIn, GraduationCap, OctagonX,
  Lightbulb, MapPinned, Calculator, CalendarClock, CircleQuestionMark,
  User, UserRound, CircleUserRound,
  PersonStanding, CarTaxiFront, Presentation, Siren, Handshake, Stethoscope,
  FaceSlightlyFrowning, HeartHandshake, Hand,
  CalendarDays,
  Store, House, Hospital, School, Toilet,
  Banknote, Smartphone, GlassWater, Car, Book, Salad,
  CircleCheck, CircleX, CircleSlash, CircleMinus, ThumbsDown, Hourglass, Ban
} from 'lucide-react';

export const wordsData: Record<string, string[]> = {
  'ความรู้สึก': ['ร้อน', 'สบายดี', 'หนาว', 'หิว', 'อันตราย'],
  'คำกริยา': ['กิน', 'ชอบ', 'ต้องการ', 'ทำ', 'ไป', 'มา', 'เรียน', 'หยุด'],
  'คำถาม': ['ทำไม', 'ที่ไหน', 'เท่าไหร่', 'เมื่อไหร่', 'อะไร'],
  'คำสรรพนาม': ['เขา', 'คุณ', 'ฉัน'],
  'บุคคลและอาชีพ': ['คน', 'คนขับรถ', 'ครู', 'ตำรวจ', 'เพื่อน', 'หมอ'],
  'มารยาท': ['ขอโทษ', 'ขอบคุณ', 'สวัสดี'],
  'เวลา': ['วันนี้'],
  'สถานที่': ['ตลาด', 'บ้าน', 'โรงพยาบาล', 'โรงเรียน', 'ห้องน้ำ'],
  'สิ่งของและวัตถุ': ['เงิน', 'โทรศัพท์', 'น้ำ', 'รถยนต์', 'หนังสือ', 'อาหาร'],
  'แสดงสภาวะ': ['ใช่', 'ไม่', 'ไม่ใช่', 'ไม่ได้', 'ไม่เอา', 'ยัง', 'ห้าม'],
};

// ไอคอนตามความหมายของแต่ละคำ (คำที่ไม่มีในนี้ใช้ไอคอนหนังสือแทน)
export const wordIcons: Record<string, LucideIcon> = {
  // ความรู้สึก
  'ร้อน': Flame, 'สบายดี': FaceSlightlySmiling, 'หนาว': Snowflake, 'หิว': Soup, 'อันตราย': TriangleAlert,
  // คำกริยา — ไป/มา ใช้ลูกศรออก/เข้าเป็นคู่กัน
  'กิน': Utensils, 'ชอบ': ThumbsUp, 'ต้องการ': Target, 'ทำ': Hammer,
  'ไป': LogOut, 'มา': LogIn, 'เรียน': GraduationCap, 'หยุด': OctagonX,
  // คำถาม
  'ทำไม': Lightbulb, 'ที่ไหน': MapPinned, 'เท่าไหร่': Calculator, 'เมื่อไหร่': CalendarClock, 'อะไร': CircleQuestionMark,
  // คำสรรพนาม
  'เขา': User, 'คุณ': UserRound, 'ฉัน': CircleUserRound,
  // บุคคลและอาชีพ
  'คน': PersonStanding, 'คนขับรถ': CarTaxiFront, 'ครู': Presentation, 'ตำรวจ': Siren, 'เพื่อน': Handshake, 'หมอ': Stethoscope,
  // มารยาท
  'ขอโทษ': FaceSlightlyFrowning, 'ขอบคุณ': HeartHandshake, 'สวัสดี': Hand,
  // เวลา
  'วันนี้': CalendarDays,
  // สถานที่
  'ตลาด': Store, 'บ้าน': House, 'โรงพยาบาล': Hospital, 'โรงเรียน': School, 'ห้องน้ำ': Toilet,
  // สิ่งของและวัตถุ
  'เงิน': Banknote, 'โทรศัพท์': Smartphone, 'น้ำ': GlassWater, 'รถยนต์': Car, 'หนังสือ': Book, 'อาหาร': Salad,
  // แสดงสภาวะ
  'ใช่': CircleCheck, 'ไม่': CircleX, 'ไม่ใช่': CircleSlash, 'ไม่ได้': CircleMinus, 'ไม่เอา': ThumbsDown, 'ยัง': Hourglass, 'ห้าม': Ban,
};

export const wordIconOf = (word: string): LucideIcon => wordIcons[word] ?? BookOpen;

// Map คำศัพท์กับชนิดของคำตามหลักไวยากรณ์ภาษาไทย
export const wordTypeMapping: Record<string, string> = {
  // คำนาม
  'คน': 'คำนาม',
  'คนขับรถ': 'คำนาม',
  'ตำรวจ': 'คำนาม',
  'หมอ': 'คำนาม',
  'ครู': 'คำนาม',
  'เพื่อน': 'คำนาม',
  'ตลาด': 'คำนาม',
  'บ้าน': 'คำนาม',
  'โรงพยาบาล': 'คำนาม',
  'ห้องน้ำ': 'คำนาม',
  'โรงเรียน': 'คำนาม',
  'เงิน': 'คำนาม',
  'โทรศัพท์': 'คำนาม',
  'น้ำ': 'คำนาม',
  'รถยนต์': 'คำนาม',
  'อาหาร': 'คำนาม',
  'หนังสือ': 'คำนาม',
  'วันนี้': 'คำนามบอกเวลา',

  // คำสรรพนาม
  'เขา': 'คำสรรพนาม',
  'คุณ': 'คำสรรพนาม',
  'ฉัน': 'คำสรรพนาม',

  // คำกริยา
  'กิน': 'คำกริยา',
  'ไป': 'คำกริยา',
  'มา': 'คำกริยา',
  'ชอบ': 'คำกริยา',
  'เรียน': 'คำกริยา',
  'ต้องการ': 'คำกริยา',
  'ทำ': 'คำกริยา',
  'หยุด': 'คำกริยา',
  'สบายดี': 'คำกริยาแสดงสภาวะ',
  'ใช่': 'คำกริยา',
  'ไม่ใช่': 'คำกริยา',

  // คำวิเศษณ์
  'ร้อน': 'คำวิเศษณ์',
  'หนาว': 'คำวิเศษณ์',
  'หิว': 'คำวิเศษณ์',
  'อันตราย': 'คำวิเศษณ์',
  'ทำไม': 'คำวิเศษณ์แสดงคำถาม',
  'ที่ไหน': 'คำวิเศษณ์แสดงคำถาม',
  'เท่าไหร่': 'คำวิเศษณ์แสดงคำถาม',
  'เมื่อไหร่': 'คำวิเศษณ์แสดงคำถาม',
  'อะไร': 'คำวิเศษณ์แสดงคำถาม',
  'ไม่': 'คำวิเศษณ์ปฏิเสธ',
  'ไม่ได้': 'คำวิเศษณ์ปฏิเสธ',
  'ไม่เอา': 'คำวิเศษณ์ปฏิเสธ',
  'ห้าม': 'คำวิเศษณ์ข้อห้าม',
  'ยัง': 'คำวิเศษณ์ปฏิเสธ',

  // คำทักทาย
  'สวัสดี': 'คำทักทาย',
  'ขอบคุณ': 'คำทักทาย',
  'ขอโทษ': 'คำทักทาย',
};

export const wordTypeOf = (word: string): string => wordTypeMapping[word] || 'คำนาม';
