import cv2
import requests
import numpy as np
import pyttsx3
import threading
import time
from queue import Queue

# Initialize text-to-speech engine
def initialize_tts_engine():
    try:
        engine = pyttsx3.init(driverName="espeak")
        engine.setProperty('rate', 150)  # Speed of speech
        engine.setProperty('volume', 1.0)  # Volume level
        print("Text-to-speech engine initialized successfully.")
        return engine
    except Exception as e:
        print(f"Failed to initialize text-to-speech engine: {e}")
        return None

# Queue for text-to-speech requests
tts_queue = Queue()

# Function to process text-to-speech requests
def tts_worker(engine):
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

# Function to start the text-to-speech worker thread
def start_tts_worker(engine):
    tts_thread = threading.Thread(target=tts_worker, args=(engine,))
    tts_thread.daemon = True
    tts_thread.start()
    return tts_thread

# Function to speak in a separate thread with a delay
def speak(text):
    tts_queue.put(text)
    time.sleep(2)  # Delay between each announcement

# Function to announce all detected objects every 3 seconds
def periodic_announcement():
    while True:
        time.sleep(3)
        print("Periodic announcement thread running...")
        if last_objects:
            sentence = ", ".join(last_objects)
            print(f"Repeating: {sentence}")
            speak(sentence)

# Function to start the periodic announcement thread
def start_periodic_announcement():
    announcement_thread = threading.Thread(target=periodic_announcement)
    announcement_thread.daemon = True
    announcement_thread.start()
    return announcement_thread

# Function to stop the text-to-speech worker thread
def stop_tts_worker(tts_thread):
    tts_queue.put(None)
    tts_thread.join()

# Function to get detections from the API
def get_detections():
    try:
        response = requests.post('http://localhost:5000/detect')
        response.raise_for_status()
        return response.json().get('detections', [])
    except Exception as e:
        print(f"Error fetching detections: {e}")
        return []

if __name__ == '__main__':
    # Global variable to store last detected objects
    last_objects = set()
    
    # Open the integrated camera
    cap = cv2.VideoCapture(0)  # Use device index 0 for the default camera

    if not cap.isOpened():
        print("Error: Couldn't open the integrated camera.")
        exit()

    engine = initialize_tts_engine()
    tts_thread = start_tts_worker(engine)
    announcement_thread = start_periodic_announcement()

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Warning: Failed to capture frame.")
            continue  # Skip iteration if frame isn't captured

        # Convert frame to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Get detections from the API
        detections = get_detections()
        detected_objects = set()

        height, width, _ = frame.shape

        # Draw detections on the frame
        for det in detections:
            try:
                x1, y1, x2, y2 = det['bbox']
                label = det['class']
                conf = det['confidence']

                detected_objects.add(f"{label}")

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
            speak(sentence)
        
        last_objects = detected_objects  # Update last detected objects

        # Display the frame
        cv2.imshow("Integrated Camera Object Detection", frame)

        # Press 'q' to exit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

    # Stop the text-to-speech worker thread
    stop_tts_worker(tts_thread)
