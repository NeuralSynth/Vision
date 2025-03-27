'use client';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';

// Types for detections
type Detection = {
  class: string;
  confidence: number;
  bbox: number[];
  quadrant: string;
};

type DetectionResult = {
  detections: Detection[];
  performance: {
    total_detections: number;
    filtered_detections: number;
    image_size: number[];
    confidence_threshold: number;
  };
};

// Create a global camera context
export type CameraContextType = {
  stream: MediaStream | null;
  getStream: () => Promise<MediaStream | null>;
  error: string | null;
  frameData: string | null; // Base64 encoded current frame
  detections: Detection[];
  captureFrame: () => Promise<string | null>; // Method to capture a frame
};

// Create the context with default values
export const CameraContext = createContext<CameraContextType>({
  stream: null,
  getStream: async () => null,
  error: null,
  frameData: null,
  detections: [],
  captureFrame: async () => null
});

// Provider component for camera access
export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameData, setFrameData] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize canvas for frame capture
  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
  }, []);

  const getStream = async () => {
    if (stream) return stream;
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      setStream(newStream);
      return newStream;
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      console.error('Error accessing camera:', error);
      return null;
    }
  };

  // Method to capture a frame from the video stream
  const captureFrame = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current || !stream) {
      return null;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = imageData.split(',')[1];
    
    setFrameData(base64Data);
    return base64Data;
  };

  // Update detections state with new data
  const updateDetections = (newDetections: Detection[]) => {
    setDetections(newDetections);
  };

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Set up video element for stream
  useEffect(() => {
    if (!videoRef.current) {
      videoRef.current = document.createElement('video');
      videoRef.current.autoplay = true;
      videoRef.current.playsInline = true;
    }

    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <CameraContext.Provider value={{ 
      stream, 
      getStream, 
      error, 
      frameData, 
      detections, 
      captureFrame 
    }}>
      {children}
      {videoRef.current && 
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          style={{ display: 'none' }} 
        />
      }
    </CameraContext.Provider>
  );
}

// Hook to use the camera stream
export const useCameraStream = () => useContext(CameraContext);

// The main WebcamDetection component
const WebcamDetection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResults, setDetectionResults] = useState<Detection[]>([]);
  const [status, setStatus] = useState<string>('Initializing...');
  const [isLoading, setIsLoading] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const { getStream, stream, captureFrame } = useCameraStream();

  // Initialize webcam
  useEffect(() => {
    async function setupCamera() {
      setStatus('Accessing camera...');
      try {
        const cameraStream = await getStream();
        if (cameraStream && videoRef.current) {
          videoRef.current.srcObject = cameraStream;
          setStatus('Camera ready');
          // Auto-start detection after camera is ready
          setIsDetecting(true);
        }
      } catch (err) {
        console.error('Error setting up camera:', err);
        setStatus('Camera error: ' + (err as Error).message);
      }
    }

    setupCamera();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsDetecting(false);
    };
  }, [getStream]);

  // Function to send frame to backend and get detections
  const processFrame = async (frameData: string): Promise<DetectionResult | null> => {
    try {
      const response = await fetch('http://localhost:5000/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: frameData })
      });
      
      if (!response.ok) {
        throw new Error(`Detection failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error processing frame:', error);
      return null;
    }
  };

  // Detection loop
  useEffect(() => {
    let isActive = true;
    
    const detectFrame = async () => {
      if (!isDetecting || !captureFrame || isLoading) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      setIsLoading(true);
      
      try {
        // Capture frame from webcam
        const frame = await captureFrame();
        
        if (frame && isActive) {
          setStatus('Processing...');
          
          // Send to backend for detection
          const result = await processFrame(frame);
          
          if (result && isActive) {
            setDetectionResults(result.detections);
            setStatus(`Detected ${result.detections.length} objects`);
          }
        }
      } catch (err) {
        console.error('Error in detection loop:', err);
        if (isActive) {
          setStatus('Detection error');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
      
      // Continue detection loop
      if (isActive) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
      }
    };

    detectFrame();
    
    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDetecting, captureFrame, isLoading]);

  // Draw bounding boxes on canvas
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !detectionResults.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw video frame first
    if (videoRef.current) {
      ctx.drawImage(
        videoRef.current, 
        0, 0, 
        canvas.width, 
        canvas.height
      );
    }
    
    // Draw each detection
    detectionResults.forEach(detection => {
      const [x, y, width, height] = detection.bbox;
      
      // Draw bounding box
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      
      // Draw label
      ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
      ctx.fillRect(x, y - 25, 160, 25);
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial';
      ctx.fillText(
        `${detection.class} (${Math.round(detection.confidence * 100)}%)`,
        x + 5, 
        y - 7
      );
    });
  }, [detectionResults]);

  // Toggle detection on/off
  const toggleDetection = () => {
    setIsDetecting(prev => !prev);
    setStatus(isDetecting ? 'Detection paused' : 'Detection running');
  };

  return (
    <div className="relative rounded-lg overflow-hidden shadow-2xl bg-black/30 backdrop-blur-sm border border-white/10">
      <div className="aspect-video relative">
        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Canvas overlay for drawing detections */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          width={640}
          height={480}
        />
        
        {/* Status overlay */}
        <div className="absolute top-0 left-0 right-0 bg-black/60 text-white p-2 flex justify-between items-center">
          <span>{status}</span>
          <button
            onClick={toggleDetection}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded text-sm"
          >
            {isDetecting ? 'Pause' : 'Start'} Detection
          </button>
        </div>
        
        {/* Detections panel */}
        <div className="absolute bottom-0 right-0 max-w-xs bg-black/60 text-white p-2 text-sm max-h-32 overflow-y-auto">
          {detectionResults.length === 0 ? (
            <p>No objects detected</p>
          ) : (
            <ul>
              {detectionResults.map((det, idx) => (
                <li key={idx} className="mb-1">
                  {det.class} ({Math.round(det.confidence * 100)}%) - Quadrant {det.quadrant}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// Wrapped export to provide camera access
export default function WebcamDetectionWithCamera() {
  return (
    <CameraProvider>
      <WebcamDetection />
    </CameraProvider>
  );
}