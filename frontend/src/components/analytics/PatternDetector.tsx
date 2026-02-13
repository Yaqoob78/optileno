// frontend/src/components/analytics/PatternDetector.tsx
import React, { useState, useEffect } from 'react';
import {
  Brain,
  TrendingUp,
  Zap,
  AlertTriangle,
  Heart,
  Clock,
  Loader,
  Sparkles
} from 'lucide-react';
import { usePatternDetector, Pattern } from '../../hooks/usePatternDetector';
import '../../styles/components/pattern-detector.css';

const PatternDetector: React.FC = () => {
  const { patterns, dataQuality, isLoading, error } = usePatternDetector();
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotating motivating messages for when no patterns are available
  const motivatingMessages = [
    {
      icon: '🤖',
      title: 'AI is Analyzing',
      message: 'Leno is currently analyzing your patterns. Stay tuned for insights!'
    },
    {
      icon: '✨',
      title: 'Finding Patterns',
      message: 'AI is discovering meaningful patterns in your workflow. Check back soon!'
    },
    {
      icon: '🔍',
      title: 'Deep Analysis',
      message: 'Your AI is working hard to find behavioral insights. Great things take time!'
    },
    {
      icon: '🌱',
      title: 'Growing Intelligence',
      message: 'As you work, patterns emerge. Keep building your journey!'
    },
    {
      icon: '🎯',
      title: 'Learning Your Style',
      message: 'Leno is learning your unique work patterns. More data = better insights!'
    },
    {
      icon: '💡',
      title: 'Insights Pending',
      message: 'AI will surface patterns when statistically significant trends emerge!'
    },
    {
      icon: '🚀',
      title: 'Building Your Profile',
      message: "You're creating great data! Patterns will appear as trends become clear."
    }
  ];

  // Rotate messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % motivatingMessages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [motivatingMessages.length]);

  // Category icons and colors
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'behavioral_cycle':
        return <TrendingUp size={20} />;
      case 'trigger_response':
        return <Zap size={20} />;
      case 'bottleneck':
        return <AlertTriangle size={20} />;
      case 'sentiment_trend':
        return <Heart size={20} />;
      case 'peak_performance':
        return <Clock size={20} />;
      default:
        return <Brain size={20} />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'behavioral_cycle':
        return '#10b981'; // Green
      case 'trigger_response':
        return '#f59e0b'; // Orange
      case 'bottleneck':
        return '#ef4444'; // Red
      case 'sentiment_trend':
        return '#ec4899'; // Pink
      case 'peak_performance':
        return '#8b5cf6'; // Purple
      default:
        return '#6366f1'; // Indigo
    }
  };

  const getConfidenceBadgeStyle = (confidence: number) => {
    if (confidence >= 90) {
      return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', label: 'Very High' };
    } else if (confidence >= 80) {
      return { bg: 'rgba(124, 58, 237, 0.1)', text: '#7c3aed', label: 'High' };
    } else {
      return { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', label: 'Moderate' };
    }
  };

  // Loading state
  if (isLoading && !patterns.length) {
    return (
      <div className="pattern-detector-loading">
        <Loader className="pattern-loader-icon" size={32} />
        <p>Analyzing your patterns...</p>
      </div>
    );
  }

  // Error state - now motivating instead of demotivating
  if (error) {
    const currentMessage = motivatingMessages[messageIndex];
    return (
      <div className="pattern-detector-empty">
        <div className="empty-icon motivating-icon">
          <span className="message-emoji">{currentMessage.icon}</span>
        </div>
        <h4>{currentMessage.title}</h4>
        <p>{currentMessage.message}</p>
        <div className="message-indicator">
          {motivatingMessages.map((_, idx) => (
            <span
              key={idx}
              className={`indicator-dot ${idx === messageIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Insufficient data state
  if (dataQuality && !dataQuality.sufficient_data) {
    return (
      <div className="pattern-detector-insufficient">
        <div className="insufficient-icon">
          <Brain size={40} style={{ opacity: 0.3 }} />
        </div>
        <h4>Collecting Data...</h4>
        <p>
          {dataQuality.days_until_ready} days until pattern analysis
          <br />
          <span className="insufficient-detail">
            (Need 30 days minimum • Currently: {dataQuality.days_analyzed} days)
          </span>
        </p>
        <div className="insufficient-progress">
          <div
            className="insufficient-progress-bar"
            style={{
              width: `${(dataQuality.days_analyzed / 30) * 100}%`
            }}
          />
        </div>
      </div>
    );
  }

  // No patterns detected - show rotating motivating messages
  if (!patterns || patterns.length === 0) {
    const currentMessage = motivatingMessages[messageIndex];
    return (
      <div className="pattern-detector-empty">
        <div className="empty-icon motivating-icon">
          <span className="message-emoji">{currentMessage.icon}</span>
        </div>
        <h4>{currentMessage.title}</h4>
        <p>{currentMessage.message}</p>
        <div className="message-indicator">
          {motivatingMessages.map((_, idx) => (
            <span
              key={idx}
              className={`indicator-dot ${idx === messageIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Patterns found!
  return (
    <div className="pattern-detector-container">
      <div className="pattern-detector-header">
        <div className="pattern-count">
          <Sparkles size={16} />
          <span>{patterns.length} pattern{patterns.length > 1 ? 's' : ''} detected</span>
        </div>
      </div>

      <div className="patterns-list">
        {patterns.map((pattern: Pattern) => {
          const categoryColor = getCategoryColor(pattern.category);
          const confidenceStyle = getConfidenceBadgeStyle(pattern.confidence);

          return (
            <div key={pattern.id} className="pattern-card">
              {/* Header */}
              <div className="pattern-card-header">
                <div
                  className="pattern-category-icon"
                  style={{ color: categoryColor }}
                >
                  {getCategoryIcon(pattern.category)}
                </div>
                <div className="pattern-title-section">
                  <h5 className="pattern-title">{pattern.title}</h5>
                  <div
                    className="pattern-confidence-badge"
                    style={{
                      background: confidenceStyle.bg,
                      color: confidenceStyle.text
                    }}
                  >
                    {Math.round(pattern.confidence)}% {confidenceStyle.label}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="pattern-description">{pattern.description}</p>

              {/* Actionable Insight */}
              <div className="pattern-insight">
                <div className="insight-icon">💡</div>
                <div className="insight-text">{pattern.actionable_insight}</div>
              </div>

              {/* Evidence */}
              <div className="pattern-evidence">
                {pattern.evidence.map((item, idx) => (
                  <div key={idx} className="evidence-item">
                    <span className="evidence-check">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {dataQuality && (
        <div className="pattern-detector-footer">
          <span className="footer-text">
            Based on {dataQuality.days_analyzed} days of your journey
          </span>
        </div>
      )}
    </div>
  );
};

export default PatternDetector;