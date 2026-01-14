'use client';

import { useState } from 'react';

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

  if (!show) return null;

  const handleSubmit = async () => {
    if (!message.trim() && rating === 0) return;
    
    setSending(true);
    setError(false);
    
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          message,
          device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
        }),
      });

      if (!res.ok) throw new Error('Failed');

      setSent(true);
      setTimeout(() => {
        onClose();
        setSent(false);
        setMessage('');
        setRating(0);
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
            <div className="feedback-success-icon">💖</div>
            <div className="feedback-success-text">ขอบคุณสำหรับ Feedback!</div>
          </div>
        ) : (
          <>
            <div className="modal-title">💬 ส่ง Feedback</div>
            <p className="feedback-subtitle">ช่วยให้เราพัฒนา PurrDrop ให้ดีขึ้น</p>
            
            {error && (
              <div className="feedback-error">
                ❌ ส่งไม่สำเร็จ กรุณาลองใหม่
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
                    ⭐
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
