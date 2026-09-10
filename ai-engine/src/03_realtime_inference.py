import os
import sys
import json
import time
import base64
import asyncio
import logging
import threading

import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
import websockets

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "sign_model.h5")
LABEL_MAP_PATH = os.path.join(MODELS_DIR, "label_map.json")

HOST = "127.0.0.1"
PORT = 8000

# ดึงเฉพาะคิ้ว ตา และปาก (40 จุด = 120 ค่า)
FACE_INDICES = [
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314, 405, 321, 375, # Lips
    70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 55, 65, 52, 53, 285, 295, 282, 283, 33, 263 # Eyebrows & Eyes
]

# ----------------------------------------------------------------------------
# Syntax Bridge Transformation Algorithm (Rule-Based Matrix)
# ----------------------------------------------------------------------------
VOCAB_ROLE_MAP = {
    # Subject
    "ฉัน": "Subject", "คุณ": "Subject", "เขา": "Subject", "คน": "Subject",
    "ครู": "Subject", "หมอ": "Subject", "ตำรวจ": "Subject", "คนขับรถ": "Subject", "เพื่อน": "Subject",

    # Verb
    "กิน": "Verb", "ชอบ": "Verb", "ต้องการ": "Verb", "ทำ": "Verb", "มา": "Verb",
    "ไป": "Verb", "เรียน": "Verb", "หยุด": "Verb", "ห้าม": "Verb", "ขอบคุณ": "Verb",
    "ขอโทษ": "Verb", "หิว": "Verb", "ร้อน": "Verb", "หนาว": "Verb", "สบายดี": "Verb",

    # Object
    "ข้าว": "Object", "น้ำ": "Object", "หนังสือ": "Object", "รถยนต์": "Object",
    "โทรศัพท์": "Object", "เงิน": "Object", "อาหาร": "Object", "บ้าน": "Object",
    "ตลาด": "Object", "ห้องน้ำ": "Object", "โรงพยาบาล": "Object", "โรงเรียน": "Object",

    # Time
    "วันนี้": "Time", "ยัง": "Time",

    # Question
    "ทำไม": "Question", "ที่ไหน": "Question", "เท่าไหร่": "Question",
    "เมื่อไหร่": "Question", "อะไร": "Question", "ใช่": "Question",

    # Negation
    "ไม่": "Negation", "ไม่เอา": "Negation", "ไม่ใช่": "Negation", "ไม่ได้": "Negation",

    # Greeting / Other
    "สวัสดี": "Other",
}

ROLE_ORDER = ["Time", "Subject", "Negation", "Verb", "Object", "Question"]

MAX_BUFFER_WORDS = 5
IDLE_THRESHOLD = 0.7      
SENTENCE_TIMEOUT = 5.0
CONFIDENCE_THRESHOLD = 0.50  # เกณฑ์กรองความมั่นใจขั้นต่ำ 50%

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("signbridge.server")


def translate_sentence(word_list):
    if not word_list:
        return ""

    role_buckets = {role: [] for role in ROLE_ORDER}
    unknown_words = []

    for word in word_list:
        role = VOCAB_ROLE_MAP.get(word)
        if role in role_buckets:
            role_buckets[role].append(word)
        else:
            unknown_words.append(word)

    ordered_words = []
    for role in ROLE_ORDER:
        ordered_words.extend(role_buckets[role])
    ordered_words.extend(unknown_words)

    return " ".join(ordered_words)


def normalize_landmarks_frame(frame):
    norm_frame = np.copy(frame)

    if np.any(norm_frame[:63]):
        lh = norm_frame[:63].reshape(21, 3)
        lh = lh - lh[0]
        max_val = np.max(np.abs(lh))
        if max_val > 0:
            lh = lh / max_val
        norm_frame[:63] = lh.flatten()

    if np.any(norm_frame[63:126]):
        rh = norm_frame[63:126].reshape(21, 3)
        rh = rh - rh[0]
        max_val = np.max(np.abs(rh))
        if max_val > 0:
            rh = rh / max_val
        norm_frame[63:126] = rh.flatten()

    if np.any(norm_frame[126:]):
        face = norm_frame[126:].reshape(-1, 3)
        face = face - face[0]
        max_val = np.max(np.abs(face))
        if max_val > 0:
            face = face / max_val
        norm_frame[126:] = face.flatten()

    return norm_frame


def resample_sequence(sequence, target_frames=30):
    total = len(sequence)
    if total == 0:
        return np.zeros((target_frames, 246))
    if total <= target_frames:
        indices = np.linspace(0, total - 1, total).astype(int)
        sampled = [sequence[i] for i in indices]
        padding = [np.zeros(246) for _ in range(target_frames - total)]
        sampled.extend(padding)
    else:
        indices = np.linspace(0, total - 1, target_frames).astype(int)
        sampled = [sequence[i] for i in indices]
    return np.array(sampled)


def decode_frame(base64_image: str):
    if base64_image.strip().startswith("data:") and "," in base64_image:
        base64_image = base64_image.split(",", 1)[1]
    raw = base64.b64decode(base64_image)
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


