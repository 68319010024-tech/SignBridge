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

import features as F

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# v4 = มือ + หน้า + pose ช่วงบน + feature ระยะ/รูปมือ/ความเร็ว (features.py), รวม "ไม่ใช่" เข้ากับ "ไม่"
# โมเดลเดิม 246 ค่ายังอยู่ที่ models/sign_model.h5 และ v2 ที่ models/v2 (ใช้กับ features.py เวอร์ชันนี้ไม่ได้)
MODELS_DIR = os.path.join(BASE_DIR, "models", "v4")
MODEL_PATH = os.path.join(MODELS_DIR, "sign_model.h5")
LABEL_MAP_PATH = os.path.join(MODELS_DIR, "label_map.json")

HOST = "0.0.0.0"
PORT = 8000

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
IDLE_THRESHOLD = F.IDLE_THRESHOLD  # ต้องตรงกับที่ใช้ตัดท่าตอนเทรน
SENTENCE_TIMEOUT = 5.0
# ประโยคที่แปลเสร็จแสดงค้างไว้กี่วินาที แล้วล้างทิ้ง (หน้าเว็บย้ายไปกล่อง "ประโยคล่าสุด")
SENTENCE_DISPLAY_SECONDS = 20.0
CONFIDENCE_THRESHOLD = 0.50  # เกณฑ์กรองความมั่นใจขั้นต่ำ 50%

# ตัวเตือน "อยู่ใกล้กล้องเกินไป": วัดความกว้างไหล่ (หน่วยเป็นสัดส่วนของความสูงภาพ)
# ใน dataset ค่ากลาง ~0.29 แต่กล้องเว็บแคมมุมแคบกว่า ทดสอบจริงแล้วระยะที่ทายได้ดีที่สุดวัดได้ ~0.40-0.44
# และใกล้จนทายพังอยู่ที่ ~0.56 จึงตั้งเกณฑ์ไว้ระหว่างสองช่วงนี้ (อย่าอิงแค่ค่าจาก dataset — จะเตือนตลอด)
# ใช้ 2 เกณฑ์ (เปิดที่ 0.52 ปิดที่ 0.47) กันไม่ให้ข้อความกะพริบเวลาค่าแกว่งอยู่ใกล้เส้น
TOO_CLOSE_ON = 0.52
TOO_CLOSE_OFF = 0.47
SHOULDER_EMA_ALPHA = 0.2
# ตอนใกล้มากจนเห็นแต่หน้า pose มักหาไหล่ไม่เจอ จึงประมาณความกว้างไหล่จากความสูงใบหน้าแทน
# (ใน dataset ความสูงใบหน้า ≈ 0.476 เท่าของความกว้างไหล่ ช่วง 5-95% คือ 0.44-0.52)
FACE_TO_SHOULDER_RATIO = 0.476
# ไม่เห็นทั้งตัวและหน้า — คงสถานะเตือนไว้สักพักก่อนล้าง (ใกล้มาก ๆ ก็ตรวจไม่เจอได้เหมือนกัน)
DISTANCE_HOLD_SECONDS = 1.5

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


# แขน/ไหล่ที่โมเดลใช้ (ไหล่-ไหล่, ไหล่-ศอก-ข้อมือ ทั้งสองข้าง)
UPPER_BODY_CONNECTIONS = [(11, 12), (11, 13), (13, 15), (12, 14), (14, 16)]


def draw_skeleton(image_bgr, results):
    h, w, _ = image_bgr.shape
    if results.pose_landmarks:
        lms = results.pose_landmarks.landmark
        for a, b in UPPER_BODY_CONNECTIONS:
            pa = (int(lms[a].x * w), int(lms[a].y * h))
            pb = (int(lms[b].x * w), int(lms[b].y * h))
            cv2.line(image_bgr, pa, pb, (255, 160, 0), 2)
        for idx in F.MODEL_POSE_INDICES:
            cv2.circle(image_bgr, (int(lms[idx].x * w), int(lms[idx].y * h)), 4, (255, 160, 0), -1)

    if results.face_landmarks:
        for idx in F.FACE_INDICES:
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
    expected = (None, F.TARGET_FRAMES, F.NUM_FEATURES)
    if tuple(model.input_shape) != expected:
        raise ValueError(f"โมเดล {MODEL_PATH} รับ input {model.input_shape} แต่ features.py สร้าง {expected}")
    return model, rev_label_map


