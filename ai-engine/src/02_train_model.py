import os
import sys
import json
import random
import argparse
from collections import Counter, defaultdict

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization, Conv1D, Input, GRU, Bidirectional
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.utils import Sequence

import features as F

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(BASE_DIR, "dataset", "processed_data_v2")
# แต่ละเวอร์ชันบันทึกแยกโฟลเดอร์ (server.py เลือกเวอร์ชันผ่าน MODELS_DIR)
OUTPUT_DIR = os.path.join(BASE_DIR, "models", "v4")

# คำที่รวมเป็น label เดียวกัน (โฟลเดอร์ -> label): ใน dataset ทำท่าเหมือนกัน (มือเดียว แบมือโบก)
# ต่างกันแค่บริบท จึงให้โมเดลตอบคำเดียว
LABEL_MERGE = {"ไม่ใช่": "ไม่"}

# คลิปชื่อ "<คำ>-<เลข>.mp4" — เลขคลิปคือคนทำท่า (คนเดียวกันใช้เลขเดียวกันทุกคำ)
# คลิป 1-21 = ชุดแรก (ถ่ายในห้อง), 22-50 = ชุดหลัง (คนใหม่ หลายสถานที่/แสง)
FIRST_BATCH_LAST_SIGNER = 21
VAL_SIGNERS_PER_BATCH = (3, 5)    # (ชุดแรก, ชุดหลัง)
TEST_SIGNERS_PER_BATCH = (3, 5)
SPLIT_SEED = 42

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def signer_of(npy_file):
    return int(os.path.splitext(npy_file)[0].rsplit("-", 1)[-1])


def load_dataset():
    """คืน list ของ (ท่าดิบที่ตัดแล้ว, label, signer) ใช้ท่าที่ยาวที่สุดของแต่ละคลิป"""
    words = sorted(d for d in os.listdir(PROCESSED_DIR) if os.path.isdir(os.path.join(PROCESSED_DIR, d)))
    labels = sorted({LABEL_MERGE.get(w, w) for w in words})
    label_map = {label: i for i, label in enumerate(labels)}

    samples, skipped = [], []
    for word in words:
        word_dir = os.path.join(PROCESSED_DIR, word)
        for npy_file in sorted(f for f in os.listdir(word_dir) if f.endswith(".npy")):
            raw = np.load(os.path.join(word_dir, npy_file))
            segments = F.segment_gestures(raw)
            if not segments:
                skipped.append(npy_file)
                continue
            samples.append((max(segments, key=len), label_map[LABEL_MERGE.get(word, word)], signer_of(npy_file)))
    return samples, label_map, skipped


def split_signers(signers):
    """แบ่งคนทำท่าเป็น train/val/test โดยให้ทั้งชุดแรกและชุดหลังอยู่ในทุกกลุ่ม"""
    rng = random.Random(SPLIT_SEED)
    batches = [
        sorted(s for s in signers if s <= FIRST_BATCH_LAST_SIGNER),
        sorted(s for s in signers if s > FIRST_BATCH_LAST_SIGNER),
    ]
    split = {"train": [], "val": [], "test": []}
    for batch, n_val, n_test in zip(batches, VAL_SIGNERS_PER_BATCH, TEST_SIGNERS_PER_BATCH):
        rng.shuffle(batch)
        split["test"] += batch[:n_test]
        split["val"] += batch[n_test:n_test + n_val]
        split["train"] += batch[n_test + n_val:]
    return {k: sorted(v) for k, v in split.items()}


# ---------------------------------------------------------------------------
# Augmentation (ทำกับท่าดิบก่อน resample/normalize เหมือนเป็นคลิปใหม่)
# ---------------------------------------------------------------------------
X_COLS = np.concatenate([
    np.arange(0, F.FACE_SLICE.stop, 3),                           # มือ 2 ข้าง + หน้า (x, y, z)
    np.arange(F.POSE_SLICE.start, F.POSE_SLICE.stop, 4),          # pose (x, y, z, visibility)
])
Y_COLS = X_COLS + 1


