#!/bin/bash
# ตั้งให้ Raspberry Pi เปิด SignBridge /ai2/ เต็มจอ (kiosk) เองทุกครั้งหลังเข้าสู่เดสก์ท็อป
#
# รันบน Pi ด้วย user ปกติที่ล็อกอินหน้าจอ (ไม่ต้อง sudo — ยกเว้นขั้นปิดจอดับ จะถามรหัสผ่าน):
#   curl -fsSL https://raw.githubusercontent.com/68319010024-tech/SignBridge/master/docker/pi/setup-kiosk.sh | bash
#
# ต้องติดตั้ง stack docker/docker-compose.pi.yml ผ่าน Portainer ก่อน (หน้าเว็บอยู่ที่ http://localhost:8080/ai2/)
#
# ออกจาก kiosk ชั่วคราว: กด Alt+F4 (ต้องใช้คีย์บอร์ด)
# ยกเลิก kiosk ถาวร:   rm ~/.config/autostart/signbridge-kiosk.desktop  แล้วรีบูต
set -e

URL="http://localhost:8080/ai2/"

BROWSER="$(command -v chromium || command -v chromium-browser || true)"
if [ -z "$BROWSER" ]; then
  echo "ไม่พบ Chromium — ติดตั้งก่อนด้วย: sudo apt install chromium" >&2
  exit 1
fi

mkdir -p "$HOME/.local/bin" "$HOME/.config/autostart"

# ตัวเปิดเบราว์เซอร์: หลังเปิดเครื่อง container ของ Docker ใช้เวลาสักพักกว่าจะพร้อม จึงรอหน้าเว็บตอบก่อน (สูงสุด ~2 นาที)
# ถ้าเปิดก่อน Chromium จะขึ้นหน้า "เชื่อมต่อไม่ได้" ค้างไว้
cat > "$HOME/.local/bin/signbridge-kiosk" <<EOF
#!/bin/bash
for i in \$(seq 1 60); do
  curl -s -o /dev/null "$URL" && break
  sleep 2
done
# --use-fake-ui-for-media-stream: อนุญาตกล้องให้อัตโนมัติ ไม่ต้องกด Allow ทุกครั้งที่เปิดเครื่อง
# --disable-session-crashed-bubble: ไม่ขึ้นแถบ "กู้คืนหน้า" เมื่อปิดเครื่องด้วยการถอดปลั๊ก
exec "$BROWSER" --kiosk "$URL" \\
  --noerrdialogs --disable-infobars --no-first-run \\
  --disable-session-crashed-bubble --disable-features=Translate \\
  --password-store=basic --use-fake-ui-for-media-stream \\
  --check-for-update-interval=31536000
EOF
chmod +x "$HOME/.local/bin/signbridge-kiosk"

cat > "$HOME/.config/autostart/signbridge-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=SignBridge Kiosk
Exec=$HOME/.local/bin/signbridge-kiosk
X-GNOME-Autostart-enabled=true
EOF

echo "ตั้ง kiosk เรียบร้อย: $URL"

# ไม่ให้จอดับเองเมื่อไม่มีใครแตะ (ตอนจัดแสดง) — ถามรหัสผ่านของ user นี้
if command -v raspi-config >/dev/null 2>&1; then
  echo "ปิดการพักหน้าจอ (screen blanking) — ใส่รหัสผ่านของ Pi ถ้าถาม"
  sudo raspi-config nonint do_blanking 1 && echo "ปิดการพักหน้าจอแล้ว" || echo "ปิดการพักหน้าจอไม่สำเร็จ — ตั้งเองได้ที่ raspi-config > Display Options > Screen Blanking"
fi

echo "รีบูตเพื่อทดสอบได้ด้วย: sudo reboot"