MODEL_LOCK = threading.Lock()

# โหมดบันทึกท่าตอนทดสอบ (ปิดเป็นค่าเริ่มต้น): ตั้ง env SIGNBRIDGE_RECORD_DIR เพื่อบันทึกพิกัด landmark
# ของทุกท่าที่ทำนาย (ไม่บันทึกภาพ) ไว้เทียบกับข้อมูลเทรน/ใช้เพิ่มข้อมูล ชื่อไฟล์มีคำที่ทายและความมั่นใจ
RECORD_DIR = os.environ.get("SIGNBRIDGE_RECORD_DIR")


def record_gesture(raw_gesture, word, confidence):
    if not RECORD_DIR:
        return
    try:
        os.makedirs(RECORD_DIR, exist_ok=True)
        name = f"{time.strftime('%Y%m%d-%H%M%S')}-{int(time.time() * 1000) % 1000:03d}_{word}_{confidence:.2f}.npy"
        np.save(os.path.join(RECORD_DIR, name), raw_gesture)
    except Exception:
        log.warning("failed to record gesture", exc_info=True)


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
        self.sentence_time = 0.0
        # นับรอบการล้างประโยค (client สั่ง reset_sentence ตอนเริ่มอัด/กดล้าง) — ส่งกลับไปกับทุกข้อความ
        # ให้ client ทิ้งข้อมูลประโยคเก่าที่ยังค้างอยู่ในข้อความก่อนที่ server จะล้างเสร็จ
        self.sentence_epoch = 0
        # ตั้งจาก receiver (asyncio) แล้วค่อยล้างจริงใน process_frame (thread เดียวกับที่แก้ word_buffer)
        self.reset_sentence_requested = False
        self.translated_word = "-"
        self.confidence = 0.0

        # เพิ่มขึ้นทุกครั้งที่มีการทำนายใหม่จริง ๆ (ไม่ใช่แค่ส่ง translated_word ซ้ำทุกเฟรม)
        # ฝั่ง client ใช้ค่านี้แยกแยะ "ท่าทางใหม่" ออกจาก "ค่าเดิมที่ backend ยังไม่อัปเดต"
        # เพื่อไม่ให้ตรวจจับคำเดิมซ้ำ ๆ ทั้งที่ผู้ใช้วางมือลงไปแล้วและยังไม่ได้ทำท่าใหม่
        self.prediction_id = 0
        # เพิ่มขึ้นทุกครั้งที่จบท่าแล้วความมั่นใจต่ำเกินเกณฑ์ (ไม่นับเป็นคำ) — client ใช้แสดง "ไม่ชัดเจน ลองใหม่"
        self.rejected_id = 0

        self.frame_count = 0

        self.shoulder_width_ema = None
        self.too_close = False
        self.last_body_time = 0.0

    def close(self):
        self.holistic.close()

    def _update_distance(self, raw_frame):
        pose = raw_frame[F.POSE_SLICE].reshape(F.NUM_POSE_RAW, 4)
        face = raw_frame[F.FACE_SLICE].reshape(-1, 3)
        # ใช้ไหล่เป็นหลัก ส่วนขนาดหน้าใช้เฉพาะตอนหา pose ไม่เจอ เพราะหน้าแกว่งกว่า (ก้ม/เงย/มือบังหน้า)
        # ถ้าเอาหน้ามาคิดด้วยทุกเฟรม คลิประยะปกติใน dataset จะโดนเตือนผิด ~2%
        if np.any(pose):
            width = float(np.linalg.norm(pose[F.POSE_SHOULDER_L, :2] - pose[F.POSE_SHOULDER_R, :2]))
        elif np.any(face):
            width = float(face[:, 1].max() - face[:, 1].min()) / FACE_TO_SHOULDER_RATIO
        else:
            if time.time() - self.last_body_time > DISTANCE_HOLD_SECONDS:
                # ไม่เห็นคนนานพอแล้ว (ออกจากเฟรม) — ล้างค่า ไม่ค้างคำเตือนไว้
                self.shoulder_width_ema = None
                self.too_close = False
            return
        self.last_body_time = time.time()
        if self.shoulder_width_ema is None:
            self.shoulder_width_ema = width
        else:
            self.shoulder_width_ema += SHOULDER_EMA_ALPHA * (width - self.shoulder_width_ema)
        if self.too_close:
            self.too_close = self.shoulder_width_ema > TOO_CLOSE_OFF
        else:
            self.too_close = self.shoulder_width_ema > TOO_CLOSE_ON

    def request_sentence_reset(self):
        self.reset_sentence_requested = True

    def process_frame(self, image_bgr, show_skeleton: bool):
        self.frame_count += 1
        if self.reset_sentence_requested:
            self.reset_sentence_requested = False
            self.word_buffer = []
            self.transformed_sentence = ""
            self.sentence_epoch += 1
            log.info("sentence reset by client (epoch %d)", self.sentence_epoch)
        _t0 = time.time()

        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        results = self.holistic.process(image_rgb)
        _elapsed_ms = (time.time() - _t0) * 1000

        img_h, img_w = image_bgr.shape[:2]
        # ลบมือที่วางพักต่ำกว่าแนวอกออก (เหมือนตอนเทรน) — มือที่พักอยู่ในเฟรมจะไม่ทำให้บันทึกท่าค้างไว้
        frame_features = F.drop_resting_hands(F.extract_raw_frame(results, img_w, img_h))
        has_hand = F.has_hand(frame_features)
        self._update_distance(frame_features)

        if self.frame_count % 50 == 1:
            log.info(
                "frame #%d shape=%s mean=%.1f holistic.process=%.0fms has_pose=%s has_face=%s has_hand=%s is_recording=%s buffer_len=%d shoulder_w=%s too_close=%s",
                self.frame_count, image_bgr.shape, float(image_bgr.mean()), _elapsed_ms,
                bool(results.pose_landmarks), bool(results.face_landmarks), has_hand,
                self.is_recording, len(self.gesture_sequence),
                None if self.shoulder_width_ema is None else round(self.shoulder_width_ema, 3), self.too_close,
            )

        if has_hand:
            self.last_hand_time = time.time()
            if not self.is_recording:
                self.is_recording = True
                self.gesture_sequence = []

        if self.is_recording:
            if has_hand:
                self.gesture_sequence.append(frame_features)
            elif time.time() - self.last_hand_time > IDLE_THRESHOLD:
                self.is_recording = False
                if len(self.gesture_sequence) >= F.MIN_GESTURE_FRAMES:
                    raw_gesture = np.array(self.gesture_sequence)
                    model_input = F.prepare_gesture(raw_gesture)

                    with MODEL_LOCK:
                        res = self.model.predict(np.expand_dims(model_input, axis=0), verbose=0)[0]
                    # กฎหลังโมเดล เช่น "โทรศัพท์" ต้องเอามือแนบหู
                    best_idx, confidence = F.apply_rules(res, raw_gesture, self.rev_label_map)
                    record_gesture(raw_gesture, self.rev_label_map[best_idx], confidence)

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
                        self.rejected_id += 1
                        log.info("ignored low confidence prediction: %.1f%%", confidence * 100)
                
                self.gesture_sequence = []

        if self.word_buffer and (time.time() - self.last_hand_time) > SENTENCE_TIMEOUT:
            self.transformed_sentence = translate_sentence(self.word_buffer)
            self.sentence_time = time.time()
            log.info("sentence: %s => %s", " -> ".join(self.word_buffer), self.transformed_sentence)
            self.word_buffer = []

        if self.transformed_sentence and time.time() - self.sentence_time > SENTENCE_DISPLAY_SECONDS:
            log.info("sentence expired after %.0fs: %s", SENTENCE_DISPLAY_SECONDS, self.transformed_sentence)
            self.transformed_sentence = ""

        frame_b64 = None
        if show_skeleton:
            frame_b64 = encode_frame(draw_skeleton(image_bgr.copy(), results))

        return {
            "type": "prediction",
            "word": self.translated_word,
            "confidence": self.confidence,
            "prediction_id": self.prediction_id,
            "too_close": self.too_close,
            "is_recording": self.is_recording,
            "rejected_id": self.rejected_id,
            "tsl_sequence": list(self.word_buffer),
            "sentence": self.transformed_sentence,
            "sentence_epoch": self.sentence_epoch,
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

            # คำสั่งจาก client: ล้างคำสะสม/ประโยคที่แปลแล้ว (ปุ่มเริ่มอัดประโยค / ล้างประโยค)
            if payload.get("command") == "reset_sentence":
                session.request_sentence_reset()

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