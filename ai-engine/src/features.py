"""
นิยาม landmark และ feature ของ SignBridge — ใช้ร่วมกันทั้ง 01_extract_landmarks.py (สกัด),
02_train_model.py (เทรน) และ server.py (ใช้งานจริง) เพื่อให้ทุกฝั่งคำนวณแบบเดียวกันเสมอ

แบ่งเป็น 2 ชั้น:
  1) raw frame (RAW_DIM ค่า) — สิ่งที่บันทึกลง .npy ตอนสกัด เก็บ pose ช่วงบนไว้ครบ 25 จุด
     พร้อม visibility แม้โมเดลจะยังไม่ได้ใช้ทุกจุด เพื่อให้ลองเพิ่ม/ตัดจุดได้โดยไม่ต้องสกัดใหม่
  2) model features — prepare_gesture() แปลงท่าดิบ (เฉพาะเฟรมที่เห็นมือ) เป็น input ของโมเดล
     (TARGET_FRAMES, NUM_FEATURES)

พิกัด x และ z ถูกคูณด้วยอัตราส่วนภาพ (กว้าง/สูง) ตั้งแต่ตอนสกัด เพื่อให้ x กับ y อยู่ในหน่วยเดียวกัน
(ความสูงภาพ) ไม่อย่างนั้นระยะมือ–ไหล่จะเพี้ยนไปตามอุปกรณ์ (วิดีโอเทรน 16:9 แต่ iPad/มือถือมัก 3:4)
"""
import numpy as np

# ---------------------------------------------------------------------------
# Raw layout
# ---------------------------------------------------------------------------
NUM_HAND_POINTS = 21

FACE_INDICES = [
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314, 405, 321, 375,  # Lips
    70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 55, 65, 52, 53, 285, 295, 282, 283, 33, 263,  # Eyebrows & Eye corners
    159, 145, 386, 374,  # เปลือกตาบน/ล่าง ซ้าย-ขวา (ตาเบิก/หรี่)
    1,                   # ปลายจมูก — จุดกลางของหน้า
    234, 454,            # แก้มซ้าย/ขวา — ใช้เป็นขนาดของหน้า
    152,                 # คาง
]
FACE_NOSE = FACE_INDICES.index(1)
FACE_CHEEK_L = FACE_INDICES.index(234)
FACE_CHEEK_R = FACE_INDICES.index(454)
FACE_CHIN = FACE_INDICES.index(152)

# pose ช่วงบน 0-24 (จมูก ตา หู ปาก ไหล่ ศอก ข้อมือ นิ้วจาก pose สะโพก) เก็บ x, y, z, visibility
NUM_POSE_RAW = 25
POSE_NOSE, POSE_EAR_L, POSE_EAR_R = 0, 7, 8
POSE_MOUTH_L, POSE_MOUTH_R = 9, 10
POSE_SHOULDER_L, POSE_SHOULDER_R = 11, 12

LH_SLICE = slice(0, 63)
RH_SLICE = slice(63, 126)
FACE_SLICE = slice(126, 126 + len(FACE_INDICES) * 3)
POSE_SLICE = slice(FACE_SLICE.stop, FACE_SLICE.stop + NUM_POSE_RAW * 4)
RAW_DIM = POSE_SLICE.stop

# ---------------------------------------------------------------------------
# Model feature layout
# ---------------------------------------------------------------------------
# จุด pose ที่โมเดลใช้: จมูก, หู 2, ไหล่ 2, ศอก 2, ข้อมือ 2 (สะโพก 23-24 เก็บใน raw แต่ยังไม่ใช้
# เพราะนักเรียนที่นั่งหน้ากล้องมักไม่เห็นสะโพก)
MODEL_POSE_INDICES = [0, 7, 8, 11, 12, 13, 14, 15, 16]

# MediaPipe ไม่มีจุดอก — ประมาณจากกึ่งกลางไหล่ลงไปในแนวตั้งฉากกับเส้นไหล่ (หน่วย: ความกว้างไหล่)
# ใช้ได้โดยไม่ต้องเห็นสะโพก เหมาะกับกล้องที่เห็นแค่ช่วงอกขึ้นไป
CHEST_OFFSET = 0.55

