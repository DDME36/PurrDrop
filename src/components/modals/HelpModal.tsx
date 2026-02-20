'use client';

import { useState } from 'react';

// Lucide Icons
const SmartphoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </svg>
);

const RefreshCwIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

const PointerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 14a8 8 0 0 1-8 8" />
    <path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
    <path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
    <path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" />
    <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
);

const GiftIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-lavender)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-lavender)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M10 9H8"/>
    <path d="M16 13H8"/>
    <path d="M16 17H8"/>
  </svg>
);

const HistoryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <path d="M12 11h4"/>
    <path d="M12 16h4"/>
    <path d="M8 11h.01"/>
    <path d="M8 16h.01"/>
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 8v4"/>
    <path d="M12 16h.01"/>
  </svg>
);

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

export function HelpModal({ show, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'text' | 'history' | 'troubleshoot'>('basic');

  if (!show) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-help" onClick={e => e.stopPropagation()}>
        <div className="modal-title">วิธีใช้งาน</div>
        
        <div className="help-tabs">
          <button 
            className={`help-tab ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            ส่งไฟล์
          </button>
          <button 
            className={`help-tab ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            ส่งข้อความ
          </button>
          <button 
            className={`help-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            ประวัติ
          </button>
          <button 
            className={`help-tab ${activeTab === 'troubleshoot' ? 'active' : ''}`}
            onClick={() => setActiveTab('troubleshoot')}
          >
            แก้ปัญหา
          </button>
        </div>

        <div className="help-content">
          {activeTab === 'basic' && (
            <div className="help-steps">
              <div className="help-step">
                <div className="step-icon"><SmartphoneIcon /></div>
                <div className="step-text">เปิด PurrDrop ในอุปกรณ์อื่น</div>
              </div>
              <div className="help-step">
                <div className="step-icon"><RefreshCwIcon /></div>
                <div className="step-text">
                  เลือกโหมดเดียวกัน (สาธารณะ / WiFi / ส่วนตัว)
                </div>
              </div>
              <div className="help-step">
                <div className="step-icon"><PointerIcon /></div>
                <div className="step-text">คลิกที่เพื่อน → เลือกไฟล์ (หรือลากไฟล์มาวาง)</div>
              </div>
              <div className="help-step">
                <div className="step-icon"><GiftIcon /></div>
                <div className="step-text">เพื่อนกด "รับเลย!" → ไฟล์ส่งผ่าน P2P</div>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="help-steps">
              <div className="help-step">
                <div className="step-icon"><FileTextIcon /></div>
                <div className="step-text">
                  กดปุ่ม 📄 (มุมล่างขวา) → พิมพ์ข้อความ → เลือกเพื่อน → ส่ง
                  <br /><br />
                  <small>รองรับข้อความยาว, URL, และข้อความหลายบรรทัด</small>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="help-steps">
              <div className="help-step">
                <div className="step-icon"><HistoryIcon /></div>
                <div className="step-text">
                  กดไอคอน 📋 (มุมขวาบน) → ดูไฟล์และข้อความที่ส่ง/รับ
                  <br /><br />
                  <small>คลิกที่ข้อความเพื่ออ่านเต็ม หรือกดปุ่มคัดลอก</small>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'troubleshoot' && (
            <div className="help-steps">
              <div className="help-step">
                <div className="step-icon"><AlertCircleIcon /></div>
                <div className="step-text">
                  <strong>ไม่เห็นเพื่อน:</strong> ลอง refresh หน้าเว็บทั้งสองเครื่อง
                  <br /><br />
                  <strong>ส่งไฟล์ไม่ได้:</strong> ตรวจสอบว่าอยู่โหมดเดียวกัน
                  <br /><br />
                  <strong>ข้าม Network:</strong> ใช้โหมดส่วนตัว (Private)
                  <br /><br />
                  <strong>VPN:</strong> ปิด VPN หรือใช้โหมดส่วนตัว
                </div>
              </div>
            </div>
          )}
        </div>

        <button className="btn btn-close-modal" onClick={onClose}>เข้าใจแล้ว</button>
      </div>
    </div>
  );
}
