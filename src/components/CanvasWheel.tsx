import { useEffect, useRef, useState } from "react";
import tickSound from "@/assets/tick-sound.mp3";

interface Recompensa {
  tipo: string;
  valor: string;
  cor: string;
}

interface CanvasWheelProps {
  recompensas: Recompensa[];
  rotation: number;
  spinning: boolean;
  labelFontSize?: number;
  showArrow?: boolean;
  duracaoSpin?: number;
}

// Converte qualquer cor CSS para RGB
function anyToRGB(color: string): { r: number; g: number; b: number } {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = color;
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const m = cs.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 0, g: 0, b: 0 };
}

// Calcula cor de contraste (preto ou branco)
function contrastTextColor(color: string): string {
  const { r, g, b } = anyToRGB(color);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
}

// Quebra texto em múltiplas linhas
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  maxLines: number
) {
  const words = String(text).split(" ");
  let line = "";
  const lines: string[] = [];

  for (let n = 0; n < words.length; n++) {
    const test = line ? line + " " + words[n] : words[n];
    const w = ctx.measureText(test).width;
    if (w > x - 60 && n > 0) {
      lines.push(line);
      line = words[n];
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
}

// Detecta qual segmento está sob a seta (no topo)
function indexAtPin(angle: number, totalSegments: number): number {
  const n = Math.max(totalSegments, 1);
  const TAU = Math.PI * 2;
  const slice = TAU / n;
  const aPin = ((-Math.PI / 2 - angle) % TAU + TAU) % TAU;
  let start = -Math.PI / 2;

  for (let i = 0; i < n; i++) {
    let a0 = ((start % TAU) + TAU) % TAU;
    let a1 = (((start + slice) % TAU) + TAU) % TAU;
    if (a0 <= a1) {
      if (aPin >= a0 - 1e-7 && aPin < a1 - 1e-7) return i;
    } else {
      if (aPin >= a0 - 1e-7 || aPin < a1 - 1e-7) return i;
    }
    start += slice;
  }
  return 0;
}

export function CanvasWheel({ recompensas, rotation, spinning, labelFontSize = 52, showArrow = true, duracaoSpin = 4 }: CanvasWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSegment, setCurrentSegment] = useState<number>(0);
  const animationFrameRef = useRef<number>();
  
  // Inicializar áudio
  useEffect(() => {
    audioRef.current = new Audio(tickSound);
    audioRef.current.volume = 0.3;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Monitorar rotação e tocar som quando segmento mudar
  useEffect(() => {
    if (!spinning || !containerRef.current || recompensas.length === 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const startTime = Date.now();
    const duration = duracaoSpin * 1000;
    let lastPlayedSegment = -1;

    const checkSegment = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        return;
      }

      // Calcular rotação atual usando a mesma curva de animação
      const progress = elapsed / duration;
      const eased = 1 - Math.pow(1 - progress, 3); // cubic-bezier approximation
      const currentRotation = rotation * eased;
      
      // Converter para radianos e normalizar
      const angleInDegrees = currentRotation % 360;
      const angleInRadians = (angleInDegrees * Math.PI) / 180;
      
      // Detectar qual segmento está sob a seta
      const segment = indexAtPin(angleInRadians, recompensas.length);
      
      // Tocar som apenas quando mudar de segmento (evitar duplicatas)
      if (segment !== lastPlayedSegment) {
        lastPlayedSegment = segment;
        setCurrentSegment(segment);
        
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkSegment);
    };

    animationFrameRef.current = requestAnimationFrame(checkSegment);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [spinning, rotation, recompensas.length, duracaoSpin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !recompensas.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const R = canvas.width / 2;

    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(R, R);

    // Clipar para círculo
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R - 20, 0, Math.PI * 2);
    ctx.clip();

    const n = Math.max(1, recompensas.length);
    const slice = (Math.PI * 2) / n;
    let start = -Math.PI / 2;

    // Desenhar segmentos
    recompensas.forEach((recompensa) => {
      const end = start + slice;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R - 18, start, end);
      ctx.closePath();
      ctx.fillStyle = recompensa.cor;
      ctx.fill();

      // Desenhar label - cada texto com tamanho independente
      const mid = (start + end) / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = contrastTextColor(recompensa.cor);

      const text = `${recompensa.valor} ${recompensa.tipo}`;
      const maxWidth = R - 66;
      
      // Ajustar tamanho base de acordo com número de segmentos
      let baseFontSize = 80;
      if (n > 8) baseFontSize = 60;
      if (n > 12) baseFontSize = 48;
      if (n > 16) baseFontSize = 36;
      
      // Reduzir ainda mais para textos longos
      const textLength = text.length;
      if (textLength > 15) baseFontSize = Math.min(baseFontSize, 48);
      if (textLength > 20) baseFontSize = Math.min(baseFontSize, 40);
      
      let fontSize = baseFontSize;
      ctx.font = `400 ${fontSize}px 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu`;
      
      // Reduzir fonte até o texto caber no espaço disponível
      let textWidth = ctx.measureText(text).width;
      while (textWidth > maxWidth && fontSize > 12) {
        fontSize -= 1;
        ctx.font = `400 ${fontSize}px 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu`;
        textWidth = ctx.measureText(text).width;
      }
      
      ctx.fillText(text, R - 46, 0);
      ctx.restore();

      start = end;
    });

    ctx.restore();

    // Desenhar aro central (sutil)
    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.stroke();

    ctx.restore();
  }, [recompensas, labelFontSize]);

  const uniqueId = `wheel-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div ref={containerRef} className={`wheel-canvas-container ${uniqueId}`} style={{ '--spin-duration': `${duracaoSpin}s` } as React.CSSProperties}>
      <style>{`
        .wheel-canvas-container.${uniqueId} {
          position: relative;
          width: 100%;
          max-width: 600px;
          aspect-ratio: 1;
        }
        
        .wheel-canvas-container.${uniqueId} .wheel-canvas-wrapper {
          width: 100%;
          height: 100%;
          transition: ${spinning ? 'transform var(--spin-duration, 4s) cubic-bezier(0.17, 0.67, 0.16, 0.99)' : 'none'};
          transform: rotate(${rotation}deg);
          will-change: ${spinning ? 'transform' : 'auto'};
        }

        .wheel-canvas-container.${uniqueId} .wheel-canvas {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.25));
        }


        .wheel-canvas-container.${uniqueId} .arrow-indicator {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
        }

        .wheel-canvas-container.${uniqueId} .arrow-indicator::before {
          content: "";
          position: absolute;
          top: 1px;
          left: 0;
          width: 0;
          height: 0;
          border-left: 25px solid transparent;
          border-right: 25px solid transparent;
          border-top: 45px solid rgba(0, 0, 0, 0.2);
          filter: blur(4px);
        }

        .wheel-canvas-container.${uniqueId} .arrow-indicator::after {
          content: "";
          position: relative;
          display: block;
          width: 0;
          height: 0;
          border-left: 28px solid transparent;
          border-right: 28px solid transparent;
          border-top: 50px solid hsl(223 100% 55%);
          filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5));
        }
      `}</style>

      <div className="wheel-canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="wheel-canvas"
          width="1200"
          height="1200"
          aria-label="Roleta"
        />
      </div>
      
      {showArrow && <div className="arrow-indicator" />}
    </div>
  );
}