# จุดเป้าหมายที่วัดระยะจากมือ (ท่าที่ต่างกันแค่ตำแหน่ง เช่น โทรศัพท์=หู, หิว=คอ, ฉัน=อก)
BODY_TARGETS = ["ear", "mouth", "chin", "neck", "chest"]

# ข้อต่อนิ้ว (โคนนิ้ว, ปลายนิ้ว) สำหรับวัดการงอ/เหยียด
FINGERS = [(5, 8), (9, 12), (13, 16), (17, 20)]  # ชี้ กลาง นาง ก้อย (โป้งคำนวณแยก)

PER_HAND_EXTRA = len(BODY_TARGETS) + 1 + 5 + 3 + 1  # ระยะถึงจุดบนตัว, ขนาดมือ, นิ้ว 5, ทิศฝ่ามือ, มี/ไม่มีมือ
NUM_FRAME_FEATURES = (
    126                                   # มือซ้าย/ขวา รูปทรงมือ (เทียบกับข้อมือของตัวเอง)
    + len(FACE_INDICES) * 3               # หน้า (เทียบกับปลายจมูก)
    + (len(MODEL_POSE_INDICES) + 2) * 3   # pose + จุดคอ + จุดอก (เทียบกับกึ่งกลางไหล่)
    + 2 * 2                               # ตำแหน่งกึ่งกลางมือซ้าย/ขวา (x, y) เทียบกับลำตัว
    + 2 * PER_HAND_EXTRA
)
NUM_VELOCITY_FEATURES = 2 * 3             # ความเร็วของตำแหน่งมือ (x, y) และขนาดมือ ต่อมือ
NUM_FEATURES = NUM_FRAME_FEATURES + NUM_VELOCITY_FEATURES


def _points(landmarks, aspect, indices=None, with_visibility=False):
    lms = landmarks.landmark
    if indices is not None:
        lms = [lms[i] for i in indices]
    if with_visibility:
        return np.array([[p.x * aspect, p.y, p.z * aspect, p.visibility] for p in lms]).flatten()
    return np.array([[p.x * aspect, p.y, p.z * aspect] for p in lms]).flatten()


def extract_raw_frame(results, image_width, image_height):
    """แปลงผล MediaPipe Holistic ของ 1 เฟรมเป็น raw vector (RAW_DIM ค่า) ส่วนที่ตรวจไม่เจอเป็น 0"""
    aspect = image_width / float(image_height)
    frame = np.zeros(RAW_DIM)
    if results.left_hand_landmarks:
        frame[LH_SLICE] = _points(results.left_hand_landmarks, aspect)
    if results.right_hand_landmarks:
        frame[RH_SLICE] = _points(results.right_hand_landmarks, aspect)
    if results.face_landmarks:
        frame[FACE_SLICE] = _points(results.face_landmarks, aspect, FACE_INDICES)
    if results.pose_landmarks:
        frame[POSE_SLICE] = _points(results.pose_landmarks, aspect, range(NUM_POSE_RAW), with_visibility=True)
    return frame


def has_hand(raw_frame):
    return bool(np.any(raw_frame[LH_SLICE]) or np.any(raw_frame[RH_SLICE]))


# มือที่อยู่ต่ำกว่าเส้นไหล่เกินค่านี้ (หน่วย: ความกว้างไหล่) ถือว่า "วางพัก" ไม่ได้ทำท่า — ประมาณขอบล่าง
# ของภาพเวลากล้องเห็นแค่ช่วงอก ในวิดีโอ dataset คนมักวางมืออีกข้างไว้ที่เอว (กล้องเห็น) แต่ตอนใช้งานจริง
# หน้าโน้ตบุ๊ก มือที่พักหลุดเฟรม ถ้าไม่ตัดออกทั้งสองฝั่ง ท่ามือเดียวในข้อมูลเทรนจะมี "มือที่ 2" ติดมาตลอด
REST_LINE = 1.0