# เพิ่มมิติการย่อขนาดภาพเป็น 800px เพื่อรักษาความคมชัดของข้อต่อนิ้วมือ
MAX_PROCESS_DIM = 800


def resize_for_processing(image_bgr):
    h, w = image_bgr.shape[:2]
    longest = max(h, w)
    if longest <= MAX_PROCESS_DIM:
        return image_bgr
    scale = MAX_PROCESS_DIM / float(longest)
    return cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def encode_frame(image_bgr) -> str:
    # เพิ่มคุณภาพภาพ JPEG Encode เป็น 85
    ok, buffer = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        return ""
    return base64.b64encode(buffer).decode("utf-8")


mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils


def draw_skeleton(image_bgr, results):
    if results.face_landmarks:
        h, w, _ = image_bgr.shape
        for idx in FACE_INDICES:
            pt = results.face_landmarks.landmark[idx]
            cv2.circle(image_bgr, (int(pt.x * w), int(pt.y * h)), 1, (0, 255, 255), -1)

    if results.left_hand_landmarks:
        mp_drawing.draw_landmarks(image_bgr, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS)

    if results.right_hand_landmarks:
        mp_drawing.draw_landmarks(image_bgr, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS)

    return image_bgr


def load_model_and_labels():
    if not os.path.exists(MODEL_PATH) or not os.path.exists(LABEL_MAP_PATH):
        raise FileNotFoundError(f"ไม่พบโมเดลหรือ label_map ที่ {MODEL_PATH} / {LABEL_MAP_PATH}")
    model = tf.keras.models.load_model(MODEL_PATH)
    with open(LABEL_MAP_PATH, "r", encoding="utf-8") as f:
        label_map = json.load(f)
    rev_label_map = {v: k for k, v in label_map.items()}
    return model, rev_label_map


MODEL_LOCK = threading.Lock()


