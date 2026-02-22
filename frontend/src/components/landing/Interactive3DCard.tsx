import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { X, Maximize2 } from 'lucide-react';

interface Interactive3DCardProps {
    fileName: string;
    title: string;
}

export const Interactive3DCard: React.FC<Interactive3DCardProps> = ({ fileName, title }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Mouse tracking for inline card
    const inlineRef = useRef<HTMLDivElement>(null);
    const inlineX = useMotionValue(0);
    const inlineY = useMotionValue(0);

    const inlineSpringConfig = { damping: 15, stiffness: 150, mass: 0.5 };
    const inlineRotateX = useSpring(useTransform(inlineY, [-0.5, 0.5], [15, -15]), inlineSpringConfig);
    const inlineRotateY = useSpring(useTransform(inlineX, [-0.5, 0.5], [-15, 15]), inlineSpringConfig);
    const inlineGlowOpacity = useSpring(useTransform(inlineY, [-0.5, 0.5], [0, 0.5]), inlineSpringConfig);

    const handleInlineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!inlineRef.current) return;
        const rect = inlineRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        inlineX.set(x);
        inlineY.set(y);
    };

    const handleInlineMouseLeave = () => {
        inlineX.set(0);
        inlineY.set(0);
    };

    // Mouse tracking for modal card
    const modalRef = useRef<HTMLDivElement>(null);
    const modalX = useMotionValue(0);
    const modalY = useMotionValue(0);

    const modalSpringConfig = { damping: 20, stiffness: 100, mass: 1 };
    const modalRotateX = useSpring(useTransform(modalY, [-0.5, 0.5], [8, -8]), modalSpringConfig);
    const modalRotateY = useSpring(useTransform(modalX, [-0.5, 0.5], [-8, 8]), modalSpringConfig);

    const handleModalMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!modalRef.current) return;
        const rect = modalRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        modalX.set(x);
        modalY.set(y);
    };

    const handleModalMouseLeave = () => {
        modalX.set(0);
        modalY.set(0);
    };

    return (
        <>
            <div
                className="screen-frame interactive-frame group cursor-pointer"
                ref={inlineRef}
                onMouseMove={handleInlineMouseMove}
                onMouseLeave={handleInlineMouseLeave}
                onClick={() => setIsOpen(true)}
            >
                {/* Glow overlay effect */}
                <motion.div
                    className="absolute inset-0 z-10 bg-gradient-to-tr from-transparent via-white/5 to-white/20 pointer-events-none rounded-lg"
                    style={{ opacity: inlineGlowOpacity }}
                />

                {/* Floating maximize icon */}
                <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg">
                    <div className="bg-[var(--bg-primary)] p-3 rounded-full shadow-2xl flex items-center gap-2">
                        <Maximize2 size={24} className="text-[var(--brand-accent)]" />
                        <span className="font-medium">View Full Screen</span>
                    </div>
                </div>

                <motion.div
                    style={{
                        rotateX: inlineRotateX,
                        rotateY: inlineRotateY,
                        transformStyle: "preserve-3d"
                    }}
                    className="w-full h-full relative z-0"
                >
                    <img
                        src={`/${fileName}`}
                        alt={title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300"
                        onError={(event) => {
                            const target = event.currentTarget;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling as HTMLElement | null;
                            if (placeholder) {
                                placeholder.style.display = 'flex';
                            }
                        }}
                    />
                    <div className="screen-placeholder" style={{ display: 'none' }}>
                        Add <strong>{fileName}</strong> to <code>frontend/public</code>
                    </div>
                </motion.div>
            </div>

            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
                            onClick={() => setIsOpen(false)}
                        >
                            <button
                                className="absolute top-6 right-6 z-[9999999] bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors"
                                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                            >
                                <X size={24} />
                            </button>

                            <motion.div
                                ref={modalRef}
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="relative w-full max-w-[90vw] max-h-[90vh] flex items-center justify-center"
                                style={{ perspective: 1500 }}
                                onMouseMove={handleModalMouseMove}
                                onMouseLeave={handleModalMouseLeave}
                                onClick={(e) => e.stopPropagation()} // Prevent clicking image from closing
                            >
                                <motion.img
                                    src={`/${fileName}`}
                                    alt={title}
                                    className="w-full h-auto max-h-[90vh] object-contain rounded-xl shadow-[0_0_100px_rgba(59,130,246,0.3)] ring-1 ring-white/10"
                                    style={{
                                        rotateX: modalRotateX,
                                        rotateY: modalRotateY,
                                        transformStyle: 'preserve-3d'
                                    }}
                                />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};
