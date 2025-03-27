import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import './animations.css';
import { Navigation } from '@/components/Navigation/Navigation';
import { Footer } from '@/components/Footer/Footer';
import { ModelViewerScript } from '@/components/ModelViewer/ModelViewerScript';
import { CameraProvider } from '@/components/WebcamDetection';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ weight: ['400', '500', '600', '700', '800'], subsets: ['latin'], variable: '--font-poppins' });

export const metadata = {
  title: 'Percevia - AI-Powered Detection Glasses',
  description: 'Experience the future of vision with AI-powered detection glasses',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen bg-black text-white overflow-x-hidden font-poppins">
        {/* Move ModelViewerScript inside the body */}
        <ModelViewerScript />
        <CameraProvider>
          <Navigation />
          <main className="pt-16">{children}</main>
          <Footer />
        </CameraProvider>
      </body>
    </html>
  );
}