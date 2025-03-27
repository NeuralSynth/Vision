'use client';

import { useEffect, useRef, useState, createContext, useContext } from 'react';

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
      setError(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error accessing webcam:', err);
      return null;
    }
  };

  // Method to capture a frame from the video stream
  const captureFrame = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current || !stream) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = imageData.split(',')[1];
    
    setFrameData(base64Data);
    return base64Data;
  };

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    };
  }, [stream]);

  // Set up video element for stream
  useEffect(() => {
    if (!videoRef.current) {
      videoRef.current = document.createElement('video');
      videoRef.current.autoplay = true;
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
    }

    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
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
    </CameraContext.Provider>
  );
}

// Hook to use the camera stream
export const useCameraStream = () => useContext(CameraContext);

// The main WebcamDetection component
const WebcamDetection = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [localDetections, setLocalDetections] = useState<Detection[]>([]);
  const [status, setStatus] = useState<string>('Initializing...');
  const animationFrameRef = useRef<number | null>(null);
  const { getStream, stream, captureFrame, detections, frameData } = useCameraStream();

  // Initialize webcam
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await getStream();
        
        if (stream && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          setStatus('Camera ready. Starting detection...');
        }
      } catch (err) {
        setStatus(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error accessing webcam:', err);
      }
    }

    setupCamera();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [getStream]);

  // Detection loop
  useEffect(() => {
    const detectFrame = async () => {
      if (!localVideoRef.current || !localCanvasRef.current || !localVideoRef.current.readyState || localVideoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      const video = localVideoRef.current;
      const canvas = localCanvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Only process if we're not already processing a frame
      if (!isDetecting) {
        setIsDetecting(true);
        
        try {
          // Draw video frame to canvas
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Capture frame and send to backend
          const base64Data = await captureFrame();
          
          if (base64Data) {
            // Send to backend
            const response = await fetch('http://localhost:5000/detect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ image: base64Data })
            });
            
            if (!response.ok) {
              throw new Error(`Server responded with status: ${response.status}`);
            }

            const result: DetectionResult = await response.json();
            setLocalDetections(result.detections);
            setStatus(`Detected ${result.detections.length} objects`);
            
            // Draw bounding boxes and labels
            result.detections.forEach(detection => {
              const [x, y, width, height] = detection.bbox;
              
              // Draw bounding box
              context.strokeStyle = '#00FFFF';
              context.lineWidth = 2;
              context.strokeRect(x, y, width, height);
              
              // Draw background for label
              context.fillStyle = 'rgba(0, 0, 0, 0.7)';
              const label = `${detection.class} (${Math.round(detection.confidence * 100)}%) Q${detection.quadrant}`;
              const textWidth = context.measureText(label).width;
              context.fillRect(x, y - 25, textWidth + 10, 25);
              
              // Draw label
              context.fillStyle = '#00FFFF';
              context.font = '16px Arial';
              context.fillText(label, x + 5, y - 7);
            });
          }
        } catch (err) {
          console.error('Error in detection:', err);
          setStatus(`Detection error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsDetecting(false);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDetecting, captureFrame]);

  return (
    <div className="relative rounded-lg overflow-hidden shadow-2xl bg-black/30 backdrop-blur-sm border border-white/10">
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500/80 to-purple-600/80 px-4 py-2 text-white text-sm z-10">
        {status}
      </div>
      
      <div className="relative">
        <video 
          ref={localVideoRef}
          className="w-full hidden"
          autoPlay
          playsInline
          muted
        />
        <canvas 
          ref={localCanvasRef}
          className="w-full"
        />
      </div>
      
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white mb-2">Detected Objects</h3>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {localDetections.map((detection, index) => (
            <span 
              key={index} 
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30"
            >
              {detection.class} ({Math.round(detection.confidence * 100)}%)
            </span>
          ))}
          {localDetections.length === 0 && (
            <span className="text-gray-400 text-sm">No objects detected yet</span>
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