import { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
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

export function RouteEditor({ show, route, fromName, toName, onSave, onClose }: RouteEditorProps) {
    const [transportType, setTransportType] = useState<TransportType>('car');
    const [duration, setDuration] = useState('');
    const [cost, setCost] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (route) {
            setTransportType(route.transportType);
            setDuration(route.duration || '');
            setCost(route.cost || '');
            setNotes(route.notes || '');
        } else {
            // Reset to defaults
            setTransportType('car');
            setDuration('');
            setCost('');
            setNotes('');
        }
    }, [route]);

    const handleSave = () => {
        if (!route) return;

        onSave({
            ...route,
            transportType,
            duration: duration || undefined,
            cost: cost || undefined,
            notes: notes || undefined,
        });
    };

    return (
        <Modal show={show} onHide={onClose} centered>
            <Modal.Header closeButton>
                <Modal.Title className="fs-5">Edit Route</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="route-summary mb-3 p-2 bg-light rounded">
                    <div className="small text-muted">From</div>
                    <div className="fw-bold">{fromName}</div>
                    <div className="text-center text-muted my-1">↓</div>
                    <div className="small text-muted">To</div>
                    <div className="fw-bold">{toName}</div>
                </div>

                <Form>
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold">Transportation</Form.Label>
                        <div className="transport-options d-flex flex-wrap gap-2">
                            {TRANSPORT_OPTIONS.map(type => (
                                <Button
                                    key={type}
                                    variant={transportType === type ? 'primary' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => setTransportType(type)}
                                    className="transport-btn"
                                >
                                    {TRANSPORT_LABELS[type]}
                                </Button>
                            ))}
                        </div>
                    </Form.Group>

                    <Row className="mb-3">
                        <Col xs={6}>
                            <Form.Group>
                                <Form.Label className="small fw-bold d-flex align-items-center gap-1">
                                    <Clock size={14} /> Duration
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    size="sm"
                                    placeholder="e.g., 2h 30m"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col xs={6}>
                            <Form.Group>
                                <Form.Label className="small fw-bold d-flex align-items-center gap-1">
                                    <Euro size={14} /> Cost
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    size="sm"
                                    placeholder="e.g., €50"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <Form.Group>
                        <Form.Label className="small fw-bold d-flex align-items-center gap-1">
                            <FileText size={14} /> Notes
                        </Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            size="sm"
                            placeholder="Additional notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave}>
                    Save Route
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
