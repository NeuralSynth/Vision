import numpy as np
import base64
from flask import Flask, request, jsonify   
from flask_cors import CORS
import os
import urllib.request
import cv2
import logging
import sys
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Update CORS configuration
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Load YOLOv5 model
model = YOLO("yolov5s.pt")

@app.route('/')
def home():
    return jsonify({"message": "Object Detection API is running"})

@app.route('/process', methods=['POST'])    
def process():
    data = request.json
    if not data or 'image' not in data:
        return jsonify({"error": "No image provided"}), 400

    return jsonify({"message": "Image received"})

@app.route('/detect', methods=['POST'])
def detect():
    try:
        img_data = request.json['image']
        img_bytes = base64.b64decode(img_data.split(',')[1])
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        results = model(img)  # Run YOLOv5 detection

        detections = []
        for det in results.xyxy[0].cpu().numpy():
            x1, y1, x2, y2, conf, cls = det
            detections.append({
                "x1": int(x1), "y1": int(y1),
                "x2": int(x2), "y2": int(y2),
                "confidence": float(conf),
                "class": int(cls)
            })

        return jsonify({"detections": detections})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

