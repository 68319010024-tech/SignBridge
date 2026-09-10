import os
import cv2
import numpy as np
import mediapipe as mp

mp_holistic = mp.solutions.holistic
holistic = mp_holistic.Holistic(
    static_image_mode=False,
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DATA_DIR = os.path.join(BASE_DIR, "dataset", "raw_videos", "รวมภาษามือ")
PROCESSED_DIR = os.path.join(BASE_DIR, "dataset", "processed_data")

# จุดคิ้วและปาก 40 จุด (120 ค่า) บนใบหน้า
FACE_INDICES = [
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314, 405, 321, 375, # Lips
    70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 55, 65, 52, 53, 285, 295, 282, 283, 33, 263 # Eyebrows & Eye Contour
]

def extract_landmarks_from_video(video_path, max_frames=30):
    cap = cv2.VideoCapture(video_path)
    raw_frames = []
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        raw_frames.append(frame)
    cap.release()

    total = len(raw_frames)
    if total == 0:
        return None

    if total <= max_frames:
        indices = list(range(total))
    else:
        indices = np.linspace(0, total - 1, max_frames).astype(int).tolist()

    sequence = []
    for idx in indices:
        frame = raw_frames[idx]
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = holistic.process(image)

        lh = np.zeros(21 * 3)
        rh = np.zeros(21 * 3)
        face = np.zeros(len(FACE_INDICES) * 3)

        if results.left_hand_landmarks:
            lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten()

        if results.right_hand_landmarks:
            rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten()

        if results.face_landmarks:
            face = np.array([[results.face_landmarks.landmark[i].x, 
                              results.face_landmarks.landmark[i].y, 
                              results.face_landmarks.landmark[i].z] for i in FACE_INDICES]).flatten()

        frame_features = np.concatenate([lh, rh, face]) # 63 + 63 + 120 = 246 Features
        sequence.append(frame_features)

    if len(sequence) < max_frames:
        padding = [np.zeros(246) for _ in range(max_frames - len(sequence))]
        sequence.extend(padding)

    return np.array(sequence)

def main():
    print("🚀 เริ่มสกัด Landmarks (Hands + Face) จาก Dataset...")
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    if not os.path.exists(RAW_DATA_DIR):
        print(f"❌ ไม่พบโฟลเดอร์: {RAW_DATA_DIR}")
        return

    count_success = 0
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
                if video_file.endswith(".mp4"):
                    video_full_path = os.path.join(word_path, video_file)
                    data = extract_landmarks_from_video(video_full_path)

                    if data is not None:
                        save_file_name = video_file.replace(".mp4", ".npy")
                        np.save(os.path.join(save_word_dir, save_file_name), data)
                        print(f"✅ บันทึกแล้ว: [{word}] -> {save_file_name}")
                        count_success += 1

    print(f"\n🎉 สกัด Landmarks (Hands + Face) เสร็จสิ้นรวม {count_success} ไฟล์!")

if __name__ == "__main__":
    main()