from flask import Flask, request, jsonify
import cv2
import numpy as np
import torch
from yolov8n.pt import Inferer

app = Flask(__name__)
model = Inferer("yolov6s.pt")  # Load YOLOv6 model

@app.route('/detect', methods=['POST'])
def detect():
    file = request.files['image']
    image_np = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(image_np, cv2.IMREAD_COLOR)

    results = model.infer(image)  # Run YOLOv6 detection

    detections = []
    for det in results:
        x1, y1, x2, y2, conf, cls = det
        detections.append({
            "x1": int(x1), "y1": int(y1),
            "x2": int(x2), "y2": int(y2),
            "confidence": float(conf),
            "class": int(cls)
        })

    return jsonify({"detections": detections})

if _name_ == '_main_':
    app.run(host='0.0.0.0', port=5000, debug=True)