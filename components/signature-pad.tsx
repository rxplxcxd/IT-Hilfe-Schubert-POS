'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  existingSignature?: string;
  disabled?: boolean;
  label?: string;
}

export function SignaturePad({ onSave, existingSignature, disabled, label }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (existingSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = existingSignature;
    }
  }, [existingSignature]);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    lastPoint.current = getPos(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx || !lastPoint.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPoint.current = pos;
    setHasDrawn(true);
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPoint.current = null;
    if (hasDrawn && canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr);
    setHasDrawn(false);
    onSave('');
  };

  return (
    <div className="space-y-1.5">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <div className="relative border-2 border-dashed border-border rounded-lg bg-card overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 140 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-sm">Hier unterschreiben</p>
          </div>
        )}
        {hasDrawn && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-7 w-7"
            onClick={clearCanvas}
          >
            <Eraser className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