# คู่จุดซ้าย-ขวาสำหรับ mirror (สลับข้างเหมือนคนถนัดซ้าย)
POSE_MIRROR = [0, 4, 5, 6, 1, 2, 3, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19, 22, 21, 24, 23]
_FACE_PAIRS = [(61, 291), (185, 409), (40, 270), (39, 269), (37, 267), (146, 375), (91, 321), (181, 405),
               (84, 314), (70, 300), (63, 293), (105, 334), (66, 296), (107, 336), (55, 285), (65, 295),
               (52, 282), (53, 283), (33, 263), (159, 386), (145, 374), (234, 454)]
_face_swap = {a: b for a, b in _FACE_PAIRS}
_face_swap.update({b: a for a, b in _FACE_PAIRS})
FACE_MIRROR = [F.FACE_INDICES.index(_face_swap.get(i, i)) for i in F.FACE_INDICES]


def mirror(seq, center_x):
    """กลับซ้าย-ขวา: พลิกแกน x รอบกึ่งกลางไหล่ แล้วสลับข้อมูลมือ/หน้า/pose ฝั่งซ้ายกับขวา"""
    out = seq.copy()
    x, y = out[:, X_COLS], out[:, Y_COLS]
    out[:, X_COLS] = np.where((x != 0) | (y != 0), 2 * center_x - x, 0)
    lh, rh = out[:, F.LH_SLICE].copy(), out[:, F.RH_SLICE].copy()
    out[:, F.LH_SLICE], out[:, F.RH_SLICE] = rh, lh
    face = out[:, F.FACE_SLICE].reshape(len(out), -1, 3)
    out[:, F.FACE_SLICE] = face[:, FACE_MIRROR].reshape(len(out), -1)
    pose = out[:, F.POSE_SLICE].reshape(len(out), F.NUM_POSE_RAW, 4)
    out[:, F.POSE_SLICE] = pose[:, POSE_MIRROR].reshape(len(out), -1)
    return out


def crop_at_chest(seq, crop_y):
    """
    จำลองกล้องที่เห็นแค่ช่วงอกขึ้นไป: มือที่อยู่ต่ำกว่าขอบภาพจะตรวจไม่เจอ (เป็น 0) และ server ตัดเฟรม
    ที่ไม่เห็นมือทิ้ง — คืน None ถ้าเหลือเฟรมน้อยเกินจะเป็นท่าได้
    """
    out = seq.copy()
    for sl in (F.LH_SLICE, F.RH_SLICE):
        hand = out[:, sl].reshape(len(out), F.NUM_HAND_POINTS, 3)
        below = np.any(hand, axis=(1, 2)) & (hand[:, :, 1].mean(axis=1) > crop_y)
        out[below, sl] = 0
    out = out[[F.has_hand(f) for f in out]]
    return out if len(out) >= F.MIN_GESTURE_FRAMES else None


def body_center(seq):
    pose = seq[:, F.POSE_SLICE].reshape(len(seq), F.NUM_POSE_RAW, 4)
    shoulders = (pose[:, F.POSE_SHOULDER_L, :2] + pose[:, F.POSE_SHOULDER_R, :2]) / 2
    width = np.linalg.norm(pose[:, F.POSE_SHOULDER_L, :2] - pose[:, F.POSE_SHOULDER_R, :2], axis=1)
    return shoulders.mean(axis=0), float(np.median(width))


def augment(segment, rng):
    seq = segment.copy()

    # ความเร็วท่า: คนทำเร็ว/ช้าต่างกัน และ server อาจได้เฟรมไม่ถึง 10 FPS เวลาเครื่องช้า (วัดได้ ~6 FPS)
    length = len(seq)
    new_length = max(F.MIN_GESTURE_FRAMES, int(round(length * rng.uniform(0.5, 1.3))))
    seq = seq[np.linspace(0, length - 1, new_length).round().astype(int)]
    if len(seq) > F.MIN_GESTURE_FRAMES + 2 and rng.random() < 0.5:
        keep = rng.random(len(seq)) > 0.1
        if keep.sum() >= F.MIN_GESTURE_FRAMES:
            seq = seq[keep]

    center, shoulder_width = body_center(seq)

    # สลับซ้าย-ขวา (คนถนัดซ้าย / ท่ามือเดียวที่ใช้มือไหนก็ได้ เช่น "ไม่")
    if rng.random() < 0.5:
        seq = mirror(seq, center[0])

    # กล้องเห็นแค่ช่วงอก (ตั้งกล้องใกล้ / นั่งหน้าโน้ตบุ๊ก)
    if rng.random() < 0.3:
        cropped = crop_at_chest(seq, center[1] + rng.uniform(0.7, 1.3) * shoulder_width)
        if cropped is not None:
            seq = cropped

    # ท่าทาง/สัดส่วนร่างกาย/มุมกล้อง: หมุนเล็กน้อย + ยืดแกน x, y ไม่เท่ากัน รอบกึ่งกลางไหล่
    angle = np.deg2rad(rng.uniform(-10, 10))
    sx, sy = rng.uniform(0.9, 1.1), rng.uniform(0.9, 1.1)
    x, y = seq[:, X_COLS], seq[:, Y_COLS]
    present = (x != 0) | (y != 0)  # จุดที่ตรวจไม่เจอต้องคงเป็น 0
    dx, dy = (x - center[0]) * sx, (y - center[1]) * sy
    new_x = center[0] + dx * np.cos(angle) - dy * np.sin(angle)
    new_y = center[1] + dx * np.sin(angle) + dy * np.cos(angle)
    new_x += rng.normal(0, 0.002, new_x.shape)
    new_y += rng.normal(0, 0.002, new_y.shape)
    seq[:, X_COLS] = np.where(present, new_x, 0)
    seq[:, Y_COLS] = np.where(present, new_y, 0)
    return seq


