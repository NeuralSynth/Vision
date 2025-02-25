import os
import urllib.request
from pathlib import Path
import torch
from ultralytics import YOLO

# Model URLs - you can choose the appropriate one
MODEL_URLS = {
    'yolov8n': 'https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt',
    'yolov8s': 'https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8s.pt',
    'yolov8m': 'https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8m.pt',
    'yolov8l': 'https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8l.pt',
    'yolov8x': 'https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8x.pt'
}

def download_model(model_name='yolov8x', models_dir='models'):
    """
    Downloads the specified YOLOv8 model if it doesn't exist locally.
    
    Args:
        model_name: Name of the model to download ('yolov8n', 'yolov8s', 'yolov8m', 'yolov8l', 'yolov8x')
        models_dir: Directory to save the model
        
    Returns:
        Path to the downloaded model
    """
    # Create models directory if it doesn't exist
    os.makedirs(models_dir, exist_ok=True)
    
    model_path = os.path.join(models_dir, f"{model_name}.pt")
    
    # Check if model already exists
    if not os.path.exists(model_path):
        print(f"Downloading {model_name} model...")
        if model_name not in MODEL_URLS:
            raise ValueError(f"Model {model_name} not found in available models")
        
        # Download the model
        try:
            urllib.request.urlretrieve(MODEL_URLS[model_name], model_path)
            print(f"Model downloaded to {model_path}")
        except Exception as e:
            print(f"Error downloading model: {e}")
            raise
    else:
        print(f"Model already exists at {model_path}")
    
    return model_path

# Load model function
def load_yolo_model(model_name='yolov8x'):
    """
    Downloads (if needed) and loads the YOLO model
    
    Args:
        model_name: Name of the model to load
        
    Returns:
        Loaded YOLO model
    """
    model_path = download_model(model_name)
    
    # Load the model
    try:
        model = YOLO(model_path)
        print(f"Model {model_name} loaded successfully")
        return model
    except Exception as e:
        print(f"Error loading model: {e}")
        raise