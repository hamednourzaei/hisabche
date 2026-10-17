// src/components/SafeSaaSCard.tsx
import React from 'react'
import { motion } from 'framer-motion'

interface SafeSaaSCardProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  variant?: 'cyan' | 'purple' | 'emerald' | 'amber'
  align?: 'left' | 'right' | 'center'
  delay?: number
}

export const SafeSaaSCard: React.FC<SafeSaaSCardProps> = ({
  title,
  subtitle,
  icon,
  variant = 'cyan',
  delay = 0,
}) => {
  // پالت‌های رنگی حرفه‌ای SaaS با لبه‌های نوری کنترل‌شده
  const variantStyles = {
    cyan: 'border-cyan-500/30 bg-[#110f20]/80 shadow-[0_0_25px_rgba(6,182,212,0.15)] text-cyan-300',
    purple:
      'border-purple-500/30 bg-[#110f20]/80 shadow-[0_0_25px_rgba(168,85,247,0.15)] text-purple-300',
    emerald:
      'border-emerald-500/30 bg-[#110f20]/80 shadow-[0_0_25px_rgba(16,185,129,0.15)] text-emerald-300',
    amber:
      'border-amber-500/30 bg-[#110f20]/80 shadow-[0_0_25px_rgba(245,158,11,0.15)] text-amber-300',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1], // Exponential Out منحنی سرعت استودیویی
      }}
      className={`relative w-full max-w-[92%] mx-auto rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 ${variantStyles[variant]}`}
      style={{
        boxSizing: 'border-box',
        overflow: 'hidden', // جلوگیری قاطع از بیرون‌زدگی محتوا
      }}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex-shrink-0 p-2.5 rounded-xl bg-white/5 border border-white/10">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {/* عنوان با قابلیت کنترل توازن متن و جلوگیری از کلمات یتیم */}
          <h4
            className="text-white font-bold text-lg leading-snug tracking-tight mb-1.5"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </h4>
          {subtitle && (
            <p
              className="text-slate-300 text-sm leading-relaxed font-normal opacity-90"
              style={{ textWrap: 'pretty' }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
