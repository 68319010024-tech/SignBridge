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