def to_model_input(segment):
    return F.prepare_gesture(segment)


class AugmentedSequence(Sequence):
    """สุ่ม augmentation ใหม่ทุก epoch"""

    def __init__(self, samples, num_classes, batch_size=16, seed=0):
        super().__init__()
        self.samples = samples
        self.num_classes = num_classes
        self.batch_size = batch_size
        self.rng = np.random.default_rng(seed)
        self.order = np.arange(len(samples))
        self.on_epoch_end()

    def __len__(self):
        return int(np.ceil(len(self.samples) / self.batch_size))

    def __getitem__(self, i):
        idx = self.order[i * self.batch_size:(i + 1) * self.batch_size]
        X = np.stack([to_model_input(augment(self.samples[j][0], self.rng)) for j in idx])
        y = tf.keras.utils.to_categorical([self.samples[j][1] for j in idx], self.num_classes)
        return X, y

    def on_epoch_end(self):
        self.rng.shuffle(self.order)


def build_model(num_classes):
    # Conv1D จับการเคลื่อนไหวช่วงสั้น แล้ว BiGRU อ่านลำดับเวลาทั้งท่า (เดิมใช้ GlobalAveragePooling
    # ซึ่งเฉลี่ยทุกเฟรมรวมกัน ทำให้ลำดับหาย — แยก ไป/มา หรือ ครู (กำ->กาง->คน) กับ คน ได้ยาก)
    return Sequential([
        Input(shape=(F.TARGET_FRAMES, F.NUM_FEATURES)),
        Conv1D(filters=128, kernel_size=3, activation='relu', padding='same'),
        BatchNormalization(),
        Dropout(0.2),

        Conv1D(filters=128, kernel_size=3, activation='relu', padding='same'),
        BatchNormalization(),
        Dropout(0.3),

        Bidirectional(GRU(96)),
        Dropout(0.4),

        Dense(128, activation='relu'),
        Dropout(0.4),
        Dense(num_classes, activation='softmax')
    ])


def simulate_live(segment, fps=6):
    """จำลองกล้องจริง: server ประมวลผลได้ ~6 FPS (จากข้อมูล 10 FPS) และกล้องเห็นแค่ช่วงอก"""
    n = max(F.MIN_GESTURE_FRAMES, round(len(segment) * fps / F.CAPTURE_FPS))
    seq = segment[np.linspace(0, len(segment) - 1, n).round().astype(int)]
    center, shoulder_width = body_center(seq)
    cropped = crop_at_chest(seq, center[1] + 1.0 * shoulder_width)
    return cropped if cropped is not None else seq


