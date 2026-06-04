import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const phrases = [
  "Just a second…",
  "Amazing offers on your way",
  "Finding the best deals",
  "Almost there…",
  "Get ready to earn",
  "Here we go!"
]

interface OfferwallPreloaderProps {
  onComplete: () => void
  dataReady: boolean
}

export default function OfferwallPreloader({ onComplete, dataReady }: OfferwallPreloaderProps) {
  const [index, setIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (index >= phrases.length - 1) {
      const tryExit = () => {
        if (dataReady) {
          setTimeout(() => {
            setIsExiting(true)
            setTimeout(() => onComplete(), 900)
          }, 600)
        } else {
          setTimeout(tryExit, 300)
        }
      }
      setTimeout(tryExit, 800)
      return
    }
    const timer = setTimeout(() => setIndex(i => i + 1), index === 0 ? 1200 : 900)
    return () => clearTimeout(timer)
  }, [index, dataReady, onComplete])

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={isExiting ? { opacity: 0, y: "-100%" } : { opacity: 1, y: 0 }}
      transition={isExiting ? { duration: 0.8, ease: [0.76, 0, 0.24, 1] } : {}}
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden"
      style={{ background: "white" }}
    >
      {/* Animated background — floating gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", top: "-200px", right: "-200px" }}
          animate={{ x: [0, 30, -20, 0], y: [0, -20, 30, 0], scale: [1, 1.1, 0.95, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)", bottom: "-150px", left: "-150px" }}
          animate={{ x: [0, -25, 20, 0], y: [0, 25, -15, 0], scale: [1, 0.9, 1.1, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[350px] h-[350px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", top: "40%", left: "50%" }}
          animate={{ x: [0, 40, -30, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Text content */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight text-center px-8"
            style={{ color: "#340075" }}
          >
            {phrases[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
