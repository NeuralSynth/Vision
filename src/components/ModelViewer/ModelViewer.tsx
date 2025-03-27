'use client';

import './model-viewer.css';
import React, { forwardRef, useRef } from 'react';

// Add type declaration for the model-viewer element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src: string;
        poster?: string;
        alt?: string;
        ar?: boolean;
        'ar-modes'?: string;
        'camera-controls'?: boolean;
        'tone-mapping'?: string;
        'shadow-intensity'?: number;
        exposure?: number;
        'auto-rotate'?: boolean | undefined;
      }, HTMLElement>;
    }
  }
}

export interface ModelViewerProps {
  src: string;
  poster: string;
  alt: string;
  autoRotate?: boolean;
  // Add any additional props you need, such as className, style, etc.
}

const ModelViewer = forwardRef<HTMLElement, ModelViewerProps>((props, ref) => {
  const { src, poster, alt, autoRotate } = props;

  return (
    // The underlying HTML element, note the tag name should match the model-viewer component
    <model-viewer
      ref={ref}
      src={src}
      poster={poster}
      alt={alt}
      auto-rotate={autoRotate}
      // ...existing props if any...
    />
  );
});

ModelViewer.displayName = 'ModelViewer';

export { ModelViewer };

const App = () => {
  const modelViewerRef = useRef<HTMLElement>(null);

  return (
    <ModelViewer
      ref={modelViewerRef}
      src="/models/glasses.glb"
      poster="/models/glasses-poster.webp"
      alt="Percevia Smart Glasses"
      autoRotate={true}
    />
  );
};

export default App;