import React, { useRef, useEffect, useState } from 'react';
import { ParticleAvatarProps } from '../../types';
import './ParticleAvatar.module.css';

const ParticleAvatar: React.FC<ParticleAvatarProps> = ({ size = 38, particleCount = 540 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fastTarget = useRef(1);
  const fastValue = useRef(1);
  const colorLerpValue = useRef(0);
  const [_, setRerender] = useState(0);
  const [glow, setGlow] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [outerGlow, setOuterGlow] = useState(false);

  // 활성화 상태에 따라 파티클 수 결정
  const activeParticleCount = hovered || glow ? Math.floor(particleCount / 2) : particleCount;
  // 파티클 배열 useState로 관리
  const [particles, setParticles] = useState<any[]>([]);

  // 캔버스 관련 값 useRef로 관리
  const cxRef = useRef(0);
  const cyRef = useRef(0);
  const rRef = useRef(0);

  useEffect(() => {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 1;
    cxRef.current = cx;
    cyRef.current = cy;
    rRef.current = r;
    setParticles(Array.from({ length: activeParticleCount }).map((_, i) => {
      const theta = (2 * Math.PI * i) / activeParticleCount;
      // phase는 0~2PI 사이로만 약간 랜덤하게
      const phase = Math.random() * Math.PI * 2;
      return {
        baseX: cx,
        baseY: cy,
        angle: theta,
        baseRadius: r,
        targetRadius: r,
        currentRadius: r,
        phase,
      };
    }));
  }, [activeParticleCount, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    let running = true;
    function draw(t: number) {
      if (!ctx) return;
      fastValue.current += (fastTarget.current - fastValue.current) * 0.05;
      fastValue.current = Math.max(0.1, Math.min(1, fastValue.current));
      const colorTarget = hovered || glow ? 1 : 0;
      colorLerpValue.current += (colorTarget - colorLerpValue.current) * 0.08;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cxRef.current, cyRef.current, rRef.current, 0, 2 * Math.PI);
      ctx.clip();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let px, py;
        let particleRadius = 1;
        if (hovered || glow) {
          // 원형 테두리에 정확히 분포, 중앙 쪽으로만 살짝 튀는 효과
          const drumFreq = 0.0028; // 튀는 속도(30% 감소)
          const drumAmp = 4; // 튀는 세기 줄임
          const drum = Math.abs(Math.sin(t * drumFreq + p.phase)) * drumAmp;
          const targetRadius = rRef.current - drum;
          p.currentRadius += (targetRadius - p.currentRadius) * 0.028;
          px = cxRef.current + p.currentRadius * Math.cos(p.angle);
          py = cyRef.current + p.currentRadius * Math.sin(p.angle);
        } else {
          const θ = p.angle;
          const baseRadius = rRef.current * 0.7;
          const wave = Math.sin(t * 0.001 + θ * 3 + p.phase) * 12;
          let radius = baseRadius + wave;
          if (radius > rRef.current - 2) {
            p.phase += Math.random() * 0.5;
            radius = rRef.current - 2 - Math.abs(wave) * 0.5;
          }
          p.currentRadius += (radius - p.currentRadius) * 0.09;
          px = cxRef.current + p.currentRadius * Math.cos(θ);
          py = cyRef.current + p.currentRadius * Math.sin(θ);
        }
        const colorLerp = colorLerpValue.current;
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const rC = Math.round(lerp(144, 25, colorLerp));
        const gC = Math.round(lerp(202, 118, colorLerp));
        const bC = Math.round(lerp(249, 210, colorLerp));
        const color = `rgba(${rC},${gC},${bC},0.95)`;
        ctx.beginPath();
        ctx.arc(px, py, particleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = hovered || glow ? 3 : 1;
        ctx.fill();
      }
      ctx.restore();
    }
    function animate(now: number) {
      if (!running) return;
      draw(now);
      setRerender(v => v + 1);
      requestAnimationFrame(animate);
    }
    animate(performance.now());
    return () => { running = false; };
  }, [size, particles, hovered, glow]);

  // hover/typing 상태에 따라 targetRadius 변경
  const updateTarget = () => {
    for (let i = 0; i < particles.length; i++) {
      particles[i].targetRadius = (hovered || glow) ? rRef.current : particles[i].baseRadius;
    }
  };
  updateTarget();

  // 마우스 이벤트: 파티클 흩어짐/복귀, glow 효과
  const handleEnter = () => {
    setHovered(true);
    fastTarget.current = 0.01;
    setGlow(true);
    setOuterGlow(true);
  };
  const handleLeave = () => {
    setHovered(false);
    fastTarget.current = 2;
    setGlow(false);
    setOuterGlow(false);
  };
  
  // 외부에서 세로가 채팅 칠 때도 파동 커브 효과
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setParticleFast = (v: boolean) => {
        fastTarget.current = v ? 0.1 : 1;
        setGlow(v);
        setOuterGlow(v);
      };
    }
    return () => {
      if (typeof window !== 'undefined') delete (window as any).__setParticleFast;
    };
  }, []);

  // 입체/빛나는 테두리 효과
  const borderStyle = hovered || glow
    ? {
        boxShadow: '0 0 0 4px #b3e5fc, 0 0 16px 8px #90caf9cc, 0 2px 16px 0 #90caf9',
        border: '2.5px solid #90caf9',
        background: 'radial-gradient(circle at 50% 50%, #fff 60%, #e3f2fd 100%)',
        transition: 'box-shadow 0.35s cubic-bezier(.4,2,.2,1), border 0.35s, background 0.35s',
      }
    : {
        boxShadow: '0 1px 4px 0 rgba(31,38,135,0.04)',
        border: '2.5px solid #e3eaf5',
        background: '#fff',
        transition: 'box-shadow 0.35s, border 0.35s, background 0.35s',
      };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={size * (window.devicePixelRatio || 1)}
        height={size * (window.devicePixelRatio || 1)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'block',
          cursor: 'pointer',
          ...borderStyle,
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      />
      {/* Outer Glow 애니메이션 */}
      {outerGlow && (
        <div
          style={{
            position: 'absolute',
            top: -8,
            left: -8,
            width: size + 16,
            height: size + 16,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #90caf9 0%, #90caf9 30%, transparent 70%)',
            opacity: 0.6,
            animation: 'outer-glow-pulse 1.5s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      )}
      <style>{`
        @keyframes outer-glow-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default ParticleAvatar; 