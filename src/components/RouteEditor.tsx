import { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { Route, TransportType, TRANSPORT_LABELS } from '../types';
import { Clock, Euro, FileText } from 'lucide-react';

interface RouteEditorProps {
    show: boolean;
    route: Route | null;
    fromName: string;
    toName: string;
    onSave: (route: Route) => void;
    onClose: () => void;
}

const TRANSPORT_OPTIONS: TransportType[] = ['walk', 'car', 'bus', 'train', 'flight', 'ferry', 'other'];
const QUICK_DURATIONS = [15, 30, 60, 120, 240]; // minutes

export function RouteEditor({ show, route, fromName, toName, onSave, onClose }: RouteEditorProps) {
    const [transportType, setTransportType] = useState<TransportType>('car');
    
    // Structured Duration State
    const [hours, setHours] = useState<number>(0);
    const [minutes, setMinutes] = useState<number>(0);
    
    const [cost, setCost] = useState('');
    const [notes, setNotes] = useState('');

    // Helper to parse duration string "1h 30m" -> { h: 1, m: 30 }
    const parseDuration = (str: string) => {
        let h = 0, m = 0;
        if (!str) return { h, m };
        
        // Match "Xh"
        const hMatch = str.match(/(\d+)\s*h/);
        if (hMatch) h = parseInt(hMatch[1]);
        
        // Match "Xm"
        const mMatch = str.match(/(\d+)\s*m/);
        if (mMatch) m = parseInt(mMatch[1]);
        
        // If just a number, assume minutes? Or legacy format?
        // Let's stick to the structured parser.
        return { h, m };
    };

    useEffect(() => {
        if (route) {
            setTransportType(route.transportType);
            const { h, m } = parseDuration(route.duration || '');
            setHours(h);
            setMinutes(m);
            setCost(route.cost || '');
            setNotes(route.notes || '');
        } else {
            // Reset to defaults
            setTransportType('car');
            setHours(0);
            setMinutes(0);
            setCost('');
            setNotes('');
        }
    }, [route, show]); // Reset when modal opens

    const handleQuickDuration = (totalMins: number) => {
        setHours(Math.floor(totalMins / 60));
        setMinutes(totalMins % 60);
    };

    const handleSave = () => {
        if (!route) return;

        // Format duration string
        let durationStr = '';
        if (hours > 0) durationStr += `${hours}h`;
        if (minutes > 0) durationStr += `${hours > 0 ? ' ' : ''}${minutes}m`;

        onSave({
            ...route,
            transportType,
            duration: durationStr || undefined,
            cost: cost || undefined,
            notes: notes || undefined,
        });
    };

    return (
        <Modal show={show} onHide={onClose} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title className="fs-5">Edit Route Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="route-summary mb-4 p-3 bg-light rounded border d-flex align-items-center justify-content-between">
                    <div className="text-center" style={{ minWidth: '40%' }}>
                        <div className="small text-muted text-uppercase fw-bold">From</div>
                        <div className="fw-bold text-truncate">{fromName}</div>
                    </div>
                    <div className="text-muted mx-2">→</div>
                    <div className="text-center" style={{ minWidth: '40%' }}>
                        <div className="small text-muted text-uppercase fw-bold">To</div>
                        <div className="fw-bold text-truncate">{toName}</div>
                    </div>
                </div>

                <Row className="g-4">
                    {/* Left Column: Transport & Cost */}
                    <Col md={6}>
                        <Form.Group className="mb-4">
                            <Form.Label className="small fw-bold text-uppercase text-muted">Transportation Method</Form.Label>
                            <div className="d-flex flex-wrap gap-2">
                                {TRANSPORT_OPTIONS.map(type => (
                                    <Button
                                        key={type}
                                        variant={transportType === type ? 'primary' : 'outline-secondary'}
                                        size="sm"
                                        onClick={() => setTransportType(type)}
                                        className="text-capitalize"
                                    >
                                        {TRANSPORT_LABELS[type]}
                                    </Button>
                                ))}
                            </div>
                        </Form.Group>

                        <Form.Group>
                            <Form.Label className="small fw-bold text-uppercase text-muted d-flex align-items-center gap-1">
                                <Euro size={14} /> Estimated Cost
                            </Form.Label>
                            <InputGroup size="sm">
                                <InputGroup.Text className="bg-light border-end-0">€</InputGroup.Text>
                                <Form.Control
                                    type="text"
                                    className="border-start-0"
                                    placeholder="0.00"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value)}
                                />
                            </InputGroup>
                        </Form.Group>
                    </Col>

                    {/* Right Column: Duration & Notes */}
                    <Col md={6}>
                        <Form.Group className="mb-4">
                            <Form.Label className="small fw-bold text-uppercase text-muted d-flex align-items-center gap-1">
                                <Clock size={14} /> Duration
                            </Form.Label>
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <InputGroup size="sm">
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        value={hours}
                                        onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                                    />
                                    <InputGroup.Text>hr</InputGroup.Text>
                                </InputGroup>
                                <InputGroup size="sm">
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={minutes}
                                        onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                    />
                                    <InputGroup.Text>min</InputGroup.Text>
                                </InputGroup>
                            </div>
                            {/* Quick Presets */}
                            <div className="d-flex flex-wrap gap-1">
                                {QUICK_DURATIONS.map(m => (
                                    <Button 
                                        key={m} 
                                        variant="light" 
                                        size="sm" 
                                        className="border text-muted py-0 px-2" 
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => handleQuickDuration(m)}
                                    >
                                        {m >= 60 ? `${m/60}h` : `${m}m`}
                                    </Button>
                                ))}
                            </div>
                        </Form.Group>

                        <Form.Group>
                            <Form.Label className="small fw-bold text-uppercase text-muted d-flex align-items-center gap-1">
                                <FileText size={14} /> Notes
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                size="sm"
                                placeholder="Route details, booking ref..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </Form.Group>
                    </Col>
                </Row>
            </Modal.Body>
            <Modal.Footer className="bg-light">
                <Button variant="outline-secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} className="px-4">
                    Save Route
                </Button>
            </Modal.Footer>
        </Modal>
    );
}