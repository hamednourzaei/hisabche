"use client";

import { useSceneObserver } from "./use-scene-observer";

export interface CTASceneProps {
  onNavigateLogin: () => void;
}

export default function CTAScene({ onNavigateLogin }: CTASceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({ 
    threshold: 0.3,
    narrativeState: "action"
  });

  return (
    <section
      id="cta"
      ref={ref}
      data-narrative="action"
      className="section-padding"
    >
      <div className="container-narrow max-w-2xl">
        <div
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface-elevated to-purple-500/5 p-12 text-center sm:p-16 border border-border"
          style={{
            opacity: state === "animated" ? 1 : 0,
            transform: state === "animated" ? "scale(1)" : "scale(0.98)",
            transition: `opacity 0.5s var(--ease-out), transform 0.5s var(--ease-out)`,
          }}
        >
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative">
            <h2 className="text-4xl font-bold text-foreground mb-4">آماده‌ای؟</h2>
            <p className="text-muted-foreground mb-8">۳۰ ثانیه تا اولین فاکتور واقعی</p>
            <button onClick={onNavigateLogin} className="btn-primary mx-auto">
              شروع کن — رایگان ←
            </button>
            <p className="text-xs text-muted-foreground mt-6">بدون نیاز به کارت بانکی · لغو آسان</p>
          </div>
        </div>
      </div>
    </section>
  );
}