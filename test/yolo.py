from ultralytics import YOLO
model = YOLO("yolov8n.pt")  # Load a pretrained model
model.info()  # Display model details