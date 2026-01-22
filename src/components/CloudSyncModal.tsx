import React, { useState } from 'react';
import { Modal, Button, Form, Alert, Tab, Tabs } from 'react-bootstrap';
import { Upload, Download, RefreshCw } from 'lucide-react';
import { saveItinerary, loadItinerary } from '../firebase';

interface CloudSyncModalProps {
  show: boolean;
  onClose: () => void;
  getData: () => any;
  onLoadData: (data: any) => void;
}

export function CloudSyncModal({ show, onClose, getData, onLoadData }: CloudSyncModalProps) {
  const [passcode, setPasscode] = useState('');
  const [activeTab, setActiveTab] = useState('save');
  const [status, setStatus] = useState<{ type: 'success' | 'danger' | 'info'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generatePasscode = () => {
    // Generate simple 6-char code: TRIP-XXXX
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPasscode(`TRIP-${code}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setStatus({ type: 'danger', message: 'Please enter a passcode.' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: 'info', message: 'Saving to cloud...' });
    
    const data = getData();
    const result = await saveItinerary(passcode.trim(), data);
    
    setIsLoading(false);
    if (result.success) {
      localStorage.setItem('last-trip-passcode', passcode.trim());
      setStatus({ type: 'success', message: 'Itinerary saved successfully!' });
    } else {
      setStatus({ type: 'danger', message: 'Failed to save. Check your connection.' });
    }
  };

  const handleLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setStatus({ type: 'danger', message: 'Please enter a passcode.' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: 'info', message: 'Loading from cloud...' });

    const result = await loadItinerary(passcode.trim());
    
    setIsLoading(false);
    if (result.success && result.data) {
      localStorage.setItem('last-trip-passcode', passcode.trim());
      onLoadData(result.data);
      setStatus({ type: 'success', message: 'Itinerary loaded successfully!' });
      setTimeout(onClose, 1500);
    } else {
      setStatus({ type: 'danger', message: result.error as string || 'Failed to load.' });
    }
  };

  const resetState = () => {
    const savedCode = localStorage.getItem('last-trip-passcode');
    setStatus(null);
    if (savedCode) {
      setPasscode(savedCode);
    } else {
      setPasscode('');
      if (activeTab === 'save') generatePasscode();
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered onShow={resetState}>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">Cloud Sync</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {status && (
          <Alert variant={status.type} className="py-2 small">
            {status.message}
          </Alert>
        )}

        <Tabs
          activeKey={activeTab}
          onSelect={(k) => { setActiveTab(k || 'save'); setStatus(null); setPasscode(''); if(k==='save') generatePasscode(); }}
          className="mb-3"
          fill
        >
          <Tab eventKey="save" title={<span className="d-flex align-items-center gap-2"><Upload size={16} /> Save</span>}>
            <Form onSubmit={handleSave}>
              <p className="text-muted small">Save your trip to the cloud with a unique passcode. Share this code with friends to let them view or edit your plan.</p>
              <Form.Group className="mb-3">
                <Form.Label>Passcode</Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control 
                    type="text" 
                    placeholder="e.g. TRIP-ABCD" 
                    value={passcode} 
                    onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                    className="fw-bold font-monospace"
                  />
                  <Button variant="outline-secondary" onClick={generatePasscode} title="Generate New Code">
                    <RefreshCw size={16} />
                  </Button>
                </div>
              </Form.Group>
              <Button variant="primary" type="submit" className="w-100" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save to Cloud'}
              </Button>
            </Form>
          </Tab>
          
          <Tab eventKey="load" title={<span className="d-flex align-items-center gap-2"><Download size={16} /> Load</span>}>
            <Form onSubmit={handleLoad}>
              <p className="text-muted small">Enter a passcode to load an itinerary. <strong className="text-danger">Warning: This will overwrite your current plan.</strong></p>
              <Form.Group className="mb-3">
                <Form.Label>Passcode</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Enter passcode..." 
                  value={passcode} 
                  onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                  className="fw-bold font-monospace"
                />
              </Form.Group>
              <Button variant="warning" type="submit" className="w-100" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Load from Cloud'}
              </Button>
            </Form>
          </Tab>
        </Tabs>
      </Modal.Body>
    </Modal>
  );
}
