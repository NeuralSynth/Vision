'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import { useCameraStream } from '@/components/WebcamDetection';

// Dynamically import components that use browser APIs with ssr: false
const ModelViewer = dynamic(
  () => import('@/components/ModelViewer/ModelViewer').then(mod => mod.ModelViewer),
  { ssr: false }
);

const AnimatedBackground = dynamic(
  () => import('@/components/AnimatedBackground'),
  { ssr: false }
);

// Import WebcamDetection with SSR disabled
const WebcamDetection = dynamic(
  () => import('@/components/WebcamDetection').then(mod => mod.default),
  { ssr: false }
);

export default function DemoPage() {
  const [activeFeature, setActiveFeature] = useState('vision');
  const [isMounted, setIsMounted] = useState(false);
  const { getStream } = useCameraStream();

  useEffect(() => {
    setIsMounted(true);
    
    // Initialize camera stream when component mounts
    if (isMounted) {
      getStream().catch(err => {
        console.error('Error initializing camera:', err);
      });
    }
  }, [isMounted, getStream]);

  const features = [
    {
      id: 'vision',
      title: 'AI Vision Enhancement',
      description: 'Experience real-time object detection and recognition with our advanced AI algorithms.',
      animation: 'fade-right'
    },
    {
      id: 'interface',
      title: 'Intuitive Interface',
      description: 'Control your experience with natural gestures and voice commands.',
      animation: 'fade-left'
    },
    {
      id: 'analytics',
      title: 'Real-time Analytics',
      description: 'Get instant feedback and detailed analysis of your surroundings.',
      animation: 'fade-up'
    }
  ];

  return (
    <>
      <Script 
        src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js" 
        type="module"
        strategy="afterInteractive"
      />
      
      <div className="min-h-screen bg-black">
        {isMounted && <AnimatedBackground />}
        
        <div className="relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-8">
                Experience Percevia
              </h1>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-16">
                Step into the future of vision enhancement technology with our interactive demo.
              </p>
            </div>

            {/* Only render WebcamDetection when client-side */}
            {isMounted && (
              <div className="mb-24">
                <h2 className="text-3xl font-bold text-white text-center mb-8">Live Object Detection</h2>
                <div className="max-w-3xl mx-auto">
                  <WebcamDetection />
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
              <div className="relative h-[400px] w-full">
                {isMounted && (
                  <ModelViewer 
                    src="/models/glasses.glb" 
                    poster="/models/glasses-poster.webp" 
                    alt="Percevia Smart Glasses" 
                    autoRotate={true} 
                  />
                )}
              </div>
              
              <div className="space-y-8">
                {features.map((feature) => (
                  <div
                    key={feature.id}
                    className={`p-6 rounded-lg border border-white/10 backdrop-blur-sm transition-all duration-300 hover:border-blue-500/50 cursor-pointer ${
                      activeFeature === feature.id ? 'bg-blue-500/10 border-blue-500' : 'bg-black/50'
                    }`}
                    onClick={() => setActiveFeature(feature.id)}
                    data-aos={feature.animation}
                  >
                    <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-300">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <a
                href="/pricing"
                className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-white font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-colors shadow-lg hover:shadow-blue-500/25"
              >
                Get Started Now
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}