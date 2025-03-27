import cv2
import pyttsx3
import threading
import time
from queue import Queue
from ultralytics import YOLO
import queue
import logging

# Load YOLOv8 model
model = YOLO("yolov8x.pt")  # Use 'yolov8s.pt' for better accuracy

# Global variables
tts_queue = queue.Queue()
running = True
last_objects = set()  # This can stay as it's just keeping track of announced objects

logger = logging.getLogger(__name__)

def initialize_tts_engine(use_camera=False):
    """Initialize text-to-speech engine"""
    try:
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)
        engine.setProperty('volume', 0.9)
        print("Text-to-speech engine initialized successfully.")
        return engine
    except Exception as e:
        print(f"Error initializing text-to-speech engine: {e}")
        return None

# Initialize text-to-speech engine
engine = initialize_tts_engine()

def speak(text):
    """Add text to the speaking queue"""
    if text:
        tts_queue.put(text)

def tts_worker(engine):
    """Text-to-speech worker thread"""
    while running:
        try:
            if not tts_queue.empty():
                text = tts_queue.get()
                if engine and text:
                    engine.say(text)
                    engine.runAndWait()
                tts_queue.task_done()
            else:
                time.sleep(0.1)
        except Exception as e:
            print(f"Error in TTS worker: {e}")
            time.sleep(1)

def start_tts_worker(engine):
    """Start the TTS worker thread"""
    worker_thread = threading.Thread(target=tts_worker, args=(engine,), daemon=True)
    worker_thread.start()
    return worker_thread

def stop_tts_worker(thread):
    """Stop the TTS worker thread"""
    global running
    running = False
    if thread and thread.is_alive():
        thread.join(timeout=1)

# Start the text-to-speech worker thread
tts_thread = start_tts_worker(engine)

# Function to determine the quadrant of a point in the frame
def get_quadrant(x, y, width, height):
    if x < width / 2 and y < height / 2:
        return "top-left"
    elif x >= width / 2 and y < height / 2:
        return "top-right"
    elif x < width / 2 and y >= height / 2:
        return "bottom-left"
    else:
        return "bottom-right"

def periodic_announcement(use_camera=False):
    """Function to make periodic announcements"""
    global running
    
    # Remove any camera initialization code here
    # Don't use cv2.VideoCapture() at all
    
    if use_camera:
        logger.warning("Camera access from backend is disabled. Use frontend camera instead.")
        print("Camera access from backend is disabled. Use frontend camera instead.")
    
    while running:
        time.sleep(30)  # Just sleep - no camera operations

def start_periodic_announcement(use_camera=False):
    """Start the periodic announcement thread"""
    # Make sure we're always passing use_camera=False
    use_camera = False  # Force it to be False regardless of what was passed
    announcement_thread = threading.Thread(target=periodic_announcement, args=(use_camera,), daemon=True)
    announcement_thread.start()
    return announcement_thread

# Start the periodic announcement thread
announcement_thread = start_periodic_announcement()

# Open video stream
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: Couldn't open the video stream.")
    exit()

last_objects = set()  # Store last detected objects to avoid repeated speech


while True:
    ret, frame = cap.read()
    if not ret:
        print("Warning: Failed to capture frame.")
        continue  # Skip iteration if frame isn't captured

    # Convert frame to the correct format (if needed)
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)  # Ensure correct color format

    # Run YOLOv8 on the frame
    results = model(frame_rgb)

    detected_objects = set()

    height, width, _ = frame.shape

    # Draw detections on the frame
    for r in results:
        for box in r.boxes:
            try:
                x1, y1, x2, y2 = map(int, box.xyxy[0])  # Bounding box coordinates
                conf = float(box.conf[0])  # Confidence score
                cls = int(box.cls[0])  # Class ID

                # Get label safely
                label = model.names.get(cls, f"Object {cls}")  # Handle missing names
                quadrant = get_quadrant((x1 + x2) // 2, (y1 + y2) // 2, width, height)
                detected_objects.add(f"{label} in {quadrant}")

                # Draw bounding box and label
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, f"{label} {conf:.2f}", (x1, y1 - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            except Exception as e:
                print(f"Error processing bounding box: {e}")

    # Announce newly detected objects
    new_objects = detected_objects - last_objects
    if new_objects:
        sentence = ", ".join(new_objects)
        print(f"Announcing: {sentence}")
        speak(sentence)  # Use threaded function to prevent freezing
    
    last_objects = detected_objects  # Update last detected objects

    # Display the frame
    cv2.imshow("ESP32-CAM Object Detection", frame)

    # Press 'q' to exit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

# Stop the text-to-speech worker thread
stop_tts_worker(tts_thread)