class GestureSession:
    def __init__(self, model, rev_label_map):
        self.model = model
        self.rev_label_map = rev_label_map
        # ยกระดับ model_complexity เป็น 1 เพิ่มความแม่นยำจับพิกัด
        self.holistic = mp_holistic.Holistic(
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        self.gesture_sequence = []
        self.is_recording = False
        self.last_hand_time = time.time()

        self.word_buffer = []
        self.transformed_sentence = ""
        self.translated_word = "-"
        self.confidence = 0.0

        # เพิ่มขึ้นทุกครั้งที่มีการทำนายใหม่จริง ๆ (ไม่ใช่แค่ส่ง translated_word ซ้ำทุกเฟรม)
        # ฝั่ง client ใช้ค่านี้แยกแยะ "ท่าทางใหม่" ออกจาก "ค่าเดิมที่ backend ยังไม่อัปเดต"
        # เพื่อไม่ให้ตรวจจับคำเดิมซ้ำ ๆ ทั้งที่ผู้ใช้วางมือลงไปแล้วและยังไม่ได้ทำท่าใหม่
        self.prediction_id = 0

        self.frame_count = 0

    def close(self):
        self.holistic.close()

    def process_frame(self, image_bgr, show_skeleton: bool):
        self.frame_count += 1
        _t0 = time.time()

        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        results = self.holistic.process(image_rgb)
        _elapsed_ms = (time.time() - _t0) * 1000

        lh = np.zeros(21 * 3)
        rh = np.zeros(21 * 3)
        face = np.zeros(len(FACE_INDICES) * 3)
        has_hand = False

        if results.face_landmarks:
            face = np.array([[results.face_landmarks.landmark[i].x,
                               results.face_landmarks.landmark[i].y,
                               results.face_landmarks.landmark[i].z] for i in FACE_INDICES]).flatten()

        if results.left_hand_landmarks:
            has_hand = True
            lh = np.array([[p.x, p.y, p.z] for p in results.left_hand_landmarks.landmark]).flatten()

        if results.right_hand_landmarks:
            has_hand = True
            rh = np.array([[p.x, p.y, p.z] for p in results.right_hand_landmarks.landmark]).flatten()

        if self.frame_count % 50 == 1:
            log.info(
                "frame #%d shape=%s mean=%.1f holistic.process=%.0fms has_pose=%s has_face=%s has_hand=%s is_recording=%s buffer_len=%d",
                self.frame_count, image_bgr.shape, float(image_bgr.mean()), _elapsed_ms,
                bool(results.pose_landmarks), bool(results.face_landmarks), has_hand,
                self.is_recording, len(self.gesture_sequence),
            )

        if has_hand:
            self.last_hand_time = time.time()
            if not self.is_recording:
                self.is_recording = True
                self.gesture_sequence = []

        frame_features = np.concatenate([lh, rh, face])

        if self.is_recording:
            if has_hand:
                self.gesture_sequence.append(frame_features)
            elif time.time() - self.last_hand_time > IDLE_THRESHOLD:
                self.is_recording = False
                if len(self.gesture_sequence) >= 5:
                    sampled_seq = resample_sequence(self.gesture_sequence, target_frames=30)
                    norm_seq = np.array([normalize_landmarks_frame(f) for f in sampled_seq])

                    with MODEL_LOCK:
                        res = self.model.predict(np.expand_dims(norm_seq, axis=0), verbose=0)[0]
                    best_idx = int(np.argmax(res))
                    confidence = float(res[best_idx])

                    if confidence >= CONFIDENCE_THRESHOLD:
                        self.translated_word = self.rev_label_map[best_idx]
                        self.confidence = confidence
                        self.prediction_id += 1
                        log.info("prediction: %s (%.1f%%)", self.translated_word, confidence * 100)

                        if len(self.word_buffer) < MAX_BUFFER_WORDS and (
                            not self.word_buffer or self.word_buffer[-1] != self.translated_word
                        ):
                            self.word_buffer.append(self.translated_word)
                    else:
                        log.info("ignored low confidence prediction: %.1f%%", confidence * 100)
                
                self.gesture_sequence = []

        if self.word_buffer and (time.time() - self.last_hand_time) > SENTENCE_TIMEOUT:
            self.transformed_sentence = translate_sentence(self.word_buffer)
            log.info("sentence: %s => %s", " -> ".join(self.word_buffer), self.transformed_sentence)
            self.word_buffer = []

        frame_b64 = None
        if show_skeleton:
            frame_b64 = encode_frame(draw_skeleton(image_bgr.copy(), results))

        return {
            "type": "prediction",
            "word": self.translated_word,
            "confidence": self.confidence,
            "prediction_id": self.prediction_id,
            "tsl_sequence": list(self.word_buffer),
            "sentence": self.transformed_sentence,
            "frame": frame_b64,
        }


async def handle_client(websocket, model, rev_label_map):
    session = GestureSession(model, rev_label_map)
    log.info("client connected: %s", websocket.remote_address)

    latest_frame_holder: dict = {"image": None, "show_skeleton": False}
    new_frame_event = asyncio.Event()
    should_stop = False
    seen_page = {"value": None}

    async def receiver():
        async for message in websocket:
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                continue

            page = payload.get("page")
            if page and seen_page["value"] != page:
                seen_page["value"] = page
                log.info("client %s identified as page=%s", websocket.remote_address, page)

            base64_image = payload.get("image")
            if not base64_image:
                continue
            show_skeleton = bool(payload.get("showSkeleton", False))

            try:
                image = decode_frame(base64_image)
            except Exception:
                log.warning("failed to decode incoming frame", exc_info=True)
                continue
            if image is None:
                continue

            latest_frame_holder["image"] = resize_for_processing(image)
            latest_frame_holder["show_skeleton"] = show_skeleton
            new_frame_event.set()

    async def processor():
        # หมายเหตุสำคัญ: ห้าม cancel() coroutine นี้ระหว่างที่กำลัง await
        # asyncio.to_thread(session.process_frame, ...) อยู่ เพราะ cancel() หยุดแค่การ
        # await ฝั่ง asyncio แต่ thread ที่รัน MediaPipe (native code) จะยังทำงานต่อเบื้องหลัง
        # ต่อไปอยู่ดี ถ้า session.close() ถูกเรียกไปพร้อมกัน (เช่นตอน client ตัดการเชื่อมต่อ
        # กะทันหัน) จะเกิด race condition เข้าถึง Holistic graph object พร้อมกันจาก 2 thread
        # ซึ่งเป็นสาเหตุที่ทำให้ process ล่มแบบไม่มี traceback (native crash) จึงต้องปล่อยให้
        # loop นี้จบงานที่ค้างอยู่เองแล้วค่อยให้ finally ด้านล่างรอ (await) จนจบก่อนปิด session
        nonlocal should_stop
        while True:
            await new_frame_event.wait()
            new_frame_event.clear()
            if should_stop:
                return

            image = latest_frame_holder["image"]
            show_skeleton = latest_frame_holder["show_skeleton"]
            if image is None:
                continue

            result = await asyncio.to_thread(session.process_frame, image, show_skeleton)
            try:
                await websocket.send(json.dumps(result, ensure_ascii=False))
            except websockets.exceptions.ConnectionClosed:
                return

    processor_task = asyncio.create_task(processor())
    try:
        await receiver()
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # ปลุก processor ให้ตื่นมาเช็ค should_stop (เผื่อกำลังรอเฟรมใหม่อยู่เฉย ๆ) แล้วรอให้
        # จบงานที่ค้างอยู่จริง ๆ ก่อน ค่อยปิด holistic เพื่อเลี่ยง race condition ข้างต้น
        should_stop = True
        new_frame_event.set()
        await processor_task
        session.close()
        log.info("client disconnected: %s (page=%s, frames=%d)", websocket.remote_address, seen_page["value"], session.frame_count)


async def main():
    model, rev_label_map = load_model_and_labels()
    log.info("model loaded, %d labels", len(rev_label_map))

    async def handler(websocket):
        try:
            await handle_client(websocket, model, rev_label_map)
        except Exception:
            log.exception("unhandled error in connection %s", websocket.remote_address)

    async with websockets.serve(handler, HOST, PORT, max_size=10 * 1024 * 1024):
        log.info("SignBridge WebSocket server listening on ws://%s:%d", HOST, PORT)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())