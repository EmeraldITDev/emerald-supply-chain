import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, CameraOff } from 'lucide-react';

/**
 * Web-based barcode / QR scanner using the browser BarcodeDetector API where
 * available (Chrome on Android, recent iOS Safari), with a manual entry
 * fallback so the flow always works. No native app required.
 */
export const BarcodeScannerDialog = ({
  open,
  onOpenChange,
  onDetected,
  title = 'Scan Barcode / QR',
  description = 'Point the camera at the item label, or type the code manually.',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  title?: string;
  description?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manual, setManual] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    const stop = () => {
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setScanning(false);
    };

    const start = async () => {
      setCameraError(null);
      const Detector = (window as unknown as { BarcodeDetector?: new (o?: unknown) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser. Enter the code manually.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setScanning(true);
        if (!Detector) {
          setCameraError('Automatic detection is unavailable on this browser — enter the code manually.');
          return;
        }
        const detector = new Detector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'upc_a'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            const code = results?.[0]?.rawValue;
            if (code) {
              onDetected(code);
              onOpenChange(false);
              return;
            }
          } catch {
            // transient decode failure — keep scanning
          }
          raf = requestAnimationFrame(() => void tick());
        };
        raf = requestAnimationFrame(() => void tick());
      } catch {
        setCameraError('Camera permission denied. Enter the code manually.');
      }
    };

    if (open) void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-md bg-muted">
            <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
            <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded bg-background/80 px-2 py-1 text-xs">
              {scanning ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
              {scanning ? 'Scanning…' : 'Camera off'}
            </div>
          </div>
          {cameraError && <p className="text-xs text-muted-foreground">{cameraError}</p>}
          <div className="space-y-2">
            <Label htmlFor="manual-code">Manual code entry</Label>
            <div className="flex gap-2">
              <Input
                id="manual-code"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="SKU or barcode"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manual.trim()) {
                    onDetected(manual.trim());
                    setManual('');
                    onOpenChange(false);
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (!manual.trim()) return;
                  onDetected(manual.trim());
                  setManual('');
                  onOpenChange(false);
                }}
              >
                Use
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;