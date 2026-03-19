'use client';

import { useState } from 'react';

// Lucide Icons
const MessageCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
  </svg>
);

const HeartIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--accent-pink)" stroke="var(--accent-pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
);

const StarIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "#fbbf24" : "none"} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const XCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="m15 9-6 6"/>
    <path d="m9 9 6 6"/>
  </svg>
);

interface FeedbackModalProps {
  show: boolean;
  onClose: () => void;
}

export function FeedbackModal({ show, onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  if (!show) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 8 * 1024 * 1024) { // 8MB limit
        alert('ไฟล์ต้องมีขนาดไม่เกิน 8MB');
        return;
      }
      setFile(selectedFile);
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreview(objectUrl);
    }
  };

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview); // Cleanup memory
    setFile(null);
    setPreview(null);
  };

  const handleSubmit = async () => {
    if (!message.trim() && rating === 0) return;
    
    setSending(true);
    setError(false);
    
    try {
      const formData = new FormData();
      formData.append('rating', rating.toString());
      formData.append('message', message);
      formData.append('device', navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop');
      if (file) {
        formData.append('file', file);
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        // Content-Type header is explicitly NOT set here, so the browser generates the boundary for multipart/form-data
        body: formData,
      });

      if (!res.ok) throw new Error('Failed');

      setSent(true);
      setTimeout(() => {
        onClose();
        setSent(false);
        setMessage('');
        setRating(0);
        clearFile();
      }, 2000);
    } catch (err) {
      console.error('Failed to send feedback:', err);
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-feedback" onClick={e => e.stopPropagation()}>
        {sent ? (
          <div className="feedback-success">
            <div className="feedback-success-icon"><HeartIcon /></div>
            <div className="feedback-success-text">ขอบคุณสำหรับ Feedback!</div>
          </div>
        ) : (
          <>
            <div className="modal-title"><MessageCircleIcon /> ส่ง Feedback</div>
            <p className="feedback-subtitle">ช่วยให้เราพัฒนา PurrDrop ให้ดีขึ้น</p>
            
            {error && (
              <div className="feedback-error">
                <XCircleIcon /> ส่งไม่สำเร็จ กรุณาลองใหม่
              </div>
            )}
            
            <div className="feedback-rating">
              <span className="rating-label">ให้คะแนน:</span>
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`star-btn ${rating >= star ? 'active' : ''}`}
                    onClick={() => setRating(star)}
                  >
                    <StarIcon active={rating >= star} />
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className="feedback-input"
              placeholder="เขียนความคิดเห็น หรือแจ้งปัญหา..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
            />

            <div className="feedback-attachments">
              {preview ? (
                <div className="attachment-preview">
                  <img src={preview} alt="Attached" />
                  <button className="remove-attachment" onClick={clearFile} title="ลบรูปภาพ">
                    <XCircleIcon />
                  </button>
                </div>
              ) : (
                <label className="attachment-btn">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    hidden 
                  />
                  <span>📷 แนบรูปภาพ (สูงสุด 8MB)</span>
                </label>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-reject" onClick={onClose}>ยกเลิก</button>
              <button 
                className="btn btn-accept" 
                onClick={handleSubmit}
                disabled={sending || (!message.trim() && rating === 0)}
              >
                {sending ? 'กำลังส่ง...' : 'ส่ง Feedback'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
