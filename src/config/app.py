import numpy as np
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import logging
import torch
from concurrent.futures import ThreadPoolExecutor
from model_downloader import load_yolo_model  # Import the model loading function
import sound  # Import the sound module

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "http://localhost:3000"]}})

# Detection settings for optimal accuracy
CONF_THRESHOLD = 0.35  # Increased confidence threshold for more precise detections
IOU_THRESHOLD = 0.4   # Adjusted IOU threshold for better overlap handling
IMG_SIZE = 640      # Increased to YOLOv8x's optimal input size
MAX_OBJECTS = 50    # Maximum number of objects to detect
CLASSES = None      # Detect all classes

# Initialize thread pool for processing
thread_pool = ThreadPoolExecutor(max_workers=2)

logger.info("Configuring YOLOv8x for high-precision detection")

# Initialize model variable
model = None

# Initialize text-to-speech engine and start worker threads
engine = sound.initialize_tts_engine()
tts_thread = sound.start_tts_worker(engine)
announcement_thread = sound.start_periodic_announcement()

@app.before_request
def load_model():
    """Load model before the first request"""
    global model
    if model is None:
        model = load_yolo_model(model_name='yolov8seg')  # or use a smaller model like 'yolov8n'
        logger.info("YOLOv8x-seg model loaded and ready")

def enhance_image(img):
    """Enhance image quality for better detection"""
    try:
        # Convert to float32 for processing
        img_float = img.astype(np.float32) / 255.0
        
        # Apply adaptive histogram equalization for better contrast
        lab = cv2.cvtColor(img_float, cv2.COLOR_BGR2LAB)
        l_channel, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        l_channel = clahe.apply(np.uint8(l_channel * 255)) / 255.0
        enhanced = cv2.merge([l_channel, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        
        # Convert back to uint8
        enhanced = np.clip(enhanced * 255, 0, 255).astype(np.uint8)
        return enhanced
    except Exception as e:
        logger.warning(f"Image enhancement failed: {e}")
        return img

def preprocess_image(img_data):
    """Optimize image preprocessing for accurate detection"""
    try:
        # Decode base64 image
        img_bytes = base64.b64decode(img_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Enhance image quality
        img = enhance_image(img)
        
        # Resize image to optimal size while maintaining aspect ratio
        h, w = img.shape[:2]
        scale = min(IMG_SIZE/h, IMG_SIZE/w)
        if scale != 1:
            new_h, new_w = int(h * scale), int(w * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        
        return img, (h, w)
    except Exception as e:
        logger.error(f"Error in image preprocessing: {e}")
        raise

def filter_detections(detections, min_area=100):
    """Filter out likely false positives"""
    filtered = []
    for det in detections:
        x, y, w, h = det["bbox"]
        area = w * h
        if area >= min_area and det["confidence"] >= CONF_THRESHOLD:
            filtered.append(det)
    return filtered

def process_detection(img):
    """Run object detection using YOLO."""
    try:
        img_tensor = torch.from_numpy(img).float()  # Convert image for model
        results = model(img_tensor, verbose=False, augment=True)
        return results
    except Exception as e:
        logger.error(f"Detection error: {e}")
        return None

def get_quadrant(x, y, width, height):
    """Determine the quadrant of the point (x, y) in a 3x3 grid."""
    if x < width / 3:
        if y < height / 3:
            return "1"  # top-left
        elif y < 2 * height / 3:
            return "4"  # middle-left
        else:
            return "7"  # bottom-left
    elif x < 2 * width / 3:
        if y < height / 3:
            return "2"  # top-middle
        elif y < 2 * height / 3:
            return "5"  # middle-middle
        else:
            return "8"  # bottom-middle
    else:
        if y < height / 3:
            return "3"  # top-right
        elif y < 2 * height / 3:
            return "6"  # middle-right
        else:
            return "9"  # bottom-right

@app.route('/')
def home():
    return jsonify({"message": "Object Detection API is running", "model": "YOLOv8x"})

@app.route('/detect', methods=['POST'])
def detect():
    try:
        img_data = request.json['image']
        img, original_dims = preprocess_image(img_data)

        # Process detection asynchronously
        future = thread_pool.submit(process_detection, img)
        results = future.result()

        detections = []
        if results:
            for r in results[0].boxes:
                h, w = original_dims
                img_h, img_w = img.shape[:2]
                scale_h, scale_w = h / img_h, w / img_w

                xyxy = r.xyxy[0].numpy()
                x1, y1, x2, y2 = map(int, [
                    xyxy[0] * scale_w, xyxy[1] * scale_h, 
                    xyxy[2] * scale_w, xyxy[3] * scale_h
                ])

                quadrant = get_quadrant((x1 + x2) // 2, (y1 + y2) // 2, w, h)

                detections.append({
                    "class": model.names[int(r.cls[0])],
                    "confidence": round(float(r.conf[0]), 4),
                    "bbox": [x1, y1, x2 - x1, y2 - y1],
                    "quadrant": quadrant
                })

        # Filter detections to remove false positives
        filtered_detections = filter_detections(detections)

        # Announce detected objects
        detected_objects = set(det["class"] for det in filtered_detections)
        new_objects = detected_objects - sound.last_objects
        if new_objects:
            sentence = ", ".join(new_objects)
            print(f"Announcing: {sentence}")
            sound.speak(sentence)  # Use threaded function to prevent freezing
        sound.last_objects = detected_objects  # Update last detected objects

        return jsonify({
            "detections": filtered_detections,
            "performance": {
                "total_detections": len(detections),
                "filtered_detections": len(filtered_detections),
                "image_size": img.shape[:2],
                "confidence_threshold": CONF_THRESHOLD
            }
        })
    except Exception as e:
        logger.error(f"Error in detection: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    try:
        app.run(debug=True, port=5000)
    finally:
        # Stop the text-to-speech worker thread
        sound.stop_tts_worker(tts_thread)
