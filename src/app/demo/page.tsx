'use client';

import { useEffect, useState } from 'react';
import { ModelViewer } from '@/components/ModelViewer/ModelViewer';
import { ModelViewerScript } from '@/components/ModelViewer/ModelViewerScript';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function DemoPage() {
  const [activeFeature, setActiveFeature] = useState('vision');

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
    <div className="min-h-screen bg-black">
      <AnimatedBackground />
      
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

          <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
            <div className="relative h-[400px] w-full">
              <ModelViewerScript />
              <ModelViewer src="/models/glasses.glb" poster="/models/glasses-poster.webp" alt="Percevia Smart Glasses" autoRotate={true} />
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
  );
}