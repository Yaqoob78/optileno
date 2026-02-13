import React, { useState, useEffect, useRef } from 'react';
import { Brain, Play, Pause, X, Coffee, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import '../../styles/components/planner/DeepWorkBlock.css';
import { usePlanner } from '../../hooks/usePlanner';

interface DeepWorkBlockProps {
  currentTime: Date;
}

interface DeepWorkSession {
  id: string;
  date: Date;
  duration: number; // in minutes
  completed: boolean;
  breaksTaken: number;
}

export default function DeepWorkBlock({ currentTime }: DeepWorkBlockProps) {
  const { goals, startDeepWork, completeDeepWork } = usePlanner();
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hours, setHours] = useState(2);
  const [minutes, setMinutes] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [totalDuration, setTotalDuration] = useState(0); // in seconds
  const [progress, setProgress] = useState(0);

  // Break Logic State
  const [breakSchedule, setBreakSchedule] = useState<number[]>([]); // Array of break times in seconds (elapsed time)
  const [isBreakPromptOpen, setIsBreakPromptOpen] = useState(false); // Validating if user wants a break
  const [isBreakActive, setIsBreakActive] = useState(false); // Actually ON a break
  const [breakTimer, setBreakTimer] = useState(0); // Seconds left in break
  const [completedSessions, setCompletedSessions] = useState<DeepWorkSession[]>([]);

  const intervalRef = useRef<any>(null);
  const breakIntervalRef = useRef<any>(null);

  // Load completed sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('deepWorkSessions');
    if (savedSessions) {
      try {
        const sessions = JSON.parse(savedSessions);
        const parsedSessions = sessions.map((session: any) => ({
          ...session,
          date: new Date(session.date)
        }));
        setCompletedSessions(parsedSessions);
      } catch (error) {
        console.error('Error loading sessions:', error);
      }
    }
  }, []);

  const handleStartSession = async () => {
    const totalMinutes = (hours * 60) + minutes;

    // Constraint: Min 1 hour (60 mins), Max 12 hours (720 mins)
    if (totalMinutes < 60) {
      alert('Deep Work sessions must be at least 1 hour to be effective.');
      return;
    }
    if (totalMinutes > 720) {
      alert('Deep Work sessions cannot exceed 12 hours.');
      return;
    }

    // Generate Break Schedule
    // For each hour, schedule a random break between minute 30 and 50
    const newBreakSchedule: number[] = [];
    const totalHours = Math.ceil(totalMinutes / 60);

    for (let i = 0; i < totalHours; i++) {
      // Random minute between 30 and 50
      const randomMinute = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
      // Convert to absolute elapsed seconds: (Hour Index * 60min + RandomMin) * 60s
      // Ensure strictly BEFORE the end of the session
      const breakTimeSeconds = (i * 60 + randomMinute) * 60;

      if (breakTimeSeconds < totalMinutes * 60) {
        newBreakSchedule.push(breakTimeSeconds);
      }
    }
    setBreakSchedule(newBreakSchedule.sort((a, b) => a - b));

    // Call API to start session
    try {
      const result = await startDeepWork({
        plannedDurationMinutes: totalMinutes,
        goalId: selectedGoalId || undefined
      });

      if (result.success && result.session) {
        setCurrentSessionId(result.session.id);
      } else {
        console.error('Failed to start backend session:', result.error);
      }
    } catch (e) {
      console.error('Error starting session:', e);
    }

    const durationSeconds = totalMinutes * 60;
    setTotalDuration(durationSeconds);
    setTimeLeft(durationSeconds);
    setProgress(0);
    setIsRunning(true);
    setIsModalOpen(false);
    setIsBreakPromptOpen(false);
    setIsBreakActive(false);

    startTimer();
  };

  const startTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          finishSession();
          return 0;
        }

        const newTime = prev - 1;
        const elapsed = totalDuration - newTime;

        // Progress Calculation
        const newProgress = (elapsed / totalDuration) * 100;
        setProgress(newProgress);

        // Check for Break
        // We check if 'elapsed' roughly matches any scheduled break time
        // Using a range of 1s to avoid missing it due to timing jitters
        if (breakSchedule.some(bt => Math.abs(bt - elapsed) < 1)) {
          triggerBreakPrompt();
        }

        return newTime;
      });
    }, 1000);
  };

  const triggerBreakPrompt = () => {
    pauseTimer();
    setIsBreakPromptOpen(true);
  };

  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsRunning(false);
    }
  };

  const resumeTimer = () => {
    if (!isRunning && !isBreakActive && !isBreakPromptOpen) {
      setIsRunning(true);
      startTimer();
    }
  };

  // User selects a break duration
  const startBreak = (minutes: number) => {
    setIsBreakPromptOpen(false);
    setIsBreakActive(true);
    setBreakTimer(minutes * 60);

    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);

    breakIntervalRef.current = setInterval(() => {
      setBreakTimer(prev => {
        if (prev <= 0) {
          endBreak();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endBreak = () => {
    if (breakIntervalRef.current) {
      clearInterval(breakIntervalRef.current);
      breakIntervalRef.current = null;
    }
    setIsBreakActive(false);
    alert("Break is over! Time to focus again.");
    resumeTimer();
  };

  const skipBreak = () => {
    setIsBreakPromptOpen(false);
    resumeTimer();
  };

  const finishSession = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);

    intervalRef.current = null;
    breakIntervalRef.current = null;

    setIsRunning(false);

    const usedDuration = Math.round((totalDuration - timeLeft) / 60);

    if (currentSessionId) {
      await completeDeepWork(usedDuration);
    }

    const newSession: DeepWorkSession = {
      id: Date.now().toString(),
      date: new Date(),
      duration: usedDuration,
      completed: true,
      breaksTaken: 0 // Simplification
    };

    const updatedSessions = [...completedSessions, newSession];
    setCompletedSessions(updatedSessions);
    localStorage.setItem('deepWorkSessions', JSON.stringify(updatedSessions));

    setTimeLeft(0);
    setProgress(100);
    setIsBreakActive(false);
    setIsBreakPromptOpen(false);
    setCurrentSessionId(null);
  };

  const cancelSession = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);

    setIsRunning(false);
    setTimeLeft(0);
    setProgress(0);
    setIsBreakActive(false);
    setIsBreakPromptOpen(false);
    setIsModalOpen(false);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="deepwork-block">
      <div className="block-header">
        <div className="icon-title">
          <div className="icon-wrapper">
            <Brain size={20} />
          </div>
          <h3>Deep Work Timer</h3>
        </div>
        <div className="session-stats">
          <span>{completedSessions.length} sessions completed</span>
        </div>
      </div>

      {/* Timer Display */}
      <div className="timer-container">
        {!isRunning && timeLeft === 0 && !isBreakActive && !isBreakPromptOpen ? (
          <div className="timer-inactive">
            <Clock size={48} className="timer-icon" />
            <p>Ready for focused work?</p>
            <button
              className="deepwork-btn primary start-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <Play size={16} />
              Start Deep Work Session
            </button>
          </div>
        ) : (
          <div className="timer-active">
            {isBreakActive ? (
              <div className="timer-display break-mode">
                <h3 style={{ color: '#4ade80', marginBottom: '1rem' }}>Relaxing...</h3>
                <div className="time-left" style={{ color: '#4ade80', borderColor: '#4ade80' }}>
                  {Math.floor(breakTimer / 60)}:{String(breakTimer % 60).padStart(2, '0')}
                </div>
                <p style={{ color: '#cbd5e1' }}>Take a deep breath.</p>
                <button className="timer-btn" onClick={endBreak} style={{ marginTop: '1rem' }}>
                  End Break Early
                </button>
              </div>
            ) : (
              <>
                <div className="timer-display">
                  <div className="time-left">{formatTime(timeLeft)}</div>
                  <div className="progress-label">{progress.toFixed(1)}% Complete</div>
                </div>

                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

                <div className="timer-controls">
                  {isRunning ? (
                    <button className="timer-btn" onClick={pauseTimer}>
                      <Pause size={16} />
                      Pause
                    </button>
                  ) : (
                    <button className="timer-btn" onClick={resumeTimer} disabled={isBreakPromptOpen}>
                      <Play size={16} />
                      Resume
                    </button>
                  )}
                  <button className="timer-btn cancel" onClick={cancelSession}>
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Break Prompt Modal */}
      {isBreakPromptOpen && (
        <div className="break-modal-overlay">
          <div className="break-modal">
            <div className="break-header">
              <Coffee size={24} color="#f59e0b" />
              <h3>Break Incoming!</h3>
            </div>
            <p>You've been focused for a while. Want to take a quick break?</p>
            <div className="break-options">
              <button className="break-option" onClick={() => startBreak(2)}>
                2 min
              </button>
              <button className="break-option" onClick={() => startBreak(5)}>
                5 min
              </button>
              <button className="break-option" onClick={() => startBreak(10)}>
                10 min
              </button>
            </div>
            <div className="break-controls">
              <button className="skip-break" onClick={skipBreak}>
                Skip Break & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Setup Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content deepwork-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <div className="modal-icon">
                  <Brain size={20} />
                </div>
                <h3>Deep Work Session</h3>
              </div>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>
                  <Clock size={16} style={{ marginRight: '8px' }} />
                  Duration
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Hours</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      className="task-input"
                      value={hours}
                      onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="5"
                      className="task-input"
                      value={minutes}
                      onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}
                    />
                  </div>
                </div>
                <p style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginTop: '12px',
                  background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #6366f1, #a855f7)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  color: 'transparent'
                }}>
                  ✨ Recommended: 2-4 hours for deep focus ✨
                </p>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>
                  Total Focus Time: <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{hours}h {minutes}m</span>
                </p>
              </div>

              <div className="form-group">
                <label>
                  <Brain size={16} style={{ marginRight: '8px' }} />
                  Focus Goal (Optional)
                </label>
                <select
                  className="task-select"
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                >
                  <option value="">No specific goal</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="modal-btn submit" onClick={handleStartSession}>
                <Play size={16} />
                <span>Start Focus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <div className="completed-sessions">
          <h4>Recent Sessions</h4>
          <div className="sessions-list">
            {completedSessions.slice(-3).map((session) => (
              <div key={session.id} className="session-item">
                <CheckCircle size={14} />
                <span>
                  {session.duration} min • {session.date.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}