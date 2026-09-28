import { useEffect, useState } from 'react';

// ใช้ตัดสินว่าจะแสดง layout แบบ mobile/tablet (สแต็กแนวตั้ง + ปุ่มไอคอนย่อ) หรือ desktop
// (แผงแบบ side-by-side) — breakpoint เดียวกับที่ใช้พับ/กาง sidebar
export function useIsMobileView(breakpoint = 1024): boolean {
  const [isMobileView, setIsMobileView] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handleChange = (e: MediaQueryList | MediaQueryListEvent) => setIsMobileView(e.matches);
    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [breakpoint]);

  return isMobileView;
}

// จอเตี้ย (เช่นโน้ตบุ๊ก 1280x720) — ใช้ย่อกล่องในคอลัมน์ขวาของหน้าหลักให้ไม่ยาวเกินขอบล่างของกล้อง
export function useIsShortView(maxHeight = 760): boolean {
  const [isShort, setIsShort] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerHeight <= maxHeight
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-height: ${maxHeight}px)`);
    const handleChange = (e: MediaQueryList | MediaQueryListEvent) => setIsShort(e.matches);
    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [maxHeight]);

  return isShort;
}

// แท็บเล็ตแนวตั้ง (เช่น iPad 820x1180): จอแคบกว่า 1024px จึงใช้ layout มือถือ แต่กว้างและสูงพอจะวางกล่องชุดเดียวกับ PC
// (กล้องตรงกลาง กล่องสถานะ/ปุ่มควบคุมเรียงใต้กล้อง) ให้เห็นครบในจอเดียว — มือถือ (แคบ ≤700px)
// และมือถือแนวนอน (เตี้ย ≤700px) ยังใช้ layout มือถือเดิม
export function useIsTabletPortrait(): boolean {
  const isMobileView = useIsMobileView();
  const isNarrow = useIsMobileView(700);
  const isShort = useIsShortView(700);
  return isMobileView && !isNarrow && !isShort;
}
