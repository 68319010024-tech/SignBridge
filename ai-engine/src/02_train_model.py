import os
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization, GlobalAveragePooling1D, Conv1D
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.utils import to_categorical
from sklearn.model_selection import train_test_split

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(BASE_DIR, "dataset", "processed_data")
MODELS_DIR = os.path.join(BASE_DIR, "models")

def normalize_landmarks(data):
    normalized_data = np.copy(data)
    for frame_idx in range(normalized_data.shape[0]):
        frame = normalized_data[frame_idx]
        
        # Left Hand Normalization
        if np.any(frame[:63]):
            lh = frame[:63].reshape(21, 3)
            lh = lh - lh[0]
            max_val = np.max(np.abs(lh))
            if max_val > 0:
                lh = lh / max_val
            frame[:63] = lh.flatten()

        # Right Hand Normalization
        if np.any(frame[63:126]):
            rh = frame[63:126].reshape(21, 3)
            rh = rh - rh[0]
            max_val = np.max(np.abs(rh))
            if max_val > 0:
                rh = rh / max_val
            frame[63:126] = rh.flatten()

        # Face Normalization (Center around nose/lips origin)
        if np.any(frame[126:]):
            face = frame[126:].reshape(-1, 3)
            face = face - face[0]
            max_val = np.max(np.abs(face))
            if max_val > 0:
                face = face / max_val
            frame[126:] = face.flatten()

        normalized_data[frame_idx] = frame
    return normalized_data

def load_dataset():
    labels = []
    data = []

    words = [d for d in os.listdir(PROCESSED_DIR) if os.path.isdir(os.path.join(PROCESSED_DIR, d))]
    words.sort()

    if len(words) == 0:
        return None, None, None

    label_map = {word: i for i, word in enumerate(words)}

    for word in words:
        word_dir = os.path.join(PROCESSED_DIR, word)
        for npy_file in os.listdir(word_dir):
            if npy_file.endswith(".npy"):
                res = np.load(os.path.join(word_dir, npy_file))
                res_norm = normalize_landmarks(res)
                data.append(res_norm)
                labels.append(label_map[word])

    X = np.array(data)
    y = to_categorical(labels).astype(int)

    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(os.path.join(MODELS_DIR, "label_map.json"), "w", encoding="utf-8") as f:
        json.dump(label_map, f, ensure_ascii=False, indent=2)

    return X, y, words

def main():
    X, y, words = load_dataset()
    if X is None:
        return

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42, stratify=y)

    model = Sequential([
        Conv1D(filters=64, kernel_size=3, activation='relu', padding='same', input_shape=(30, 246)),
        BatchNormalization(),
        Dropout(0.2),

        Conv1D(filters=128, kernel_size=3, activation='relu', padding='same'),
        BatchNormalization(),
        Dropout(0.3),

        Conv1D(filters=256, kernel_size=3, activation='relu', padding='same'),
        BatchNormalization(),
        GlobalAveragePooling1D(),

        Dense(128, activation='relu'),
        Dropout(0.4),
        Dense(len(words), activation='softmax')
    ])

    model.compile(optimizer=Adam(learning_rate=0.001), loss='categorical_crossentropy', metrics=['accuracy'])

    callbacks = [
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=0.00001, verbose=1),
        EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True, verbose=1)
    ]

    model.fit(
        X_train, y_train,
        epochs=150,
        batch_size=8,
        validation_data=(X_test, y_test),
        callbacks=callbacks
    )

    model_path = os.path.join(MODELS_DIR, "sign_model.h5")
    model.save(model_path)
    print(f"\n🎉 บันทึกโมเดลเวอร์ชันปรับปรุง (Hands + Face) เสร็จสิ้น: {model_path}")

if __name__ == "__main__":
    main()