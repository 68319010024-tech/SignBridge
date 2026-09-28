import os
import sys
import csv
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed

import cv2
import numpy as np
import mediapipe as mp

import features as F

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DATA_DIR = os.path.join(BASE_DIR, "dataset", "raw_videos", "รวมภาษามือ")
# v2 = มือ + หน้า + pose ช่วงบน (ดู features.py) — แยกโฟลเดอร์จาก processed_data เดิม (246 ค่า)
PROCESSED_DIR = os.path.join(BASE_DIR, "dataset", "processed_data_v2")
REPORT_PATH = os.path.join(BASE_DIR, "dataset", "extraction_report.csv")

# คลิปถูกสกัดที่ ~10 FPS เท่ากับที่ frontend ส่งเฟรมให้ server จริง และเก็บทุกเฟรม (ความยาวไม่เท่ากัน)
# การตัดท่า/resample เป็น 30 เฟรมทำตอนเทรนด้วย features.segment_gestures() แบบเดียวกับ server
TARGET_FPS = F.CAPTURE_FPS

# คลิปที่เจอมือน้อยกว่าเกณฑ์นี้ (สัดส่วนเฟรม) จะถูก flag ในรายงานให้เปิดดูด้วยตาก่อนเทรน
LOW_HAND_RATIO = 0.5

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def extract_landmarks_from_video(video_path, target_fps=TARGET_FPS):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, int(round(fps / target_fps)))

    sequence = []
    # สร้าง Holistic ใหม่ทุกคลิป ไม่ให้ tracking state ของคลิปก่อนหน้าติดมาถึงเฟรมแรกของคลิปนี้
    with mp.solutions.holistic.Holistic(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as holistic:
        idx = 0
        while cap.grab():
            if idx % step == 0:
                ok, frame = cap.retrieve()
                if ok:
                    h, w = frame.shape[:2]
                    results = holistic.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    sequence.append(F.extract_raw_frame(results, w, h))
            idx += 1
    cap.release()

    return np.array(sequence) if sequence else None


def process_one(job):
    video_path, save_path = job
    data = extract_landmarks_from_video(video_path)
    if data is None:
        return save_path, False
    np.save(save_path, data)
    return save_path, True


def write_report():
    # สรุปคุณภาพ landmark ของทุกคลิปจากไฟล์ .npy (ครอบคลุมทั้งไฟล์ที่ถูกข้าม และไฟล์ที่เพิ่งสกัด)
    rows = []
    for word in sorted(os.listdir(PROCESSED_DIR)):
        word_dir = os.path.join(PROCESSED_DIR, word)
        if not os.path.isdir(word_dir):
            continue
        for npy_file in sorted(f for f in os.listdir(word_dir) if f.endswith(".npy")):
            seq = np.load(os.path.join(word_dir, npy_file))
            has_lh = np.any(seq[:, F.LH_SLICE], axis=1)
            has_rh = np.any(seq[:, F.RH_SLICE], axis=1)
            has_face = np.any(seq[:, F.FACE_SLICE], axis=1)
            has_pose = np.any(seq[:, F.POSE_SLICE], axis=1)
            hand_ratio = float((has_lh | has_rh).mean())
            segments = F.segment_gestures(seq)
            rows.append({
                "word": word,
                "file": npy_file,
                "frames": len(seq),
                "left_hand": round(float(has_lh.mean()), 3),
                "right_hand": round(float(has_rh.mean()), 3),
                "any_hand": round(hand_ratio, 3),
                "face": round(float(has_face.mean()), 3),
                "pose": round(float(has_pose.mean()), 3),
                # จำนวนท่าที่ server จะตัดได้จากคลิปนี้ และความยาว (เฟรม) ของท่าที่ยาวที่สุด
                "gestures": len(segments),
                "longest_gesture": max((len(g) for g in segments), default=0),
                "low_hand": int(hand_ratio < LOW_HAND_RATIO),
            })

    # utf-8-sig เพื่อให้ Excel เปิดภาษาไทยได้ถูกต้อง
    with open(REPORT_PATH, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    low = [r for r in rows if r["low_hand"]]
    no_gesture = [r for r in rows if r["gestures"] == 0]
    print(f"📋 รายงานคุณภาพ {len(rows)} คลิป -> {REPORT_PATH}")
    print(f"⚠️ คลิปที่เจอมือ < {LOW_HAND_RATIO:.0%} ของเฟรม: {len(low)} คลิป")
    print(f"⚠️ คลิปที่ตัดท่าไม่ได้เลย (ใช้เทรนไม่ได้): {len(no_gesture)} คลิป")


def main():
    parser = argparse.ArgumentParser(description="สกัด landmark (มือ + หน้า + pose ช่วงบน) จากวิดีโอ dataset")
    parser.add_argument("--force", action="store_true", help="สกัดใหม่ทั้งหมด แม้มีไฟล์ .npy อยู่แล้ว")
    parser.add_argument("--workers", type=int, default=4, help="จำนวน process ที่สกัดพร้อมกัน")
    args = parser.parse_args()

    print(f"🚀 เริ่มสกัด Landmarks (Hands + Face + Upper-body Pose, {F.RAW_DIM} ค่า/เฟรม, ~{TARGET_FPS} FPS) จาก Dataset...")
    if not os.path.exists(RAW_DATA_DIR):
        print(f"❌ ไม่พบโฟลเดอร์: {RAW_DATA_DIR}")
        return
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    jobs = []
    count_skipped = 0
    for category in os.listdir(RAW_DATA_DIR):
        cat_path = os.path.join(RAW_DATA_DIR, category)
        if not os.path.isdir(cat_path):
            continue
        for word in os.listdir(cat_path):
            word_path = os.path.join(cat_path, word)
            if not os.path.isdir(word_path):
                continue
            save_word_dir = os.path.join(PROCESSED_DIR, word)
            os.makedirs(save_word_dir, exist_ok=True)
            for video_file in os.listdir(word_path):
                if not video_file.endswith(".mp4"):
                    continue
                save_path = os.path.join(save_word_dir, video_file.replace(".mp4", ".npy"))
                # ข้ามคลิปที่สกัดไว้แล้ว (ใช้ --force เพื่อสกัดใหม่ทั้งหมด)
                if not args.force and os.path.exists(save_path):
                    count_skipped += 1
                    continue
                jobs.append((os.path.join(word_path, video_file), save_path))

    print(f"📦 ต้องสกัด {len(jobs)} คลิป (ข้ามไฟล์ที่มีอยู่แล้ว {count_skipped} ไฟล์) ด้วย {args.workers} process")
    count_success = 0
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(process_one, job) for job in jobs]
        for i, future in enumerate(as_completed(futures), 1):
            save_path, ok = future.result()
            name = os.path.relpath(save_path, PROCESSED_DIR)
            if ok:
                count_success += 1
                print(f"✅ [{i}/{len(jobs)}] บันทึกแล้ว: {name}")
            else:
                print(f"❌ [{i}/{len(jobs)}] อ่านวิดีโอไม่ได้: {name}")

    print(f"\n🎉 สกัดเสร็จสิ้นรวม {count_success} ไฟล์! (ข้ามไฟล์ที่มีอยู่แล้ว {count_skipped} ไฟล์)")
    write_report()


if __name__ == "__main__":
    main()
