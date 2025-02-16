import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';

const VideoProcessor = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState('video');
  const [model, setModel] = useState(null);

  // Load the COCO-SSD model
  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await cocossd.load();
        setModel(loadedModel);
        console.log("Model loaded successfully");
      } catch (error) {
        console.error("Error loading model:", error);
      }
    };
    loadModel();
  }, []);

  // Process video frames
  useEffect(() => {
    if (mode === 'video' && model) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          } 
        })
        .then(stream => {
          video.srcObject = stream;
          video.play();
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          alert("Error accessing camera. Please make sure you have granted camera permissions.");
        });
      }

      let animationFrameId;
      let isDetecting = false;

      const detectFrame = async () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA && !isDetecting) {
          // Set canvas dimensions
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // Draw video frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          if (!isDetecting) {
            isDetecting = true;
            try {
              // Detect objects
              const predictions = await model.detect(video);
              setDetections(predictions);

              // Draw detections
              predictions.forEach(prediction => {
                const [x, y, width, height] = prediction.bbox;
                
                // Draw bounding box
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);

                // Draw label
                const label = `${prediction.class} ${Math.round(prediction.score * 100)}%`;
                ctx.font = '16px Arial';
                const labelWidth = ctx.measureText(label).width + 10;

                ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
                ctx.fillRect(x, y - 25, labelWidth, 25);

                ctx.fillStyle = '#000000';
                ctx.fillText(label, x + 5, y - 7);
              });
            } catch (error) {
              console.error('Error detecting objects:', error);
            }
            isDetecting = false;
          }
        }
        animationFrameId = requestAnimationFrame(detectFrame);
      };

      detectFrame();

      return () => {
        cancelAnimationFrame(animationFrameId);
        if (video.srcObject) {
          video.srcObject.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [mode, model]);

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex gap-4">
        <button
          onClick={() => setMode('video')}
          className={`px-4 py-2 rounded ${mode === 'video' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Video Mode
        </button>
      </div>

      <div className="relative w-full max-w-3xl mx-auto">
        {mode === 'video' && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto"
              style={{ 
                maxWidth: '100%',
                backgroundColor: '#000'
              }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
              style={{ 
                maxWidth: '100%',
                backgroundColor: 'transparent'
              }}
            />
          </>
        )}
      </div>

      {detections.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-bold mb-2">Detected Objects:</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {detections.map((detection, index) => (
              <div
                key={index}
                className="bg-gray-100 p-3 rounded-lg"
              >
                <p className="font-semibold">Object: {detection.class}</p>
                <p>Confidence: {(detection.score * 100).toFixed(2)}%</p>
                <p>Location: ({Math.round(detection.bbox[0])}, {Math.round(detection.bbox[1])})</p>
                <p>Size: {Math.round(detection.bbox[2])}x{Math.round(detection.bbox[3])}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoProcessor;
