import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, MapPin } from 'lucide-react';
import { Button, Form } from 'react-bootstrap';
import { Location } from '../types';

interface SortableItemProps {
  id: string;
  location: Location;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Location>) => void;
}

export function SortableItem({ id, location, onRemove, onUpdate }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [isEditing, setIsEditing] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-item ${isDragging ? 'dragging' : ''}`}
    >
      <div className="d-flex align-items-center w-100">
        <div {...attributes} {...listeners} className="drag-handle">
          <GripVertical size={20} />
        </div>
        
        <div className="flex-grow-1">
          {isEditing ? (
            <Form.Control
              autoFocus
              size="sm"
              type="text"
              value={location.name}
              onChange={(e) => onUpdate(id, { name: e.target.value })}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditing(false);
              }}
            />
          ) : (
            <div 
              className="fw-bold text-truncate" 
              style={{ cursor: 'text' }}
              onClick={() => setIsEditing(true)}
              title="Click to edit name"
            >
              {location.name}
            </div>
          )}
          <div className="text-muted small">
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </div>
        </div>

        <Button 
          variant="link" 
          className="text-danger btn-icon ms-2"
          onClick={() => onRemove(id)}
        >
          <X size={18} />
        </Button>
      </div>
    </div>
  );
}
