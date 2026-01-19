import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Button, Form, Badge } from 'react-bootstrap';
import { Location } from '../types';

import { Route, TRANSPORT_LABELS, TRANSPORT_COLORS } from '../types';

interface SortableItemProps {
  id: string;
  location: Location;
  index?: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Location>) => void;
  duration?: number;
  route?: Route;
  onEditRoute?: () => void;
}

export function SortableItem({
  id,
  location,
  index,
  onRemove,
  onUpdate,
  duration = 1,
  route,
  onEditRoute
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: '100%', 
  };

  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="sortable-item-wrapper h-100">
      <div
        ref={setNodeRef}
        style={style}
        className={`sortable-item h-100 ${isDragging ? 'dragging' : ''}`}
      >
        <div className="d-flex flex-column h-100 w-100">
          <div className="d-flex align-items-center w-100 mb-1">
            <div {...attributes} {...listeners} className="drag-handle">
              <GripVertical size={20} />
            </div>

            {index && (
              <div className="location-index me-2">
                <Badge bg="primary" pill className="small">{index}</Badge>
              </div>
            )}

            <div className="flex-grow-1 min-width-0">
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
            </div>

            <div className="d-flex align-items-center gap-1">
               <Button
                variant="link"
                className="text-danger btn-icon p-1"
                onClick={() => onRemove(id)}
                title="Remove location"
              >
                <X size={18} />
              </Button>
            </div>
          </div>

          <div className="mt-auto pt-1 border-top">
             <div className="text-muted small d-flex align-items-center justify-content-center gap-2">
                <div className="d-flex align-items-center gap-1 bg-light rounded px-1 border" style={{ fontSize: '0.75rem' }}>
                  <span className="text-muted" style={{ cursor: 'pointer', padding: '0 4px' }} onClick={(e) => {
                    e.stopPropagation();
                    const newDuration = Math.max(1, (duration || 1) - 1);
                    onUpdate(id, { duration: newDuration });
                  }}>-</span>
                  <span className="fw-bold">{duration} slots</span>
                  <span className="text-muted" style={{ cursor: 'pointer', padding: '0 4px' }} onClick={(e) => {
                    e.stopPropagation();
                    const newDuration = (duration || 1) + 1;
                    onUpdate(id, { duration: newDuration });
                  }}>+</span>
                </div>
              </div>
              
              {route && (
                <div 
                    className="mt-2 pt-1 border-top text-muted d-flex align-items-center justify-content-between" 
                    style={{ fontSize: '0.7rem', cursor: 'pointer' }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onEditRoute) onEditRoute();
                    }}
                >
                    <span style={{ color: TRANSPORT_COLORS[route.transportType] }}>
                        {TRANSPORT_LABELS[route.transportType]}
                    </span>
                    <span>{route.duration || 'Add info'}</span>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
