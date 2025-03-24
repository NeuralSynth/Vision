'use client';

import './model-viewer.css';

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
        'auto-rotate'?: boolean;
      }, HTMLElement>;
    }
  }
}

interface ModelViewerProps {
  src: string;
  poster?: string;
  alt?: string;
  autoRotate?: boolean;
  cameraControls?: boolean;
  arModes?: string;
  shadowIntensity?: number;
  toneMapping?: string;
  exposure?: number;
  className?: string;
}

export const ModelViewer = ({
  src,
  poster = '',
  alt = 'A 3D model',
  autoRotate = false,
  cameraControls = true,
  arModes = 'webxr scene-viewer quick-look',
  shadowIntensity = 0.76,
  toneMapping = 'neutral',
  exposure = 1,
  className = '',
}: ModelViewerProps) => {
  return (
    <div className={className}>
      <model-viewer
        src={src}
        poster={poster}
        alt={alt}
        ar
        ar-modes={arModes}
        camera-controls={cameraControls}
        tone-mapping={toneMapping}
        shadow-intensity={shadowIntensity}
        exposure={exposure}
        auto-rotate={autoRotate}
      >
        <div className="progress-bar hide" slot="progress-bar">
          <div className="update-bar"></div>
        </div>
        <button slot="ar-button" id="ar-button">
          View in your space
        </button>
        <div id="ar-prompt">
          <img src="https://modelviewer.dev/shared-assets/icons/hand.png" alt="AR prompt" />
        </div>
      </model-viewer>
    </div>
  );
};