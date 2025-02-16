import numpy as np
import base64
from flask import Flask, request, jsonify   
from flask_cors import CORS
import os

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

net = cv2.dnn.readNetFromDarknet(
    os.path.join(current_dir, 'yolov3.cfg'),
    os.path.join(current_dir, 'yolov3.weights')
)

layer_names = net.getLayerNames()
output_layers = [layer_names[i - 1] for i in net.getUnconnectedOutLayers().flatten()]

with open(os.path.join(current_dir, "coco.names"), "r") as f:
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
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({"error": "No image provided"}), 400

    img_data = data['image']
    if ',' in img_data:
        header, img_data = img_data.split(',', 1)
    img_bytes = base64.b64decode(img_data)
    
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return jsonify({"error": "Failed to decode image"}), 400

    height, width = img.shape[:2]
    
    blob = cv2.dnn.blobFromImage(img, scalefactor=1/255.0, size=(416, 416), swapRB=True, crop=False)
    net.setInput(blob)
    outs = net.forward(output_layers)

    boxes = []
    confidences = []
    class_ids = []

    for out in outs:
        for detection in out:
            scores = detection[5:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]
            if confidence > 0.5: 
                center_x = int(detection[0] * width)
                center_y = int(detection[1] * height)
                w = int(detection[2] * width)
                h = int(detection[3] * height)
                x = int(center_x - w / 2)
                y = int(center_y - h / 2)
                boxes.append([x, y, w, h])
                confidences.append(float(confidence))
                class_ids.append(class_id)
    
    indices = cv2.dnn.NMSBoxes(boxes, confidences, 0.5, 0.4)
    
    detections = []
    for i in indices:
        i = i[0] if isinstance(i, (list, tuple, np.ndarray)) else i
        box = boxes[i]
        x, y, w, h = box
        detection = {
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "class": classes[class_ids[i]],
            "score": confidences[i]
        }
        detections.append(detection)

    return jsonify({"detections": detections})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

