import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Calendar, Route } from 'lucide-react';
import { Button, Form, Badge } from 'react-bootstrap';
import { Location } from '../types';

interface SortableItemProps {
  id: string;
  location: Location;
  index?: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Location>) => void;
  dayCount?: number;
  showRouteButton?: boolean;
  onEditRoute?: () => void;
  onEditDays?: () => void;
}

export function SortableItem({
  id,
  location,
  index,
  onRemove,
  onUpdate,
  dayCount = 0,
  showRouteButton = false,
  onEditRoute,
  onEditDays
}: SortableItemProps) {
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
    <div className="sortable-item-wrapper">
      <div
        ref={setNodeRef}
        style={style}
        className={`sortable-item ${isDragging ? 'dragging' : ''}`}
      >
        <div className="d-flex align-items-center w-100">
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
            <div className="text-muted small d-flex align-items-center gap-2">
              <span>{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
              {dayCount > 1 && (
                <Badge bg="info" pill className="small">
                  {dayCount} days
                </Badge>
              )}
            </div>
          </div>

          <div className="d-flex align-items-center gap-1">
            {onEditDays && (
              <Button
                variant="link"
                className="text-secondary btn-icon p-1"
                onClick={onEditDays}
                title="Edit day assignments"
              >
                <Calendar size={16} />
              </Button>
            )}
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
      </div>

      {showRouteButton && onEditRoute && (
        <div className="route-connector d-flex align-items-center justify-content-center py-1">
          <Button
            variant="link"
            size="sm"
            className="text-muted route-edit-btn p-0"
            onClick={onEditRoute}
            title="Edit route details"
          >
            <Route size={14} className="me-1" />
            <span className="small">Edit route</span>
          </Button>
        </div>
      )}
    </div>
  );
}
