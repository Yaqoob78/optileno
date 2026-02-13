
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  Zap,
  CheckCircle,
  Activity,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMoodTracker } from '../../hooks/useMoodTracker';
import { useChatStore } from '../../stores/chat.store';
import '../../styles/components/analytics/MoodTracker.css';

// Expanded emoji sets for dynamic display
const MOOD_VARIANTS: Record<string, string[]> = {
  ENERGETIC: ["⚡", "🚀", "💪", "🔥", "🦁"],
  PRODUCTIVE: ["📈", "✅", "🎯", "🧠", "✨"],
  CONTENT: ["😊", "🙂", "☺️", "😌", "☕"],
  NEUTRAL: ["😐", "😶", "🤔", "🧐", "☁️"],
  TIRED: ["😴", "💤", "😪", "🥱", "🌑"],
  STRESSED: ["😰", "😥", "🌪️", "😫", "🤯"],
  SAD: ["😔", "😢", "💔", "🌧️", "😿"],
  FRUSTRATED: ["😤", "👺", "😠", "🤬", "💢"]
};

export default function MoodTracker() {
  const { moodData, isLoading, checkIn } = useMoodTracker();
  const [isExpanded, setIsExpanded] = useState(false);
  const [emojiIndex, setEmojiIndex] = useState(0);
  const { addMessage, createConversation, setActiveConversation } = useChatStore();
  const navigate = useNavigate();

  // Cycle emojis to make it feel alive — pause when tab is hidden
  useEffect(() => {
    if (!moodData) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const startCycling = () => {
      if (!interval) {
        interval = setInterval(() => {
          setEmojiIndex(prev => prev + 1);
        }, 3000);
      }
    };

    const stopCycling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopCycling();
      } else {
        startCycling();
      }
    };

    startCycling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopCycling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [moodData]);

  const handleTalkAboutMood = async () => {
    if (!moodData) return;

    // Create prompt with context
    const contextFactors = [];
    if (moodData.breakdown.planner_engagement > 50) contextFactors.push("high productivity");
    if (moodData.breakdown.chat_sentiment > 60) contextFactors.push("positive conversations");
    if (moodData.breakdown.productivity_flow > 70) contextFactors.push("good work flow");

    // Create new conversation specialized for coaching/therapy
    const conversation = createConversation(`Mood Check-in: ${moodData.label}`, "therapist");
    setActiveConversation(conversation.id);

    // Initial user message to kick it off
    addMessage({
      role: 'user',
      content: `I'm feeling ${moodData.label} right now. ` +
        `${contextFactors.length > 0 ? `I think it's because of ${contextFactors.join(', ')}.` : ''} ` +
        `Can we talk about how to ${moodData.score < 50 ? 'improve' : 'maintain'} this?`
    });

    // Log the check-in
    await checkIn(moodData.category, "Started chat session");

    // Navigate to chat
    navigate('/chat');
  };

  if (isLoading && !moodData) {
    return (
      <div className="mood-tracker-container loading">
        <div className="mood-loading-content">
          <Activity className="spinning" size={24} />
          <span>Synchronizing emotional telemetry...</span>
        </div>
      </div>
    );
  }

  if (!moodData) return null;

  const moodClass = `mood-${moodData.category.toLowerCase()}`;

  // Get current emoji variants
  const currentVariants = MOOD_VARIANTS[moodData.category] || [moodData.emoji];
  const currentEmoji = currentVariants[emojiIndex % currentVariants.length];

  return (
    <div className={`mood-tracker-container ${moodClass}`}>
      <div className="glow-effect" />

      {/* Header */}
      <div className="mood-header">
        <div className="header-icon">
          <Activity size={18} />
        </div>
        <div>
          <h3>Emotional Intelligence</h3>
          <p>Real-time Bio-metric Sweep</p>
        </div>
      </div>

      {/* Main Display */}
      <div className="mood-main-display">
        <div className="emoji-display">
          <div className="emoji-circle">
            <AnimatePresence mode="wait">
              <motion.span
                key={`${moodData.category}-${emojiIndex}`}
                className="mood-emoji"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: -10 }}
                transition={{
                  duration: 0.4,
                  type: "spring",
                  stiffness: 200,
                  damping: 15
                }}
              >
                {currentEmoji}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div className="mood-text">
          <h4 className="mood-status-label">Feeling {moodData.label}</h4>
          <blockquote className="mood-ai-hint">
            "{moodData.hint}"
          </blockquote>
        </div>
      </div>

      {/* Insights Panel */}
      <div className={`insights-panel ${isExpanded ? 'expanded' : ''}`}>
        <button
          className="insights-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="toggle-title">
            <Sparkles size={14} />
            <span>Behavioral Drivers</span>
          </div>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <div className="insights-content">
          <BreakdownItem
            label="Sentiment"
            value={moodData.breakdown.chat_sentiment}
            icon={<MessageSquare size={12} />}
          />
          <BreakdownItem
            label="Planner"
            value={moodData.breakdown.planner_engagement}
            icon={<CheckCircle size={12} />}
          />
          <BreakdownItem
            label="Efficiency"
            value={moodData.breakdown.productivity_flow}
            icon={<Zap size={12} />}
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="mood-footer">
        <button className="talk-btn" onClick={handleTalkAboutMood}>
          <MessageSquare size={18} />
          Talk about this Mood
          <ArrowRight size={16} className="arrow-icon" />
        </button>
      </div>
    </div>
  );
}

function BreakdownItem({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="breakdown-item">
      <div className="breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon}
        {label}
      </div>
      <div className="breakdown-bar-bg">
        <div
          className="breakdown-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}