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

// มือถือแนวนอน (เช่น 844x390): จอ ≤1024px ที่เตี้ยไม่เกิน 700px และกว้างกว่าสูง — วางกล้องซ้าย กล่องเรียงในคอลัมน์ขวา
// (ถ้าสแต็กแนวตั้งแบบแนวตั้ง กล้องจะสูงเกินจอหลายเท่า)
export function useIsPhoneLandscape(): boolean {
  const isMobileView = useIsMobileView();
  const isShort = useIsShortView(700);
  const [isLandscape, setIsLandscape] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)');
    const handleChange = (e: MediaQueryList | MediaQueryListEvent) => setIsLandscape(e.matches);
    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobileView && isShort && isLandscape;
}

// แท็บเล็ตแนวนอน (เช่น iPad 1180x820): กว้างเกิน 1024px จึงใช้ layout แบบ PC แต่เป็นจอสัมผัส
// ใช้ (pointer: coarse) แยกออกจากโน้ตบุ๊กขนาดเดียวกัน (1366x768, 1280x720) ที่ใช้เมาส์
// จะได้ปรับเฉพาะ iPad โดยไม่กระทบกล่องบน PC ที่ลงตัวแล้ว
export function useIsTabletLandscape(): boolean {
  const isMobileView = useIsMobileView();
  const isTabletWidth = useIsMobileView(1366);
  const [isCoarse, setIsCoarse] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)');
    const handleChange = (e: MediaQueryList | MediaQueryListEvent) => setIsCoarse(e.matches);
    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return !isMobileView && isTabletWidth && isCoarse;
}
