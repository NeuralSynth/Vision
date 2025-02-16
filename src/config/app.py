import numpy as np
import base64
from flask import Flask, request, jsonify   
from flask_cors import CORS
import os
import urllib.request
import cv2
import logging
import sys

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


current_dir = os.path.dirname(os.path.abspath(__file__))

# Add weight file management with error handling
WEIGHTS_URL = "https://github.com/patrick013/Object-Detection---Yolov3/raw/master/model/yolov3.weights"
WEIGHTS_PATH = os.path.join(current_dir, 'yolov3.weights')
CONFIG_PATH = os.path.join(current_dir, 'yolov3.cfg')
LABELS_PATH = os.path.join(current_dir, 'coco.names')

# Download weights if they don't exist
def download_weights():
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
        req = urllib.request.Request(WEIGHTS_URL, headers=headers)
        with urllib.request.urlopen(req) as response, open(WEIGHTS_PATH, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
        return True
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return False

if not os.path.exists(WEIGHTS_PATH) or os.path.getsize(WEIGHTS_PATH) < 200000000:
    if not download_weights():
        raise RuntimeError("Failed to download weights")

try:
    net = cv2.dnn.readNetFromDarknet(CONFIG_PATH, WEIGHTS_PATH)
except Exception as e:
    raise RuntimeError(f"Failed to load YOLOv3 model: {str(e)}")

layer_names = net.getLayerNames()
output_layers = [layer_names[i - 1] for i in net.getUnconnectedOutLayers().flatten()]

with open(LABELS_PATH, 'r') as f:
    classes = [line.strip() for line in f.readlines()]

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
        height, width = img.shape[:2]
        blob = cv2.dnn.blobFromImage(img, 1/255.0, (416, 416), swapRB=True, crop=False)
        net.setInput(blob)
        outputs = net.forward(output_layers)
        boxes = []
        confidences = []
        class_ids = []

        for output in outputs:
            for detection in output:
                scores = detection[5:]
                class_id = np.argmax(scores)
                confidence = scores[class_id]
                if confidence > 0.5:
                    center_x = int(detection[0] * width)
                    center_y = int(detection[1] * height)
                    w = int(detection[2] * width)
                    h = int(detection[3] * height)
                    x = int(center_x - w/2)
                    y = int(center_y - h/2)
                    boxes.append([x, y, w, h])
                    confidences.append(float(confidence))
                    class_ids.append(class_id)

        indices = cv2.dnn.NMSBoxes(boxes, confidences, 0.5, 0.4)
        results = []
        for i in indices:
            i = i if isinstance(i, int) else i[0]
            box = boxes[i]
            results.append({
                'class': classes[class_ids[i]],
                'confidence': confidences[i],
                'box': box
            })
        return jsonify({'detections': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