def drop_resting_hands(raw_frame):
    """
    ลบมือที่วางพักออกจากเฟรม — ใช้ทั้งตอนเทรนและใน server ก่อนตัดท่า
    ตัดเฉพาะกรณี "มือหนึ่งยกขึ้นเหนือแนวอก อีกมืออยู่ต่ำกว่า" (ทำท่ามือเดียว อีกมือพัก) ถ้าทั้งสองมือ
    อยู่ต่ำพร้อมกันจะเก็บไว้ เพราะบางคำใน dataset (เช่น คน, ไม่ได้) ทำที่ระดับเอวจริง ๆ
    """
    pose = raw_frame[POSE_SLICE].reshape(NUM_POSE_RAW, 4)
    shoulder_width = np.linalg.norm(pose[POSE_SHOULDER_L, :2] - pose[POSE_SHOULDER_R, :2])
    lh = raw_frame[LH_SLICE].reshape(NUM_HAND_POINTS, 3)
    rh = raw_frame[RH_SLICE].reshape(NUM_HAND_POINTS, 3)
    if not np.any(pose) or shoulder_width == 0 or not (np.any(lh) and np.any(rh)):
        return raw_frame
    rest_y = (pose[POSE_SHOULDER_L, 1] + pose[POSE_SHOULDER_R, 1]) / 2 + REST_LINE * shoulder_width
    lh_low, rh_low = lh[:, 1].mean() > rest_y, rh[:, 1].mean() > rest_y
    if lh_low == rh_low:
        return raw_frame
    out = raw_frame.copy()
    out[LH_SLICE if lh_low else RH_SLICE] = 0
    return out


def _normalize_local(points, center_idx=0, scale=None):
    points = points - points[center_idx]
    if scale is None:
        scale = np.max(np.abs(points))
    return points / scale if scale > 0 else points


def body_frame(raw_frame):
    """
    คืน (center, shoulder_width, targets) ของเฟรม — targets คือพิกัด xy ของหู(2), ปาก, คาง, คอ, อก
    คืน None ถ้าไม่เห็นไหล่
    """
    pose = raw_frame[POSE_SLICE].reshape(NUM_POSE_RAW, 4)[:, :3]
    shoulder_vec = pose[POSE_SHOULDER_R, :2] - pose[POSE_SHOULDER_L, :2]
    shoulder_width = np.linalg.norm(shoulder_vec)
    if not np.any(pose) or shoulder_width == 0:
        return None
    center = (pose[POSE_SHOULDER_L] + pose[POSE_SHOULDER_R]) / 2
    mouth = (pose[POSE_MOUTH_L] + pose[POSE_MOUTH_R]) / 2
    # MediaPipe ไม่มีจุดคอ ใช้กึ่งกลางระหว่างกึ่งกลางไหล่กับปากแทน (สำหรับท่าอย่าง "หิว" ที่ทำตรงคอ)
    neck = (center + mouth) / 2
    # ทิศ "ลง" ตั้งฉากกับเส้นไหล่ (เลือกฝั่งที่ y เพิ่ม = ลงล่างในภาพ)
    down = np.array([-shoulder_vec[1], shoulder_vec[0]]) / shoulder_width
    if down[1] < 0:
        down = -down
    chest = center.copy()
    chest[:2] = center[:2] + down * CHEST_OFFSET * shoulder_width

    face = raw_frame[FACE_SLICE].reshape(-1, 3)
    chin = face[FACE_CHIN] if np.any(face) else mouth
    targets = {
        "ear": np.stack([pose[POSE_EAR_L, :2], pose[POSE_EAR_R, :2]]),
        "mouth": mouth[None, :2],
        "chin": chin[None, :2],
        "neck": neck[None, :2],
        "chest": chest[None, :2],
    }
    return center, shoulder_width, neck, chest, targets


