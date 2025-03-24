import cv2
# import requests
# import numpy as np
import pyttsx3
import threading
import time
from queue import Queue
from ultralytics import YOLO

# Load YOLOv8 model
model = YOLO("yolov8n.pt")  # Use 'yolov8s.pt' for better accuracy

# ESP32-CAM Stream URL
# ESP32_STREAM_URL = "http://172.16.68.190:81/stream"

# Initialize text-to-speech engine
try:
    engine = pyttsx3.init(driverName="espeak")
    engine.setProperty('rate', 150)  # Speed of speech
    engine.setProperty('volume', 1.0)  # Volume level
    print("Text-to-speech engine initialized successfully.")
except Exception as e:
    print(f"Failed to initialize text-to-speech engine: {e}")
    engine = None

# Queue for text-to-speech requests
tts_queue = Queue()

# Function to process text-to-speech requests
def tts_worker():
    while True:
        text = tts_queue.get()
        if text is None:
            break
        if engine:
            try:
                engine.say(text)
                engine.runAndWait()
            except Exception as e:
                print(f"Failed to produce speech: {e}")
        tts_queue.task_done()

# Start the text-to-speech worker thread
tts_thread = threading.Thread(target=tts_worker)
tts_thread.daemon = True
tts_thread.start()

# Function to speak in a separate thread with a delay
def speak(text):
    tts_queue.put(text)
    time.sleep(2)  # Delay between each announcement

last_objects = set()  # Store last detected objects to avoid repeated speech

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

# Function to announce all detected objects every 3 seconds
def periodic_announcement():
    #global last_objects  # Declare last_objects as global
    while True:
        time.sleep(3)
        print("Periodic announcement thread running...")
        if last_objects:
            sentence = ", ".join(last_objects)
            print(f"Repeating: {sentence}")
            speak(sentence)

# Start the periodic announcement thread
announcement_thread = threading.Thread(target=periodic_announcement)
announcement_thread.daemon = True
announcement_thread.start()

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
tts_queue.put(None)
tts_thread.join()

