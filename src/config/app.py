import numpy as np
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import logging
import torch
from concurrent.futures import ThreadPoolExecutor
from model_downloader import load_yolo_model
import time
import threading
from collections import deque
from queue import Queue, Empty

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "http://localhost:3000"]}})

# Detection settings for optimal accuracy
CONF_THRESHOLD = 0.5
IOU_THRESHOLD = 0.4
IMG_SIZE = 640
MAX_OBJECTS = 50
CLASSES = None

# Global state management with thread safety
class DetectionState:
    def __init__(self):
        self.latest_detections = []
        self.frame_queue = Queue(maxsize=10)  # Limit queue size to prevent memory issues
        self.lock = threading.Lock()
        self.last_process_time = 0
        self.active = True
        
    def update_detections(self, detections):
        with self.lock:
            self.latest_detections = detections
            self.last_process_time = time.time()
            
    def get_detections(self):
        with self.lock:
            return self.latest_detections, self.last_process_time
            
    def add_frame(self, frame):
        # Non-blocking add, discard frame if queue is full
        if not self.frame_queue.full():
            self.frame_queue.put(frame, block=False)
            return True
        return False
        
    def get_frame(self, timeout=1):
        try:
            return self.frame_queue.get(block=True, timeout=timeout)
        except Empty:
            return None
            
    def stop(self):
        self.active = False

# Initialize state and thread pools
detection_state = DetectionState()
thread_pool = ThreadPoolExecutor(max_workers=4)  # Increased worker count for better parallelism
detection_thread = None

logger.info("Configuring YOLOv8x for high-precision detection")

# Initialize model variable
model = None

@app.before_request
def load_model():
    """Load model before the first request with robust error handling"""
    global model, detection_thread
    if model is None:
        try:
            # First try the segmentation model
            logger.info("Attempting to load YOLOv8x-seg model...")
            try:
                model = load_yolo_model(model_name='yolov8x-seg')
                logger.info("YOLOv8x-seg model loaded successfully")
            except Exception as e:
                # If segmentation model fails, try the standard detection model
                logger.warning(f"Error loading YOLOv8x-seg: {e}. Falling back to YOLOv8x...")
                model = load_yolo_model(model_name='yolov8x')
                logger.info("YOLOv8x model loaded successfully")
            
            # Check model compatibility by running a test inference
            test_img = np.zeros((640, 640, 3), dtype=np.uint8)
            test_tensor = torch.from_numpy(test_img).float()
            test_tensor = test_tensor.permute(2, 0, 1).unsqueeze(0) / 255.0
            
            # Run a test prediction with minimal parameters and error catching
            try:
                with torch.no_grad():  # Disable gradient calculation for inference
                    _ = model(test_tensor, verbose=False)
                logger.info("Model validation successful")
            except Exception as test_e:
                logger.error(f"Model validation failed: {test_e}")
                # Try again with a different configuration to avoid the 'bn' attribute error
                model = load_yolo_model(model_name='yolov8n')  # Use the nano version which is simpler
                logger.warning("Fallback to YOLOv8n model due to compatibility issues")
            
            # Start the background detection thread
            if detection_thread is None:
                detection_thread = threading.Thread(target=background_detection_worker, daemon=True)
                detection_thread.start()
                logger.info("Background detection worker started")
        
        except Exception as e:
            logger.error(f"Failed to load any model: {e}")
            # Return a basic model that won't cause errors
            from ultralytics import YOLO
            model = YOLO("yolov8n.pt")  # Use the smallest model as last resort
            logger.warning("Using emergency fallback to YOLOv8n model")

