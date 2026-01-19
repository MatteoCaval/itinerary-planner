import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onDateRangeChange: (startDate: string, endDate: string) => void;
}

export function DateRangePicker({ startDate, endDate, onDateRangeChange }: DateRangePickerProps) {
    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStart = e.target.value;
        // If end date is before new start, adjust it
        const adjustedEnd = endDate && newStart > endDate ? newStart : endDate;
        onDateRangeChange(newStart, adjustedEnd);
    };

    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEnd = e.target.value;
        // If start date is after new end, adjust it
        const adjustedStart = startDate && newEnd < startDate ? newEnd : startDate;
        onDateRangeChange(adjustedStart, newEnd);
    };

    // Calculate number of days
    const getDayCount = () => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 0;
    };

    const dayCount = getDayCount();

    return (
        <div className="date-range-picker mb-3">
            <div className="d-flex align-items-center gap-2 mb-2">
                <Calendar size={18} className="text-primary" />
                <strong>Trip Dates</strong>
                {dayCount > 0 && (
                    <span className="badge bg-primary ms-auto">{dayCount} day{dayCount !== 1 ? 's' : ''}</span>
                )}
            </div>
            <Row className="g-2">
                <Col xs={6}>
                    <Form.Group>
                        <Form.Label className="small text-muted mb-1">Start</Form.Label>
                        <Form.Control
                            type="date"
                            size="sm"
                            value={startDate}
                            onChange={handleStartChange}
                        />
                    </Form.Group>
                </Col>
                <Col xs={6}>
                    <Form.Group>
                        <Form.Label className="small text-muted mb-1">End</Form.Label>
                        <Form.Control
                            type="date"
                            size="sm"
                            value={endDate}
                            onChange={handleEndChange}
                            min={startDate}
                        />
                    </Form.Group>
                </Col>
            </Row>
        </div>
    );
}
