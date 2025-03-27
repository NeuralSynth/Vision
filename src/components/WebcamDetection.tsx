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
  updateDetections: (detections: Detection[]) => void; // Method to update detections
};

// Create the context with default values
export const CameraContext = createContext<CameraContextType>({
  stream: null,
  getStream: async () => null,
  error: null,
  frameData: null,
  detections: [],
  captureFrame: async () => null,
  updateDetections: () => {}
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
    
    // Ensure canvas size exactly matches current video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    
    // Clear the canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      // Convert to base64 with higher quality (0.95 instead of 0.8)
      const imageData = canvas.toDataURL('image/jpeg', 0.95);
      const base64Data = imageData.split(',')[1];
      
      // Verify we have data
      if (!base64Data || base64Data.length < 1000) {
        console.warn("Generated base64 data seems too small:", base64Data?.length);
        return null;
      }
      
      setFrameData(base64Data);
      return base64Data;
    } catch (err) {
      console.error("Error encoding image:", err);
      return null;
    }
  };

  // Update detections state with new data
  const updateDetections = (newDetections: Detection[]) => {
    console.log("Updating context detections:", newDetections.length);
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
      captureFrame,
      updateDetections  // Add the updateDetections function to the context
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
  const { getStream, stream, captureFrame, updateDetections } = useCameraStream();
  const [framerate, setFramerate] = useState<number>(2); // Frames per second
  const processingRef = useRef<boolean>(false);
  const lastDetectionTimeRef = useRef<number>(0);

  // Initialize webcam
  useEffect(() => {
    async function setupCamera() {
      setStatus('Accessing camera...');
      try {
        const cameraStream = await getStream();
        if (cameraStream && videoRef.current) {
          videoRef.current.srcObject = cameraStream;
          
          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            if (!videoRef.current) return;
            
            // Set canvas dimensions to match video
            if (canvasRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
            
            setStatus('Camera ready');
            // Auto-start detection after camera is ready
            setTimeout(() => setIsDetecting(true), 1000);
          };
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
      // Set processing flag
      processingRef.current = true;
      
      console.log("Sending frame to backend for detection");
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
      
      const result = await response.json();
      console.log("Got detection results:", result);
      
      // Clear processing flag
      processingRef.current = false;
      lastDetectionTimeRef.current = Date.now();
      
      return result;
    } catch (error) {
      console.error('Error processing frame:', error);
      processingRef.current = false;
      return null;
    }
  };

  // Detection loop
  useEffect(() => {
    let isActive = true;
    
    const detectFrame = async () => {
      // Don't try to detect if not active, loading or already processing
      if (!isDetecting || !captureFrame || isLoading || processingRef.current) {
        // Schedule next frame with delay based on framerate
        setTimeout(() => {
          if (isActive) requestAnimationFrame(detectFrame);
        }, 1000 / framerate);
        return;
      }
      
      // Throttle detection rate - respect the framerate setting
      const now = Date.now();
      const timeSinceLastDetection = now - lastDetectionTimeRef.current;
      if (timeSinceLastDetection < (1000 / framerate)) {
        setTimeout(() => {
          if (isActive) requestAnimationFrame(detectFrame);
        }, 1000 / framerate - timeSinceLastDetection);
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
            console.log("Detection results:", result.detections.length, "objects found");
            
            // Update local state first
            setDetectionResults(result.detections);
            
            // Then update context state with a slight delay to ensure proper rendering
            setTimeout(() => {
              updateDetections(result.detections);
              console.log("Context updated with new detections");
            }, 0);
            
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
      
      // Continue detection loop with controlled framerate
      setTimeout(() => {
        if (isActive) requestAnimationFrame(detectFrame);
      }, 1000 / framerate);
    };

    detectFrame();
    
    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDetecting, captureFrame, isLoading, framerate, updateDetections]);

  // Draw bounding boxes on canvas - Improved rendering
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Define the overlay drawing function, which includes drawing gridlines
    const drawOverlay = () => {
      // Only proceed if the video has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      // Update canvas dimensions based on video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      console.log(`Updated canvas dimensions to ${canvas.width}x${canvas.height}`);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear previous drawings
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Do not redraw the video frame; let the video element play behind the canvas
      // ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw 3x3 grid overlay
      drawGrid(ctx, canvas.width, canvas.height);

      // Log detection count before drawing
      console.log(`Drawing ${detectionResults.length} detection boxes on canvas`);

      // Draw detection boxes (if any)
      detectionResults.forEach((detection, index) => {
        const [x, y, width, height] = detection.bbox;
        console.log(`Detection ${index}: ${detection.class} at (${x},${y},${width},${height})`);
        try {
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);

          const text = `${detection.class} (${Math.round(detection.confidence * 100)}%)`;
          ctx.font = 'bold 16px Arial';
          const textMetrics = ctx.measureText(text);
          const labelWidth = Math.max(160, textMetrics.width + 20);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(x, y - 30, labelWidth, 30);

          ctx.strokeStyle = '#00FFFF';
          ctx.strokeRect(x, y - 30, labelWidth, 30);

          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(text, x + 5, y - 10);
        } catch (err) {
          console.error("Error drawing detection:", err);
        }
      });
    };

    // If video dimensions are not yet available, wait for the video to load data
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      video.onloadeddata = () => {
        drawOverlay();
      };
    } else {
      // Otherwise, immediately draw the overlay
      drawOverlay();
    }
  }, [detectionResults]);

  // Function to draw a 3x3 grid on the canvas
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const cellWidth = width / 3;
    const cellHeight = height / 3;
  
    // Use bright white for grid lines with increased thickness
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
  
    // Draw horizontal lines
    for (let i = 1; i < 3; i++) {
      const y = i * cellHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  
    // Draw vertical lines
    for (let i = 1; i < 3; i++) {
      const x = i * cellWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  
    // Optionally, add quadrant numbers with a contrasting backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // dark background for numbers
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  
    const quadrants = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const index = row * 3 + col;
        const centerX = col * cellWidth + cellWidth / 2;
        const centerY = row * cellHeight + cellHeight / 2;
        ctx.fillText(quadrants[index], centerX, centerY);
      }
    }
  };

  // Toggle detection on/off
  const toggleDetection = () => {
    setIsDetecting(prev => !prev);
    setStatus(isDetecting ? 'Detection paused' : 'Detection running');
  };

  // Framerate control
  const adjustFramerate = (newRate: number) => {
    setFramerate(newRate);
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
        />
        
        {/* Status overlay */}
        <div className="absolute top-0 left-0 right-0 bg-black/60 text-white p-2 flex justify-between items-center">
          <span>{status}</span>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <span className="mr-2 text-xs">Speed:</span>
              <select 
                value={framerate} 
                onChange={(e) => adjustFramerate(Number(e.target.value))}
                className="bg-gray-800 text-white text-xs rounded px-1 py-1"
              >
                <option value="1">Slow (1 FPS)</option>
                <option value="2">Normal (2 FPS)</option>
                <option value="5">Fast (5 FPS)</option>
              </select>
            </div>
            <button
              onClick={toggleDetection}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded text-sm"
            >
              {isDetecting ? 'Pause' : 'Start'} Detection
            </button>
          </div>
        </div>
        
        {/* Detections panel */}
        <div className="absolute bottom-0 right-0 max-w-xs bg-black/60 text-white p-2 text-sm max-h-32 overflow-y-auto">
          {detectionResults.length === 0 ? (
            <p className="italic text-gray-400">No objects detected</p>
          ) : (
            <div>
              <p className="font-bold mb-1 text-cyan-300">Detected {detectionResults.length} objects:</p>
              <ul className="space-y-1">
                {detectionResults.map((det, idx) => (
                  <li key={idx} className="flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 mr-2"></span>
                    <span className="font-medium">{det.class}</span>
                    <span className="text-cyan-300 mx-1">({Math.round(det.confidence * 100)}%)</span>
                    <span className="text-xs text-gray-400">Q{det.quadrant}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Custom root wrapper to ensure context is available globally
export function CameraProviderRoot() {
  return (
    <CameraProvider>
      <div id="camera-provider-initialized" data-testid="camera-provider-root" />
    </CameraProvider>
  );
}

// Wrapped export to provide camera access
export default function WebcamDetectionWithCamera() {
  return (
    <CameraProvider>
      <WebcamDetection />
    </CameraProvider>
  );
}