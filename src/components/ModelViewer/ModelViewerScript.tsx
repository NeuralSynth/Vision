'use client';

import Script from 'next/script';

export const ModelViewerScript = () => {
  return (
    <Script
      src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
      type="module"
      strategy="beforeInteractive"
    />
  );
};