def enhance_image(img):
    """Enhance image quality for better detection with improved error handling"""
    try:
        # Simple enhancement that's less prone to errors
        # Apply CLAHE on grayscale version for contrast enhancement
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced_gray = clahe.apply(gray)
        
        # Convert back to color but with enhanced contrast
        return cv2.cvtColor(enhanced_gray, cv2.COLOR_GRAY2BGR)
    except Exception as e:
        logger.warning(f"Image enhancement failed: {e}")
        return img  # Return original image if enhancement fails

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
    """Run object detection using YOLO with proper tensor formatting and robust error handling."""
    try:
        # Ensure the image is properly sized for YOLOv8 (must be divisible by 32)
        h, w = img.shape[:2]
        
        # Pad the image to make dimensions divisible by 32 instead of resizing
        # This approach preserves the aspect ratio better
        new_h = ((h + 31) // 32) * 32
        new_w = ((w + 31) // 32) * 32
        
        # Create new padded image (black padding)
        padded_img = np.zeros((new_h, new_w, 3), dtype=np.uint8)
        padded_img[:h, :w, :] = img
        
        # Convert to RGB if in BGR format (OpenCV uses BGR by default)
        if img.shape[2] == 3:
            padded_img = cv2.cvtColor(padded_img, cv2.COLOR_BGR2RGB)
            
        # Use a more robust approach to handle the tensor conversion
        try:
            # Convert to tensor format
            img_tensor = torch.from_numpy(padded_img).float()
            img_tensor = img_tensor.permute(2, 0, 1)  # HWC to CHW
            img_tensor = img_tensor.unsqueeze(0)  # Add batch dimension
            img_tensor = img_tensor / 255.0  # Normalize
            
            # Run inference with error catching
            with torch.no_grad():  # Disable gradient tracking for inference
                logger.info(f"Running inference on tensor of shape {img_tensor.shape}")
                results = model(img_tensor, verbose=False)
            
            return results
        except Exception as tensor_e:
            # If tensor approach fails, try the simpler path format approach
            logger.warning(f"Tensor-based inference failed: {tensor_e}, trying path-based approach")
            
            # Save the image temporarily
            temp_path = "/tmp/temp_detection_image.jpg"
            cv2.imwrite(temp_path, padded_img)
            
            # Use the path-based inference method which might be more stable
            results = model(temp_path, verbose=False)
            
            # Remove temp file
            import os
            os.remove(temp_path)
            
            return results
            
    except Exception as e:
        logger.error(f"Detection error: {e}")
        return None

def background_detection_worker():
    """Worker that periodically processes frames from the queue"""
    logger.info("Background detection worker started")
    
    while detection_state.active:
        try:
            # Get a frame from the queue
            frame_data = detection_state.get_frame(timeout=1)
            
            if frame_data is None:
                time.sleep(0.1)  # Short sleep to prevent CPU spinning
                continue
                
            img_data, original_dims = frame_data
            
            # Process the frame
            start_time = time.time()
            results = process_detection(img_data)
            
            if results is None:
                continue
                
            detections = []
            if results and len(results) > 0:
                for r in results[0].boxes:
                    h, w = original_dims
                    img_h, img_w = img_data.shape[:2]
                    scale_h, scale_w = h / img_h, w / img_w

                    try:
                        xyxy = r.xyxy[0].cpu().numpy()
                        x1, y1, x2, y2 = map(int, [
                            xyxy[0] * scale_w, xyxy[1] * scale_h, 
                            xyxy[2] * scale_w, xyxy[3] * scale_h
                        ])

                        quadrant = get_quadrant((x1 + x2) // 2, (y1 + y2) // 2, w, h)
                        
                        class_id = int(r.cls[0])
                        class_name = model.names[class_id] if class_id in model.names else f"unknown_{class_id}"

                        detections.append({
                            "class": class_name,
                            "confidence": round(float(r.conf[0]), 4),
                            "bbox": [x1, y1, x2 - x1, y2 - y1],
                            "quadrant": quadrant
                        })
                    except Exception as e:
                        logger.warning(f"Error processing detection box: {e}")
                        continue
                        
            # Filter and update detections
            filtered_detections = filter_detections(detections)
            detection_state.update_detections(filtered_detections)
            
            process_time = time.time() - start_time
            logger.info(f"Background detection completed: {len(filtered_detections)} objects in {process_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Error in background detection worker: {e}")
            time.sleep(1)  # Sleep longer on error

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
        if not request.json or 'image' not in request.json:
            return jsonify({'error': 'No image data provided'}), 400
            
        img_data = request.json['image']
        logger.info(f"Received image data of length: {len(img_data) if img_data else 0}")
        
        # Option 1: Use the immediate detection (original behavior)
        img, original_dims = preprocess_image(img_data)
        
        # Add to the queue for background processing
        detection_state.add_frame((img, original_dims))
        
        # Option 2: Use cached results if recent enough
        cached_detections, last_time = detection_state.get_detections()
        elapsed = time.time() - last_time
        
        # If results are fresh (within 2 seconds), use them
        if cached_detections and elapsed < 2.0:
            logger.info(f"Using cached detections from {elapsed:.2f}s ago")
            return jsonify({
                "detections": cached_detections,
                "performance": {
                    "total_detections": len(cached_detections),
                    "filtered_detections": len(cached_detections),
                    "image_size": img.shape[:2],
                    "confidence_threshold": CONF_THRESHOLD,
                    "cached": True,
                    "age": elapsed
                }
            })
        
        # Process detection synchronously for this request
        future = thread_pool.submit(process_detection, img)
        results = future.result()
        
        if results is None:
            return jsonify({
                "detections": [],
                "performance": {
                    "error": "Detection processing failed",
                    "total_detections": 0,
                    "filtered_detections": 0
                }
            })

        detections = []
        if results and len(results) > 0:
            for r in results[0].boxes:
                h, w = original_dims
                img_h, img_w = img.shape[:2]
                scale_h, scale_w = h / img_h, w / img_w

                try:
                    xyxy = r.xyxy[0].cpu().numpy()  # Ensure it's on CPU and convert to numpy
                    x1, y1, x2, y2 = map(int, [
                        xyxy[0] * scale_w, xyxy[1] * scale_h, 
                        xyxy[2] * scale_w, xyxy[3] * scale_h
                    ])

                    quadrant = get_quadrant((x1 + x2) // 2, (y1 + y2) // 2, w, h)
                    
                    # Make sure we're using a valid class index
                    class_id = int(r.cls[0])
                    class_name = model.names[class_id] if class_id in model.names else f"unknown_{class_id}"

                    detections.append({
                        "class": class_name,
                        "confidence": round(float(r.conf[0]), 4),
                        "bbox": [x1, y1, x2 - x1, y2 - y1],
                        "quadrant": quadrant
                    })
                except Exception as e:
                    logger.warning(f"Error processing detection box: {e}")
                    continue

        # Filter detections to remove false positives
        filtered_detections = filter_detections(detections)
        logger.info(f"Detected {len(filtered_detections)} objects after filtering")

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
        logger.error(f"Error in detection endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/status', methods=['GET'])
def api_status():
    """Endpoint to check if the API is running"""
    return jsonify({
        "status": "online",
        "model": "YOLOv8x-seg" if model is not None else "not loaded",
        "timestamp": time.time()
    })

if __name__ == '__main__':
    try:
        app.run(debug=True, port=5000)
    finally:
        pass
