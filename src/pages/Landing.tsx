import {
  ArrowRight,
  Shield,
  Zap,
  Users,
  BarChart3,
  Linkedin,
  Facebook,
  Instagram,
  Globe,
  Star,
  Award,
  Sparkles,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { useState } from "react";

/* ✅ Enhanced Fade + blur animation with bounce */
const fadeBlurUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(12px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 1,
      ease: [0.16, 1, 0.3, 1],
      bounce: 0.4,
    },
  },
};

/* ✅ Enhanced staggered letters animation */
const letterAnimation: Variants = {
  hidden: { opacity: 0, y: 20, rotateX: 90 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      duration: 0.6,
      ease: "backOut",
    },
  },
};

/* ✅ Floating animation for subtle movement */
const floatAnimation: Variants = {
  hidden: { y: 0 },
  visible: {
    y: [0, -10, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

/* ✅ Pulse glow animation - subtle version */
const glowAnimation: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
    },
  },
};

/* ✅ Scale in animation */
const scaleIn: Variants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: "backOut",
    },
  },
};

/* ✅ Glass effect animation */
const glassEffect: Variants = {
  hidden: { backdropFilter: "blur(0px)", backgroundColor: "rgba(255, 255, 255, 0)" },
  visible: {
    backdropFilter: "blur(20px)",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    transition: {
      duration: 0.8,
      ease: "easeOut",
    },
  },
};

/* ✅ Card separation animation variants - smoother */
const combinedCard: Variants = {
  initial: {
    scale: 1,
    borderRadius: "1.5rem",
    opacity: 0,
    y: 30,
  },
  separated: (i: number) => ({
    scale: 1,
    x: 0,
    y: 0,
    opacity: 1,
    borderRadius: "1.5rem",
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
      delay: i * 0.15,
    }
  }),
  hover: {
    scale: 1.02,
    y: -5,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.2
    }
  }
};

/* ✅ Combined card container animation - smoother fade */
const combinedContainer: Variants = {
  initial: {
    scale: 1,
    opacity: 1,
  },
  separated: {
    scale: 0.95,
    opacity: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  }
};

/* ✅ Features appear animation */
const featureAppear: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: "backOut"
    }
  }
};

/* ✅ Helper function to split text into letters */
const splitTextToLetters = (text: string) =>
  text.split("").map((char, i) => (
    <motion.span key={i} variants={letterAnimation}>
      {char === " " ? "\u00A0" : char}
    </motion.span>
  ));

