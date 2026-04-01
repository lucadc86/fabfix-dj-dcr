import { useRef, useCallback } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  color?: string;
  size?: number;
  label?: string;
}

export default function Knob({ value, min, max, onChange, color = '#b44fff', size = 40 }: KnobProps) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  const normalized = (value - min) / (max - min);
  const startAngle = -135;
  const endAngle = 135;
  const angle = startAngle + normalized * (endAngle - startAngle);
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcStart = toRad(startAngle - 90);
  const arcEnd = toRad(angle - 90);
  const x1 = cx + r * Math.cos(arcStart);
  const y1 = cy + r * Math.sin(arcStart);
  const x2 = cx + r * Math.cos(arcEnd);
  const y2 = cy + r * Math.sin(arcEnd);
  const largeArc = angle - startAngle > 180 ? 1 : 0;
  const arcD = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  const indicatorX = cx + (r - 4) * Math.cos(toRad(angle - 90));
  const indicatorY = cy + (r - 4) * Math.sin(toRad(angle - 90));

  const onMouseDownHandler = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    e.preventDefault();

    const handleMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (startY.current - ev.clientY) / 150;
      const newValue = Math.max(min, Math.min(max, startValue.current + delta * (max - min)));
      onChange(newValue);
    };

    const handleUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [value, min, max, onChange]);

  return (
    <svg width={size} height={size} style={{ cursor: 'ns-resize', userSelect: 'none' }} onMouseDown={onMouseDownHandler}>
      <path d={`M ${cx + r * Math.cos(toRad(startAngle - 90))} ${cy + r * Math.sin(toRad(startAngle - 90))} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(toRad(endAngle - 90))} ${cy + r * Math.sin(toRad(endAngle - 90))}`} fill="none" stroke="rgba(180, 79, 255, 0.15)" strokeWidth="4" strokeLinecap="round" />
      <path d={arcD} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      <circle cx={cx} cy={cy} r={r - 5} fill="#0a0014" stroke={`${color}44`} strokeWidth="1" />
      <line x1={cx} y1={cy} x2={indicatorX} y2={indicatorY} stroke={color} strokeWidth="2" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 2px ${color})` }} />
    </svg>
  );
}
