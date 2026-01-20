import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { Day, Location } from '../types';
import { Calendar, Check } from 'lucide-react';

interface DayAssignmentModalProps {
    show: boolean;
    location: Location | null;
    days: Day[];
    onSave: (locationId: string, dayIds: string[]) => void;
    onClose: () => void;
}

// Format date for display
const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

export function DayAssignmentModal({ show, location, days, onSave, onClose }: DayAssignmentModalProps) {
    const [selectedDays, setSelectedDays] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        if (location) {
            setSelectedDays(new Set(location.dayIds));
        }
    }, [location]);

    const toggleDay = (dayId: string) => {
        setSelectedDays(prev => {
            const next = new Set(prev);
            if (next.has(dayId)) {
                next.delete(dayId);
            } else {
                next.add(dayId);
            }
            return next;
        });
    };

    const handleSave = () => {
        if (location) {
            onSave(location.id, Array.from(selectedDays));
        }
    };

    const getDayNumber = (dateStr: string) => {
        if (days.length === 0) return 1;
        const startDate = days[0].date;
        const date = new Date(dateStr);
        const start = new Date(startDate);
        const diffTime = date.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1;
    };

    return (
        <Modal show={show} onHide={onClose} centered>
            <Modal.Header closeButton>
                <Modal.Title className="fs-5">
                    <Calendar size={18} className="me-2" />
                    Assign to Days
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {location && (
                    <>
                        <div className="mb-3 p-2 bg-light rounded">
                            <div className="small text-muted">Location</div>
                            <div className="fw-bold">{location.name}</div>
                        </div>

                        <div className="small text-muted mb-2">Select days this location spans:</div>

                        <div className="day-selection-list">
                            {days.map((day) => {
                                const isSelected = selectedDays.has(day.id);
                                const dayNum = getDayNumber(day.date);

                                return (
                                    <div
                                        key={day.id}
                                        className={`day-selection-item d-flex align-items-center p-2 mb-1 rounded cursor-pointer ${isSelected ? 'bg-primary-subtle border-primary' : 'bg-light'}`}
                                        onClick={() => toggleDay(day.id)}
                                        style={{ cursor: 'pointer', border: '1px solid transparent' }}
                                    >
                                        <div className={`check-box me-2 ${isSelected ? 'checked' : ''}`}>
                                            {isSelected && <Check size={14} />}
                                        </div>
                                        <div className="flex-grow-1">
                                            <strong>Day {dayNum}</strong>
                                            <span className="text-muted ms-2 small">{formatDate(day.date)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {days.length === 0 && (
                            <div className="text-muted text-center py-3">
                                No days available. Please set trip dates first.
                            </div>
                        )}
                    </>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave} disabled={days.length === 0}>
                    Save Assignment
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