export default function Landing() {
  const [isSeparated, setIsSeparated] = useState(false);
  const [activeFeature, setActiveFeature] = useState<number | null>(null);

  const features = [
    {
      icon: Shield,
      title: "Secure & Reliable",
      desc: "99.9% uptime and enterprise-grade security.",
      color: "from-blue-500 to-cyan-500",
      iconColor: "text-blue-500",
      gradient: "bg-gradient-to-br from-blue-500/20 to-cyan-500/20",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      desc: "Optimized performance for instant lead capture.",
      color: "from-purple-500 to-pink-500",
      iconColor: "text-purple-500",
      gradient: "bg-gradient-to-br from-purple-500/20 to-pink-500/20",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      desc: "Manage leads together in real time.",
      color: "from-orange-500 to-red-500",
      iconColor: "text-orange-500",
      gradient: "bg-gradient-to-br from-orange-500/20 to-red-500/20",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      desc: "Track conversions, ROI, and growth.",
      color: "from-green-500 to-emerald-500",
      iconColor: "text-green-500",
      gradient: "bg-gradient-to-br from-green-500/20 to-emerald-500/20",
    },
  ];

  const trusted = [
    { name: "Clutch", icon: Award },
    { name: "G2", icon: Star },
    { name: "Product Hunt", icon: Zap },
    { name: "Yelp", icon: Users },
    { name: "Affbank", icon: Globe },
  ];

  const handleCardClick = () => {
    if (!isSeparated) {
      setIsSeparated(true);
    }
  };

  const handleReset = () => {
    setIsSeparated(false);
    setActiveFeature(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-purple-50 to-pink-50 overflow-hidden">
      {/* Animated background elements */}
      <motion.div
        className="fixed inset-0 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
        <div className="absolute top-3/4 left-1/2 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-500" />
      </motion.div>

      {/* ================= HEADER ================= */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <motion.div
            variants={fadeBlurUp}
            initial="hidden"
            animate="visible"
            className="flex items-center space-x-3"
          >
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              <img
                src="/logo.png"
                alt="Mustache Leads"
                className="h-12 w-12 drop-shadow-lg"
              />
            </motion.div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-purple-500 to-purple-700 bg-clip-text text-transparent">
              Mustache Leads
            </span>
          </motion.div>

          <motion.div
            variants={fadeBlurUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
            className="hidden md:flex items-center space-x-6"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/publisher/signin"
                className="text-gray-700 hover:text-purple-600 transition-colors duration-300"
              >
                Sign in
              </Link>
            </motion.div>
            <motion.div
              variants={glowAnimation}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/advertiser/register"
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-8 py-3 rounded-full hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
              >
                <span>Get Leads</span>
                <Sparkles className="h-4 w-4" />
              </Link>
            </motion.div>

            <motion.div
              variants={glowAnimation}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/publisher/register"
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-8 py-3 rounded-full hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
              >
                <span>Get Offers</span>
                <Sparkles className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>

       
      </header>

      {/* ================= HERO ================= */}
      <main className="relative z-10">
        <section className="max-w-7xl mx-auto px-4 pt-24 pb-20 text-center">
          {/* Animated badge */}
          <motion.div
            variants={floatAnimation}
            initial="hidden"
            animate="visible"
            className="inline-block mb-4"
          >
            <motion.span
              variants={glassEffect}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-sm font-semibold text-purple-700 shadow-lg"
            >
              <Zap className="h-4 w-4 mr-2 text-purple-600" />
              Generate high-quality leads faster
            </motion.span>
          </motion.div>

          {/* Hero Heading with enhanced letter animation */}
          <motion.div
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="relative max-w-6xl mx-auto px-4"
          >
            <motion.h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mt-6 leading-tight">
              {splitTextToLetters("Turn Visitors Into ")}
              <br className="hidden sm:block" />
              <motion.span className="relative inline-block">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-purple-500 to-purple-800">
                  {splitTextToLetters("Paying Customers")}
                </span>
                <motion.span
                  className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-purple-800 blur-2xl opacity-30 -z-10"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.3 }}
                  transition={{ delay: 0.5, duration: 1 }}
                />
              </motion.span>
            </motion.h1>
          </motion.div>

          {/* Paragraph with enhanced word-by-word animation */}
          <motion.div
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-8 max-w-2xl mx-auto px-4"
          >
            <p className="text-lg sm:text-xl text-gray-600">
              {"Capture, nurture, and convert leads effortlessly. Grow your business with Mustache Leads.".split(
                " "
              ).map((word, i) => (
                <motion.span
                  key={i}
                  variants={letterAnimation}
                  className="inline-block mr-2 hover:text-purple-600 transition-colors duration-300 cursor-default"
                  whileHover={{ scale: 1.1 }}
                >
                  {word}
                </motion.span>
              ))}
            </p>
          </motion.div>

          {/* CTA Button with enhanced effects */}
          <motion.div
            variants={fadeBlurUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-12 flex flex-col items-center gap-4"
          >
            <motion.div
              variants={glowAnimation}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/advertiser/register"
                className="inline-flex items-center bg-gradient-to-r from-purple-600 to-purple-700 text-white px-12 py-5 rounded-full text-lg font-semibold hover:from-purple-700 hover:to-purple-800 shadow-xl hover:shadow-2xl transition-all duration-300 group"
              >
                <span className="mr-2">Get Leads Now</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="h-6 w-6" />
                </motion.span>
              </Link>
            </motion.div>

            {/* Get Offers Now button for Publishers */}
            <motion.div
              variants={glowAnimation}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/publisher/register"
                className="inline-flex items-center bg-white/20 backdrop-blur-xl text-purple-700 border-2 border-purple-600 px-12 py-4 rounded-full text-lg font-semibold hover:bg-purple-50 shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                <span className="mr-2">Get Offers Now</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="h-5 w-5" />
                </motion.span>
              </Link>
            </motion.div>

            {/* Floating sparks animation */}
            <motion.div
              className="flex space-x-2 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 bg-purple-500 rounded-full"
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ================= INTERACTIVE FEATURES SECTION ================= */}
        <section className="py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 relative z-10">
            {/* Section Header */}
            <motion.div
              variants={fadeBlurUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Everything you need to grow
                </span>
              </h2>
              
            </motion.div>

            {/* Interactive Cards Area */}
            <div className="relative min-h-[600px] flex items-center justify-center">
              {/* Combined Card (Initial State) */}
              <AnimatePresence mode="wait">
                {!isSeparated && (
                  <motion.div
                    key="combined"
                    variants={combinedContainer}
                    initial="initial"
                    animate="initial"
                    exit="separated"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <motion.div
                      variants={scaleIn}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      whileHover="hover"
                      whileTap="tap"
                      onClick={handleCardClick}
                      className="relative cursor-pointer group"
                    >
                      {/* Main Combined Card */}
                      <div className="relative w-[500px] h-[400px] bg-white/80 backdrop-blur-xl border-2 border-white/40 rounded-3xl shadow-2xl overflow-hidden">
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10" />
                        
                        {/* Card content */}
                        <div className="relative h-full flex flex-col items-center justify-center p-12 text-center">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="mb-8"
                          >
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-white/30 flex items-center justify-center">
                              <Layers className="h-12 w-12 text-purple-600" />
                            </div>
                          </motion.div>
                          
                          <h3 className="text-3xl font-bold text-gray-900 mb-4">
                            All Features Combined
                          </h3>
                          <p className="text-gray-600 text-lg mb-8">
                            Click to reveal our powerful tools for growing your business
                          </p>
                          
                          <motion.div
                            className="inline-flex items-center text-purple-600 font-semibold"
                            animate={{ x: [0, 10, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <span>Click to explore features</span>
                            <ChevronRight className="ml-2 h-5 w-5" />
                          </motion.div>
                        </div>

                        {/* Hover effect */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          initial={false}
                        />
                      </div>

                      {/* Floating elements */}
                      {features.map((feature, i) => (
                        <motion.div
                          key={i}
                          className={`absolute ${i === 0 ? 'top-4 left-4' : i === 1 ? 'top-4 right-4' : i === 2 ? 'bottom-4 left-4' : 'bottom-4 right-4'} w-16 h-16 rounded-2xl ${feature.gradient} border border-white/30 backdrop-blur-sm flex items-center justify-center`}
                          animate={{
                            y: [0, -20, 0],
                            rotate: [0, 360],
                          }}
                          transition={{
                            duration: 4 + i,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.5,
                          }}
                        >
                          <feature.icon className={`h-8 w-8 ${feature.iconColor}`} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Separated Cards */}
              <AnimatePresence>
                {isSeparated && (
                  <motion.div
                    key="separated"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full"
                  >
                    {features.map((feature, index) => (
                      <motion.div
                        key={index}
                        custom={index}
                        variants={combinedCard}
                        initial="initial"
                        animate="separated"
                        whileHover="hover"
                        whileTap="tap"
                        onHoverStart={() => setActiveFeature(index)}
                        onHoverEnd={() => setActiveFeature(null)}
                        className="relative cursor-pointer"
                      >
                        <div className="relative bg-white/80 backdrop-blur-xl border-2 border-white/40 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 h-full">
                          {/* Gradient background */}
                          <div className={`absolute inset-0 rounded-3xl ${feature.gradient} opacity-50`} />
                          
                          {/* Icon */}
                          <motion.div
                            className={`relative w-20 h-20 rounded-2xl mb-6 flex items-center justify-center ${feature.gradient} border border-white/30`}
                            animate={activeFeature === index ? { scale: 1.1 } : { scale: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            <feature.icon className={`h-10 w-10 ${feature.iconColor}`} />
                          </motion.div>

                          {/* Content */}
                          <h3 className="text-2xl font-bold text-gray-900 mb-4 relative">
                            {feature.title}
                          </h3>
                          <p className="text-gray-600 leading-relaxed">
                            {feature.desc}
                          </p>

                          {/* Hover indicator */}
                          <motion.div
                            className="absolute bottom-6 right-6"
                            animate={activeFeature === index ? { rotate: 360 } : { rotate: 0 }}
                            transition={{ duration: 0.5 }}
                          >
                            <ChevronRight className="h-6 w-6 text-gray-400" />
                          </motion.div>
                        </div>
                      </motion.div>
                    ))}

                    {/* Reset Button */}
                    <motion.button
                      onClick={handleReset}
                      className="absolute -top-16 right-0 bg-white/80 backdrop-blur-xl border-2 border-white/40 rounded-full px-6 py-3 text-gray-700 hover:text-purple-600 hover:border-purple-300 transition-all duration-300 flex items-center space-x-2 shadow-lg"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span>Reset Animation</span>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="h-4 w-4" />
                      </motion.div>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Instructions */}
            <motion.div
              variants={fadeBlurUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-center mt-16"
            >
              <p className="text-gray-600">
                <span className="font-semibold text-purple-600">Click the combined card</span> to reveal individual features, or <span className="font-semibold text-blue-600">hover over cards</span> to see them in detail
              </p>
            </motion.div>
          </div>
        </section>

        {/* ================= CTA ================= */}
        <section className="relative py-24 overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-800"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          />
          
          <div className="relative z-10 text-center px-4">
            <motion.h2
              variants={fadeBlurUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold text-white mb-6"
            >
              Ready to{" "}
              <span className="bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-transparent">
                transform
              </span>{" "}
              your leads?
            </motion.h2>

            <motion.p
              variants={fadeBlurUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-purple-100 text-xl mb-10"
            >
              Join thousands of businesses growing with Mustache Leads
            </motion.p>

            <motion.div
              variants={fadeBlurUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/register"
                className="inline-flex items-center bg-white/20 backdrop-blur-xl text-white px-12 py-5 rounded-full text-lg font-semibold hover:bg-white/30 border border-white/30 shadow-2xl hover:shadow-3xl transition-all duration-300 group"
              >
                <span className="mr-3">Start Free – Get Leads</span>
                <motion.div
                  animate={{ x: [0, 8, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <ArrowRight className="h-6 w-6" />
                </motion.div>
              </Link>
            </motion.div>

            {/* Animated sparkles */}
            <motion.div
              className="flex justify-center space-x-1 mt-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-yellow-300 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-white/10 backdrop-blur-md border-t border-white/20 relative">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.div variants={fadeBlurUp}>
              <div className="flex items-center space-x-3 mb-4">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <img
                    src="/logo.png"
                    alt="Mustache Leads"
                    className="h-12 w-12"
                  />
                </motion.div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                  Mustache Leads
                </h3>
              </div>
              <p className="text-gray-600">
                Helping businesses capture and convert leads efficiently.
              </p>
            </motion.div>

            <motion.div variants={fadeBlurUp}>
              <h4 className="font-semibold text-gray-900 mb-4">Contact</h4>
              <p className="text-gray-600 hover:text-purple-600 transition-colors duration-300 cursor-pointer">
                contact@mustacheleads.com
              </p>
              <p className="text-gray-600 hover:text-purple-600 transition-colors duration-300 cursor-pointer">
                +91 90000 00000
              </p>
              <p className="text-gray-600">Hyderabad, India</p>
            </motion.div>

            <motion.div variants={fadeBlurUp}>
              <h4 className="font-semibold text-gray-900 mb-4">Follow Us</h4>
              <div className="flex space-x-4">
                {[
                  { Icon: Linkedin, color: "text-blue-600" },
                  { Icon: Facebook, color: "text-blue-800" },
                  { Icon: Instagram, color: "text-pink-600" },
                ].map((social, i) => (
                  <motion.a
                    key={i}
                    href="#"
                    className={`${social.color} bg-white/50 backdrop-blur-sm p-3 rounded-full hover:bg-white/70 transition-all duration-300`}
                    whileHover={{ scale: 1.1, rotate: 360 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <social.Icon className="h-5 w-5" />
                  </motion.a>
                ))}
              </div>
            </motion.div>

            <motion.div variants={fadeBlurUp}>
              <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
              <Link
                to="/about-us"
                className="block text-gray-600 hover:text-purple-600 transition-colors duration-300 mb-2"
              >
                About Us
              </Link>
              <Link
                to="/terms-and-conditions"
                className="block text-gray-600 hover:text-purple-600 transition-colors duration-300 mb-2"
              >
                Terms & Conditions
              </Link>
              <Link
                to="/privacy-policy"
                className="block text-gray-600 hover:text-purple-600 transition-colors duration-300"
              >
                Privacy Policy
              </Link>
            </motion.div>
          </motion.div>

          {/* Trusted & Listed On */}
          <motion.div
            variants={fadeBlurUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-12 border-t border-gray-200 pt-8 text-center"
          >
            <motion.p
              className="text-sm uppercase tracking-wide text-gray-500 mb-6"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Trusted & Listed On
            </motion.p>

            <div className="flex flex-wrap justify-center gap-4">
              {trusted.map((item, i) => (
                <motion.div
                  key={i}
                  variants={scaleIn}
                  whileHover={{
                    y: -6,
                    scale: 1.05,
                    transition: { duration: 0.2 },
                  }}
                  className="flex items-center space-x-2 px-6 py-3 rounded-full bg-white/40 backdrop-blur-md border border-white/30 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <item.icon className="h-5 w-5 text-purple-600" />
                  </motion.div>
                  <span className="text-sm font-medium text-gray-700">
                    {item.name}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={fadeBlurUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-8 text-center text-gray-500"
          >
            © {new Date().getFullYear()} Mustache Leads. All rights reserved.
          </motion.div>
        </div>
      </footer>

      {/* Floating particles background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-purple-400 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>
    </div>
  );
}