import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const elementId = 'barcode-reader';
    let scanner: Html5Qrcode | null = null;
    let stopped = false;

    try {
      scanner = new Html5Qrcode(elementId);
    } catch {
      setError('Kan barcodescanner niet initialiseren.');
      return;
    }

    const currentScanner = scanner;

    currentScanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 150 } },
        (decodedText) => {
          if (scannedRef.current || stopped) return;
          scannedRef.current = true;
          currentScanner.stop().then(() => {
            onScanRef.current(decodedText);
          }).catch(() => {
            onScanRef.current(decodedText);
          });
        },
        () => {}
      )
      .catch(() => {
        if (!stopped) {
          setError('Kan camera niet openen. Geef toestemming voor cameratoegang.');
        }
      });

    return () => {
      stopped = true;
      try {
        if (currentScanner.getState() === 2) { // SCANNING state
          currentScanner.stop().catch(() => {});
        }
      } catch {
        // scanner may not have started yet, ignore
      }
    };
  }, []); // no dependencies - run once

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Barcode scannen</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div
          id="barcode-reader"
          className="w-full max-w-sm rounded-xl overflow-hidden"
        />
        {error ? (
          <p className="mt-4 text-sm text-destructive text-center">{error}</p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground text-center">
            Richt de camera op de barcode van het product.
          </p>
        )}
      </div>
    </div>
  );
}