def _hand_extras(hand, body):
    """feature เพิ่มของมือ 1 ข้าง (PER_HAND_EXTRA ค่า) — มือที่ไม่เห็นเป็น 0 ทั้งหมด"""
    out = np.zeros(PER_HAND_EXTRA)
    if not np.any(hand):
        return out
    i = 0
    if body is not None:
        _, shoulder_width, _, _, targets = body
        for name in BODY_TARGETS:
            # ระยะที่ใกล้ที่สุดจากจุดใดก็ได้บนมือถึงเป้าหมาย (หน่วย: ความกว้างไหล่)
            d = np.linalg.norm(hand[:, None, :2] - targets[name][None, :, :], axis=2)
            out[i] = d.min() / shoulder_width
            i += 1
        # ขนาดมือเทียบกับไหล่ — มือเข้าใกล้กล้อง (เช่น "ห้าม" ดันไปข้างหน้า) จะใหญ่ขึ้น
        out[i] = np.linalg.norm(hand[9, :2] - hand[0, :2]) / shoulder_width
    i = len(BODY_TARGETS) + 1

    # การงอ/เหยียดนิ้ว: ระยะปลายนิ้วถึงข้อมือ เทียบกับโคนนิ้วถึงข้อมือ (แยก แบ/กำ/คว้า/ชูโป้ง)
    wrist = hand[0]
    for mcp, tip in FINGERS:
        base = np.linalg.norm(hand[mcp] - wrist)
        out[i] = np.linalg.norm(hand[tip] - wrist) / base if base > 0 else 0
        i += 1
    palm_width = np.linalg.norm(hand[5] - hand[17])
    out[i] = np.linalg.norm(hand[4] - hand[17]) / palm_width if palm_width > 0 else 0  # โป้งกาง/หุบ
    i += 1

    # ทิศที่ฝ่ามือหัน (normal ของระนาบฝ่ามือ) — แยกฝ่ามือหันออก (ห้าม) กับหันเข้า/ด้านข้าง
    normal = np.cross(hand[5] - wrist, hand[17] - wrist)
    norm = np.linalg.norm(normal)
    out[i:i + 3] = normal / norm if norm > 0 else 0
    i += 3
    out[i] = 1.0  # เห็นมือนี้ (นับจำนวนมือที่ใช้ เช่น ไม่ vs ไม่ใช่)
    return out


def normalize_frame(raw_frame):
    """raw frame -> feature ต่อเฟรม (NUM_FRAME_FEATURES ค่า)"""
    lh = raw_frame[LH_SLICE].reshape(NUM_HAND_POINTS, 3)
    rh = raw_frame[RH_SLICE].reshape(NUM_HAND_POINTS, 3)
    face = raw_frame[FACE_SLICE].reshape(-1, 3)
    pose = raw_frame[POSE_SLICE].reshape(NUM_POSE_RAW, 4)[:, :3]
    lh_found, rh_found = np.any(lh), np.any(rh)

    # รูปทรงมือ: เทียบกับข้อมือของมือนั้นเอง (ไม่ขึ้นกับตำแหน่ง/ขนาดมือในภาพ)
    lh_shape = _normalize_local(lh) if lh_found else np.zeros_like(lh)
    rh_shape = _normalize_local(rh) if rh_found else np.zeros_like(rh)

    # หน้า: จุดกลางที่ปลายจมูก ขนาดตามความกว้างแก้ม
    face_feat = np.zeros_like(face)
    if np.any(face):
        face_width = np.linalg.norm(face[FACE_CHEEK_L, :2] - face[FACE_CHEEK_R, :2])
        face_feat = _normalize_local(face, FACE_NOSE, face_width)

    # ลำตัว: ทุกจุดเทียบกับกึ่งกลางไหล่ หารด้วยความกว้างไหล่ ทำให้โมเดลรู้ว่ามืออยู่ระดับ
    # อก/คอ/หน้า/เหนือหัว ไม่ว่าผู้ใช้จะยืนใกล้/ไกลกล้องแค่ไหน
    body_feat = np.zeros((len(MODEL_POSE_INDICES) + 2, 3))
    hand_pos = np.zeros((2, 2))
    body = body_frame(raw_frame)
    if body is not None:
        center, shoulder_width, neck, chest, _ = body
        body_points = np.vstack([pose[MODEL_POSE_INDICES], neck, chest])
        body_feat = (body_points - center) / shoulder_width
        # ใช้แค่ x, y เพราะ z ของมือเป็นความลึกเทียบกับข้อมือตัวเอง คนละสเกลกับ z ของ pose
        if lh_found:
            hand_pos[0] = (lh.mean(axis=0)[:2] - center[:2]) / shoulder_width
        if rh_found:
            hand_pos[1] = (rh.mean(axis=0)[:2] - center[:2]) / shoulder_width

    return np.concatenate([
        lh_shape.flatten(), rh_shape.flatten(), face_feat.flatten(), body_feat.flatten(), hand_pos.flatten(),
        _hand_extras(lh, body), _hand_extras(rh, body),
    ])


