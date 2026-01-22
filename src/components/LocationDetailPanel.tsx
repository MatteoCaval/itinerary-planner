import React, { useState } from 'react';
import { Form, Button, ListGroup, InputGroup } from 'react-bootstrap';
import { X, Plus, Trash2, ExternalLink, CheckSquare, Link as LinkIcon, Map as MapIcon } from 'lucide-react';
import { Location } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface LocationDetailPanelProps {
  location: Location | null;
  onUpdate: (id: string, updates: Partial<Location>) => void;
  onClose: () => void;
}

export function LocationDetailPanel({ location, onUpdate, onClose }: LocationDetailPanelProps) {
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });

  if (!location) return null;

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    
    const newItem = { id: uuidv4(), text: newChecklistItem, completed: false };
    onUpdate(location.id, {
      checklist: [...(location.checklist || []), newItem]
    });
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (itemId: string) => {
    const updated = (location.checklist || []).map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
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
    onUpdate(location.id, {
      links: [...(location.links || []), newItem]
    });
    setNewLink({ label: '', url: '' });
  };

  const removeLink = (linkId: string) => {
    const updated = (location.links || []).filter(item => item.id !== linkId);
    onUpdate(location.id, { links: updated });
  };

  return (
    <div className="d-flex flex-column h-100">
      <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
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
          <Button variant="link" className="p-0 text-muted" onClick={onClose}>
            <X size={24} />
          </Button>
        </div>
      </div>

      <div className="p-3 flex-grow-1 overflow-auto">
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
                <Form.Check 
                  checked={item.completed}
                  onChange={() => toggleChecklistItem(item.id)}
                />
                <span className={`flex-grow-1 small ${item.completed ? 'text-decoration-line-through text-muted' : ''}`}>
                  {item.text}
                </span>
                <Button variant="link" className="p-0 text-danger opacity-50 hover-opacity-100" onClick={() => removeChecklistItem(item.id)}>
                  <Trash2 size={14} />
                </Button>
              </ListGroup.Item>
            ))}
          </ListGroup>

          <Form onSubmit={handleAddChecklistItem}>
            <InputGroup size="sm">
              <Form.Control
                placeholder="Add task..."
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
              />
              <Button type="submit" variant="outline-primary">
                <Plus size={16} />
              </Button>
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
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-grow-1 small text-truncate text-decoration-none">
                  {link.label}
                </a>
                <Button variant="link" className="p-0 text-danger opacity-50" onClick={() => removeLink(link.id)}>
                  <Trash2 size={14} />
                </Button>
              </ListGroup.Item>
            ))}
          </ListGroup>

          <Form onSubmit={handleAddLink}>
            <div className="d-flex flex-column gap-1">
              <Form.Control
                size="sm"
                placeholder="Link Label (e.g. Booking.com)"
                value={newLink.label}
                onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
              />
              <InputGroup size="sm">
                <Form.Control
                  placeholder="URL..."
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                />
                <Button type="submit" variant="outline-primary">
                  <Plus size={16} />
                </Button>
              </InputGroup>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}