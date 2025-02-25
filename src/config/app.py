import numpy as np
import base64
from flask import Flask, request, jsonify   
from flask_cors import CORS
import cv2
import logging
import sys
from ultralytics import YOLO
import asyncio
from concurrent.futures import ThreadPoolExecutor
from model_downloader import load_yolo_model  # Import the model loading function

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

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

@app.before_first_request
def load_model():
    """Load model before the first request"""
    global model
    model = load_yolo_model(model_name='yolov8x')  # or use a smaller model like 'yolov8n'
    logger.info("YOLOv8x model loaded and ready")

def enhance_image(img):
    """Enhance image quality for better detection"""
    try:
        # Convert to float32 for processing
        img_float = img.astype(np.float32) / 255.0
        
        # Apply adaptive histogram equalization for better contrast
        lab = cv2.cvtColor(img_float, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        l = clahe.apply(np.uint8(l * 255)) / 255.0
        enhanced = cv2.merge([l, a, b])
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
        img_bytes = base64.b64decode(img_data.split(',')[1])
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

async def process_detection(img):
    """Process detection with enhanced accuracy"""
    try:
        # Run detection with augmented inference
        results = model(img, 
                       verbose=False,
                       augment=True,     # Enable test time augmentation
                       retina_masks=True) # Enable high-quality segmentation
        return results
    except Exception as e:
        logger.error(f"Error in detection processing: {e}")
        raise

@app.route('/')
def home():
    return jsonify({
        "message": "Object Detection API is running",
        "model": "YOLOv8x",
        "settings": {
            "confidence_threshold": CONF_THRESHOLD,
            "iou_threshold": IOU_THRESHOLD,
            "image_size": IMG_SIZE,
            "max_objects": MAX_OBJECTS,
            "image_enhancement": "enabled"
        }
    })

@app.route('/detect', methods=['POST'])
async def detect():
    try:
        # Preprocess image
        img, original_dims = preprocess_image(request.json['image'])
        
        # Run detection
        results = await process_detection(img)
        
        # Process results
        detections = []
        if len(results) > 0:
            for r in results[0].boxes:
                # Get box coordinates and scale back to original size
                h, w = original_dims
                img_h, img_w = img.shape[:2]
                scale_h, scale_w = h/img_h, w/img_w
                
                xyxy = r.xyxy[0].numpy()
                x1, y1, x2, y2 = map(int, [
                    xyxy[0] * scale_w,
                    xyxy[1] * scale_h,
                    xyxy[2] * scale_w,
                    xyxy[3] * scale_h
                ])
                
                conf = float(r.conf[0])
                cls = int(r.cls[0])
                name = model.names[cls]
                
                detections.append({
                    "class": name,
                    "confidence": round(float(conf), 4),
                    "bbox": [x1, y1, x2 - x1, y2 - y1]
                })
        
        # Filter detections to remove false positives
        filtered_detections = filter_detections(detections)
        
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
    app.run(debug=True, port=5000)