def evaluate(model, samples, rev_label_map, transform=None):
    segments = [transform(s[0]) if transform else s[0] for s in samples]
    X = np.stack([to_model_input(g) for g in segments])
    y = np.array([s[1] for s in samples])
    probs = model.predict(X, verbose=0)
    # ผลหลังใช้กฎ (เหมือนที่ server ใช้จริง)
    pred = np.array([F.apply_rules(p, g, rev_label_map)[0] for p, g in zip(probs, segments)])
    raw_acc = float((probs.argmax(axis=1) == y).mean())
    correct = pred == y
    signers = np.array([s[2] for s in samples])
    first = signers <= FIRST_BATCH_LAST_SIGNER

    per_word = defaultdict(list)
    confusions = Counter()
    for t, p in zip(y, pred):
        per_word[rev_label_map[t]].append(t == p)
        if t != p:
            confusions[(rev_label_map[t], rev_label_map[p])] += 1

    return {
        "accuracy": float(correct.mean()),
        "accuracy_without_rules": raw_acc,
        "accuracy_first_batch_signers": float(correct[first].mean()) if first.any() else None,
        "accuracy_second_batch_signers": float(correct[~first].mean()) if (~first).any() else None,
        "per_signer": {int(s): float(correct[signers == s].mean()) for s in sorted(set(signers))},
        "worst_words": sorted(((w, float(np.mean(v))) for w, v in per_word.items()), key=lambda x: x[1])[:10],
        "top_confusions": [f"{t} -> {p} ({n})" for (t, p), n in confusions.most_common(15)],
    }


def main():
    parser = argparse.ArgumentParser(description="เทรนโมเดลจำแนกท่าภาษามือ (แบ่ง train/val/test ตามคนทำท่า)")
    parser.add_argument("--epochs", type=int, default=150)
    args = parser.parse_args()

    samples, label_map, skipped = load_dataset()
    if not samples:
        print(f"❌ ไม่พบข้อมูลใน {PROCESSED_DIR}")
        return
    rev_label_map = {v: k for k, v in label_map.items()}
    print(f"📦 ใช้ได้ {len(samples)} คลิป, {len(label_map)} คำ (ตัดท่าไม่ได้ {len(skipped)} คลิป)")

    split = split_signers({s[2] for s in samples})
    parts = {k: [s for s in samples if s[2] in set(v)] for k, v in split.items()}
    for k, v in split.items():
        print(f"   {k}: {len(v)} คน, {len(parts[k])} คลิป -> คนที่ {v}")

    model = build_model(len(label_map))
    model.compile(optimizer=Adam(learning_rate=0.001), loss='categorical_crossentropy', metrics=['accuracy'])

    X_val = np.stack([to_model_input(s[0]) for s in parts["val"]])
    y_val = tf.keras.utils.to_categorical([s[1] for s in parts["val"]], len(label_map))
    callbacks = [
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=0.00001, verbose=1),
        EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True, verbose=1)
    ]
    history = model.fit(
        AugmentedSequence(parts["train"], len(label_map)),
        epochs=args.epochs,
        validation_data=(X_val, y_val),
        callbacks=callbacks,
        verbose=2,
    )

    test_report = evaluate(model, parts["test"], rev_label_map)
    live_report = evaluate(model, parts["test"], rev_label_map, transform=simulate_live)
    print(f"\n🧪 Test accuracy (คนที่โมเดลไม่เคยเห็น): {test_report['accuracy']:.1%} (ก่อนใช้กฎ {test_report['accuracy_without_rules']:.1%})")
    print(f"   จำลองกล้องจริง (~6 FPS + เห็นแค่อก): {live_report['accuracy']:.1%}")
    print(f"   คำที่แย่ที่สุด (จำลองกล้องจริง): {live_report['worst_words']}")
    print(f"   ชุดแรก: {test_report['accuracy_first_batch_signers']:.1%}  ชุดหลัง: {test_report['accuracy_second_batch_signers']:.1%}")
    print(f"   คำที่แย่ที่สุด: {test_report['worst_words']}")
    print(f"   สับสนบ่อย: {test_report['top_confusions']}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    model.save(os.path.join(OUTPUT_DIR, "sign_model.h5"))
    with open(os.path.join(OUTPUT_DIR, "label_map.json"), "w", encoding="utf-8") as f:
        json.dump(label_map, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUTPUT_DIR, "train_report.json"), "w", encoding="utf-8") as f:
        json.dump({
            "num_features": F.NUM_FEATURES,
            "split": split,
            "skipped_clips": skipped,
            "epochs_run": len(history.history["loss"]),
            "best_val_accuracy": float(max(history.history["val_accuracy"])),
            "test": test_report,
            "test_simulated_live": live_report,
        }, f, ensure_ascii=False, indent=2)
    print(f"\n🎉 บันทึกโมเดลและรายงานที่: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