# ---------------------------------------------------------------------------
# การตัดท่าและเตรียม input — ต้องตรงกับ GestureSession ใน server.py
# ---------------------------------------------------------------------------
TARGET_FRAMES = 30
CAPTURE_FPS = 10          # frontend ส่งเฟรมประมาณ 10 FPS (FRAME_SEND_INTERVAL_MS = 100)
IDLE_THRESHOLD = 0.7      # ไม่เห็นมือเกินกี่วินาทีถึงถือว่าจบท่า
MIN_GESTURE_FRAMES = 5    # ท่าที่สั้นกว่านี้ server ไม่ส่งเข้าโมเดล


def segment_gestures(raw_sequence, fps=CAPTURE_FPS):
    """
    ตัดลำดับเฟรม (ที่ ~fps) เป็นท่าแบบเดียวกับ server: ลบมือที่วางพักออกก่อน แล้วเริ่มบันทึกเมื่อเห็นมือ
    เก็บเฉพาะเฟรมที่เห็นมือ และจบท่าเมื่อไม่เห็นมือนานเกิน IDLE_THRESHOLD วินาที
    คืนค่าเป็น list ของท่า (array ของเฟรม)
    """
    max_gap = int(round(IDLE_THRESHOLD * fps))
    segments, current, gap = [], [], 0
    for frame in raw_sequence:
        frame = drop_resting_hands(frame)
        if has_hand(frame):
            current.append(frame)
            gap = 0
        elif current:
            gap += 1
            if gap > max_gap:
                segments.append(np.array(current))
                current, gap = [], 0
    if current:
        segments.append(np.array(current))
    return [s for s in segments if len(s) >= MIN_GESTURE_FRAMES]


def resample_sequence(sequence, target_frames=TARGET_FRAMES):
    """
    ยืด/ย่อให้ได้ target_frames เฟรมเสมอ (เลือกเฟรมแบบกระจายเท่า ๆ กัน ท่าสั้นจะมีเฟรมซ้ำ)
    ไม่เติม 0 ท้ายแบบเดิม เพราะเครื่องที่ประมวลผลช้า (เช่น ~6 FPS) จะได้ท่าที่สั้นกว่าตอนเทรน
    แล้วโมเดลจะเห็นเป็น "ท่าครึ่งเดียว + ความว่างเปล่า" ซึ่งไม่เคยเจอตอนเทรน
    """
    total = len(sequence)
    if total == 0:
        return np.zeros((target_frames, np.shape(sequence)[1] if np.ndim(sequence) == 2 else RAW_DIM))
    indices = np.linspace(0, total - 1, target_frames).round().astype(int)
    return np.asarray(sequence)[indices]


