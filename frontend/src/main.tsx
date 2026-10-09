import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/globals.css';
import { IS_LITE_UI } from './utils/lowPowerDevice';

// /ai2/ บน Pi + จอ 1280x800: ปิดแอนิเมชัน/เงา (ดู .sb-lite ใน globals.css)
if (IS_LITE_UI) document.documentElement.classList.add('sb-lite');

// build สำหรับ Pi แบบออฟไลน์: ใช้ฟอนต์ที่อยู่ในเว็บเอง แทนการโหลดจาก Google Fonts
if (__SB_OFFLINE__) import('./styles/offlineFonts');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);