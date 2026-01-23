import React, { useState, useEffect } from 'react';
import { Form, Button, ListGroup, InputGroup } from 'react-bootstrap';
import { X, Plus, Trash2, ExternalLink, CheckSquare, Link as LinkIcon, Map as MapIcon, Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import { Location, Day, Route, DaySection, TRANSPORT_LABELS } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { searchPhoto } from '../unsplash';

interface LocationDetailPanelProps {
  location: Location | null;
  days: Day[];
  allLocations: Location[];
  routes: Route[];
  onUpdate: (id: string, updates: Partial<Location>) => void;
  onClose: () => void;
}

const SECTION_ORDER: DaySection[] = ['morning', 'afternoon', 'evening'];

export function LocationDetailPanel({ location, days, allLocations, routes, onUpdate, onClose }: LocationDetailPanelProps) {
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      if (location && !location.imageUrl && !imageLoading) {
        setImageLoading(true);
        const url = await searchPhoto(location.name);
        if (url) {
          onUpdate(location.id, { imageUrl: url });
        }
        setImageLoading(false);
      }
    };
    fetchImage();
  }, [location?.id]); // Only re-run if location ID changes

  if (!location) return null;

  // Calculate Schedule Recap
  const startDay = days.find(d => d.id === location.startDayId);
  const startDayIdx = days.findIndex(d => d.id === location.startDayId);
  
  const getScheduleRecap = () => {
    if (!startDay) return 'Unassigned';
    
    const startSlotIdx = SECTION_ORDER.indexOf(location.startSlot || 'morning');
    const totalSlots = location.duration || 1;
    const endAbsSlot = (startDayIdx * 3) + startSlotIdx + totalSlots - 1;
    const endDayIdx = Math.floor(endAbsSlot / 3);
    const endSlotIdx = endAbsSlot % 3;
    const endDay = days[endDayIdx];

    const formatDate = (d: Day) => new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    const startStr = `${formatDate(startDay)} (${location.startSlot})`;
    const endStr = endDay ? `${formatDate(endDay)} (${SECTION_ORDER[endSlotIdx]})` : 'End of trip';
    
    return { startStr, endStr };
  };

  const schedule = getScheduleRecap();

  // Find Chronological Neighbors for Travel Info
  const sortedLocs = [...allLocations]
    .filter(l => l.startDayId) // Only those on timeline
    .sort((a, b) => {
      const dayA = days.findIndex(d => d.id === a.startDayId);
      const dayB = days.findIndex(d => d.id === b.startDayId);
      if (dayA !== dayB) return dayA - dayB;
      const slotA = SECTION_ORDER.indexOf(a.startSlot || 'morning');
      const slotB = SECTION_ORDER.indexOf(b.startSlot || 'morning');
      if (slotA !== slotB) return slotA - slotB;
      return (a.order || 0) - (b.order || 0);
    });

  const currentIdx = sortedLocs.findIndex(l => l.id === location.id);
  const prevLoc = currentIdx > 0 ? sortedLocs[currentIdx - 1] : null;
  const nextLoc = currentIdx < sortedLocs.length - 1 ? sortedLocs[currentIdx + 1] : null;

  const arrivalRoute = prevLoc ? routes.find(r => 
    (r.fromLocationId === prevLoc.id && r.toLocationId === location.id) ||
    (r.fromLocationId === location.id && r.toLocationId === prevLoc.id)
  ) : null;

  const departureRoute = nextLoc ? routes.find(r => 
    (r.fromLocationId === location.id && r.toLocationId === nextLoc.id) ||
    (r.fromLocationId === nextLoc.id && r.toLocationId === location.id)
  ) : null;

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    const newItem = { id: uuidv4(), text: newChecklistItem, completed: false };
    onUpdate(location.id, { checklist: [...(location.checklist || []), newItem] });
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (itemId: string) => {
    const updated = (location.checklist || []).map(item => item.id === itemId ? { ...item, completed: !item.completed } : item);
    onUpdate(location.id, { checklist: updated });
  };

  const removeChecklistItem = (itemId: string) => {
    const updated = (location.checklist || []).filter(item => item.id !== itemId);
    onUpdate(location.id, { checklist: updated });
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.url.trim()) return;
    const newItem = { id: uuidv4(), label: newLink.label || newLink.url, url: newLink.url };
    onUpdate(location.id, { links: [...(location.links || []), newItem] });
    setNewLink({ label: '', url: '' });
  };

  const removeLink = (linkId: string) => {
    const updated = (location.links || []).filter(item => item.id !== linkId);
    onUpdate(location.id, { links: updated });
  };

  return (
    <div className="d-flex flex-column h-100">
      {location.imageUrl && (
        <div className="w-100 position-relative" style={{ height: '160px' }}>
          <img 
            src={location.imageUrl} 
            alt={location.name} 
            className="w-100 h-100 object-fit-cover"
          />
          <div className="position-absolute top-0 end-0 p-2">
             <Button variant="light" size="sm" className="rounded-circle shadow-sm opacity-75" onClick={onClose}><X size={20} /></Button>
          </div>
        </div>
      )}
      <div className={`p-3 border-bottom d-flex justify-content-between align-items-center bg-light ${location.imageUrl ? '' : ''}`}>
        <div className="flex-grow-1 min-width-0">
          <h5 className="mb-0 text-truncate">{location.name}</h5>
          <div className="text-muted small" style={{ fontSize: '0.65rem' }}>
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button 
            variant="outline-primary" 
            size="sm" 
            className="d-flex align-items-center gap-1 py-1"
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name)}`, '_blank')}
            title="Open in Google Maps"
          >
            <MapIcon size={14} />
            Maps
          </Button>
          {!location.imageUrl && (
            <Button variant="link" className="p-0 text-muted" onClick={onClose}>
              <X size={24} />
            </Button>
          )}
        </div>
      </div>

      <div className="p-3 flex-grow-1 overflow-auto">
        <div className="mb-4 p-3 bg-light rounded border shadow-sm">
          <div className="d-flex align-items-start gap-3 mb-3">
            <Calendar className="text-primary mt-1" size={18} />
            <div>
              <div className="small fw-bold text-uppercase text-muted" style={{ fontSize: '0.65rem' }}>Schedule Recap</div>
              {typeof schedule === 'string' ? (
                <div className="small">{schedule}</div>
              ) : (
                <div className="small">
                  <div><strong>From:</strong> {schedule.startStr}</div>
                  <div><strong>To:</strong> {schedule.endStr}</div>
                </div>
              )}
            </div>
          </div>

          {(arrivalRoute || departureRoute) && (
            <div className="border-top pt-2 mt-2">
              <div className="small fw-bold text-uppercase text-muted mb-2" style={{ fontSize: '0.65rem' }}>Travel Connections</div>
              
              {arrivalRoute && prevLoc && (
                <div className="d-flex align-items-center gap-2 mb-2 small text-muted">
                  <ArrowLeft size={14} className="text-info" />
                  <span>Arrive from <strong>{prevLoc.name}</strong> via {TRANSPORT_LABELS[arrivalRoute.transportType]}</span>
                </div>
              )}

              {departureRoute && nextLoc && (
                <div className="d-flex align-items-center gap-2 small text-muted">
                  <ArrowRight size={14} className="text-success" />
                  <span>Depart to <strong>{nextLoc.name}</strong> via {TRANSPORT_LABELS[departureRoute.transportType]}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <Form.Group className="mb-4">
          <Form.Label className="small fw-bold text-muted text-uppercase">Description & Notes</Form.Label>
          <Form.Control
            as="textarea"
            rows={8}
            placeholder="Add details, booking numbers, or notes..."
            value={location.notes || ''}
            onChange={(e) => onUpdate(location.id, { notes: e.target.value })}
          />
        </Form.Group>

        <div className="mb-4">
          <Form.Label className="small fw-bold text-muted text-uppercase d-flex align-items-center justify-content-between">
            <span><CheckSquare size={12} className="me-1" /> Checklist</span>
            <span className="badge bg-secondary">{(location.checklist || []).filter(i => i.completed).length}/{(location.checklist || []).length}</span>
          </Form.Label>
          
          <ListGroup variant="flush" className="mb-2 border rounded">
            {(location.checklist || []).map(item => (
              <ListGroup.Item key={item.id} className="d-flex align-items-center gap-2 py-2">
                <Form.Check checked={item.completed} onChange={() => toggleChecklistItem(item.id)} />
                <span className={`flex-grow-1 small ${item.completed ? 'text-decoration-line-through text-muted' : ''}`}>{item.text}</span>
                <Button variant="link" className="p-0 text-danger opacity-50" onClick={() => removeChecklistItem(item.id)}><Trash2 size={14} /></Button>
              </ListGroup.Item>
            ))}
          </ListGroup>

          <Form onSubmit={handleAddChecklistItem}>
            <InputGroup size="sm">
              <Form.Control placeholder="Add task..." value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} />
              <Button type="submit" variant="outline-primary"><Plus size={16} /></Button>
            </InputGroup>
          </Form>
        </div>

        <div className="mb-4">
          <Form.Label className="small fw-bold text-muted text-uppercase">
            <LinkIcon size={12} className="me-1" /> Helpful Links
          </Form.Label>
          <ListGroup variant="flush" className="mb-2 border rounded">
            {(location.links || []).map(link => (
              <ListGroup.Item key={link.id} className="d-flex align-items-center gap-2 py-2">
                <ExternalLink size={14} className="text-muted" />
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-grow-1 small text-truncate text-decoration-none">{link.label}</a>
                <Button variant="link" className="p-0 text-danger opacity-50" onClick={() => removeLink(link.id)}><Trash2 size={14} /></Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
          <Form onSubmit={handleAddLink}>
            <div className="d-flex flex-column gap-1">
              <Form.Control size="sm" placeholder="Link Label (e.g. Booking.com)" value={newLink.label} onChange={(e) => setNewLink({ ...newLink, label: e.target.value })} />
              <InputGroup size="sm">
                <Form.Control placeholder="URL..." value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} />
                <Button type="submit" variant="outline-primary"><Plus size={16} /></Button>
              </InputGroup>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
