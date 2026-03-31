export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <circle cx="20" cy="20" r="18" fill="#0a0014" stroke="#b44fff" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 4px #b44fff)' }} />
          <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(180,79,255,0.2)" strokeWidth="1" />
          <circle cx="20" cy="20" r="9" fill="none" stroke="rgba(180,79,255,0.15)" strokeWidth="1" />
          <circle cx="20" cy="20" r="5" fill="none" stroke="rgba(180,79,255,0.1)" strokeWidth="1" />
          <circle cx="20" cy="20" r="3" fill="#b44fff" style={{ filter: 'drop-shadow(0 0 6px #b44fff)' }} />
          <ellipse cx="14" cy="12" rx="3" ry="2" fill="rgba(255,255,255,0.05)" transform="rotate(-30 14 12)" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-black tracking-widest" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #d88fff 50%, #b44fff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.15em', fontFamily: "'Space Grotesk', Inter, sans-serif", textShadow: 'none' }}>FABFIX</span>
          <span className="text-xl font-black" style={{ background: 'linear-gradient(135deg, #b44fff 0%, #ff2d78 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', Inter, sans-serif" }}>DJ</span>
          <span className="text-xl font-black tracking-widest" style={{ background: 'linear-gradient(135deg, #00f5ff 0%, #b44fff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.15em', fontFamily: "'Space Grotesk', Inter, sans-serif" }}>DCR</span>
        </div>
        <span className="text-[9px] tracking-[0.4em] text-purple-500 font-medium uppercase mt-0.5">Software Professionale DCR Group</span>
      </div>
    </div>
  );
}