def _velocity(frame_features):
    """
    ความเร็วของตำแหน่งกึ่งกลางมือ (x, y) และขนาดมือ ต่อมือ — แยก โบก (ไม่) / ดัน (ห้าม) / ไป-มา
    คูณด้วยจำนวนเฟรมของท่า/TARGET_FRAMES ให้ค่าไม่ขึ้นกับ FPS (เครื่องช้าได้เฟรมน้อยแต่ขยับต่อเฟรมมากกว่า)
    """
    n = len(frame_features)
    pos_start = 126 + len(FACE_INDICES) * 3 + (len(MODEL_POSE_INDICES) + 2) * 3
    extras_start = pos_start + 4
    scale_idx = [extras_start + len(BODY_TARGETS), extras_start + PER_HAND_EXTRA + len(BODY_TARGETS)]
    present_idx = [extras_start + PER_HAND_EXTRA - 1, extras_start + 2 * PER_HAND_EXTRA - 1]

    vel = np.zeros((n, NUM_VELOCITY_FEATURES))
    if n < 2:
        return vel
    for h in range(2):
        cols = [pos_start + 2 * h, pos_start + 2 * h + 1, scale_idx[h]]
        values = frame_features[:, cols]
        present = frame_features[:, present_idx[h]] > 0
        delta = np.diff(values, axis=0) * (n / TARGET_FRAMES)
        valid = present[1:] & present[:-1]
        vel[1:, 3 * h:3 * h + 3] = np.where(valid[:, None], delta, 0)
    return vel


def prepare_gesture(raw_gesture):
    """
    ท่าดิบ (เฉพาะเฟรมที่เห็นมือ, จำนวนเฟรมเท่าไหร่ก็ได้) -> input ของโมเดล (TARGET_FRAMES, NUM_FEATURES)
    คำนวณ feature และความเร็วจากเฟรมจริงก่อน แล้วค่อย resample
    """
    raw_gesture = np.asarray(raw_gesture)
    if len(raw_gesture) == 0:
        return np.zeros((TARGET_FRAMES, NUM_FEATURES), dtype=np.float32)
    frame_features = np.array([normalize_frame(f) for f in raw_gesture])
    features = np.hstack([frame_features, _velocity(frame_features)])
    return resample_sequence(features).astype(np.float32)


# ---------------------------------------------------------------------------
# กฎหลังโมเดล (บังคับตามลักษณะท่าที่ผู้เชี่ยวชาญกำหนด)
# ---------------------------------------------------------------------------
# "โทรศัพท์" ต้องเอามือแนบหู — ถ้าตลอดท่ามือไม่เคยเข้าใกล้หูเกินเกณฑ์นี้ (หน่วย: ความกว้างไหล่)
# จะไม่ตอบว่าโทรศัพท์ เกณฑ์วัดจาก dataset 50 คน: คลิปโทรศัพท์มีค่ากลาง 0.12, 95% ไม่เกิน 0.21
# (ผ่านเกณฑ์ 48/50 คลิป) ส่วน ไป/มา มีค่ากลาง 0.39/0.52
PHONE_WORD = "โทรศัพท์"
PHONE_MAX_EAR_DISTANCE = 0.30


def min_hand_ear_distance(raw_gesture):
    """ระยะที่ใกล้ที่สุดระหว่างมือ (ข้างใดก็ได้) กับหู (ข้างใดก็ได้) ตลอดท่า"""
    best = np.inf
    for frame in raw_gesture:
        body = body_frame(frame)
        if body is None:
            continue
        _, shoulder_width, _, _, targets = body
        for sl in (LH_SLICE, RH_SLICE):
            hand = frame[sl].reshape(NUM_HAND_POINTS, 3)
            if np.any(hand):
                d = np.linalg.norm(hand[:, None, :2] - targets["ear"][None, :, :], axis=2).min()
                best = min(best, d / shoulder_width)
    return best


def apply_rules(probabilities, raw_gesture, rev_label_map):
    """ปรับผลทำนายตามกฎ คืน (index คำ, ความมั่นใจ)"""
    order = np.argsort(probabilities)[::-1]
    for idx in order:
        word = rev_label_map[int(idx)]
        if word == PHONE_WORD and min_hand_ear_distance(raw_gesture) > PHONE_MAX_EAR_DISTANCE:
            continue  # ไม่แนบหู ไม่ใช่โทรศัพท์ — ไปดูคำอันดับถัดไป
        return int(idx), float(probabilities[idx])
    return int(order[0]), float(probabilities[order[0]])
