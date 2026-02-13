
import React, { useState, useEffect, useRef } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    parseISO
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import '../../styles/components/ui/DatePicker.css';

interface DatePickerProps {
    value: string; // ISO string 'YYYY-MM-DD'
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    placeholder = "Select date",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Ref for click outside detection
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize currentMonth based on value if present
    useEffect(() => {
        if (value) {
            try {
                setCurrentMonth(parseISO(value));
            } catch (e) {
                // invalid date, ignore
            }
        }
    }, [isOpen]); // Reset when opening if value changed externally, or initially

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const handleDayClick = (day: Date) => {
        onChange(format(day, 'yyyy-MM-dd'));
        setIsOpen(false);
    };

    const clearDate = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
    };

    // Generate calendar days
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate
    });

    const displayValue = value ? format(parseISO(value), 'PPP') : ''; // e.g., 'Feb 6, 2026'

    return (
        <div className={`date-picker-container ${className}`} ref={containerRef}>
            <div
                className="date-picker-trigger"
                onClick={() => setIsOpen(!isOpen)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen) }}
            >
                <CalendarIcon size={16} className="icon" />
                {value ? (
                    <span className="date-picker-value">{displayValue}</span>
                ) : (
                    <span className="date-picker-placeholder">{placeholder}</span>
                )}
                {value && (
                    <div
                        role="button"
                        onClick={clearDate}
                        className="clear-btn"
                        style={{ marginLeft: 'auto', display: 'flex', cursor: 'pointer', opacity: 0.6 }}
                    >
                        <X size={14} />
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="date-picker-calendar">
                    <div className="calendar-header">
                        <button type="button" className="calendar-nav-btn" onClick={(e) => { e.stopPropagation(); prevMonth(); }}>
                            <ChevronLeft size={16} />
                        </button>
                        <span className="calendar-title">
                            {format(currentMonth, 'MMMM yyyy')}
                        </span>
                        <button type="button" className="calendar-nav-btn" onClick={(e) => { e.stopPropagation(); nextMonth(); }}>
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="calendar-grid">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="calendar-day-header">{day}</div>
                        ))}

                        {days.map((day, idx) => {
                            const isSelected = value ? isSameDay(day, parseISO(value)) : false;
                            const isInternalMonth = isSameMonth(day, monthStart);

                            return (
                                <button
                                    key={day.toString()}
                                    type="button"
                                    onClick={() => handleDayClick(day)}
                                    className={`calendar-day 
                    ${!isInternalMonth ? 'outside-month' : ''} 
                    ${isSelected ? 'selected' : ''} 
                    ${isToday(day) ? 'today' : ''}
                  `}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
