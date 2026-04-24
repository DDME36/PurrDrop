'use client';

import { useState } from 'react';

// SVG Icons
const SmartphoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </svg>
);

const RefreshCwIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

const PointerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 14a8 8 0 0 1-8 8" />
    <path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
    <path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
    <path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" />
    <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
);

const GiftIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M10 9H8"/>
    <path d="M16 13H8"/>
    <path d="M16 17H8"/>
  </svg>
);

const HistoryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <path d="M12 11h4"/>
    <path d="M12 16h4"/>
    <path d="M8 11h.01"/>
    <path d="M8 16h.01"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-question" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <span className={`faq-chevron ${open ? 'rotated' : ''}`}><ChevronDownIcon /></span>
      </button>
      {open && <div className="faq-answer">{answer}</div>}
    </div>
  );
}

const STEP_COLORS = ['var(--accent-pink)', 'var(--accent-mint)', 'var(--accent-peach)', 'var(--accent-lavender)'];

export function HelpModal({ show, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'text' | 'history' | 'troubleshoot'>('basic');

  if (!show) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-help" onClick={e => e.stopPropagation()}>
        <div className="help-decoration-top"></div>
        
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">PurrDrop Guide</h3>
            <p className="modal-subtitle">แชร์ไฟล์ง่ายๆ แค่ปลายนิ้ว</p>
          </div>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>
        
        <div className="help-tabs-container">
          <div className="help-tabs">
            <button 
              className={`help-tab ${activeTab === 'basic' ? 'active' : ''}`}
              onClick={() => setActiveTab('basic')}
            >
              <div className="tab-icon">📦</div>
              <span>ส่งไฟล์</span>
            </button>
            <button 
              className={`help-tab ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              <div className="tab-icon">💬</div>
              <span>ข้อความ</span>
            </button>
            <button 
              className={`help-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <div className="tab-icon">🕒</div>
              <span>ประวัติ</span>
            </button>
            <button 
              className={`help-tab ${activeTab === 'troubleshoot' ? 'active' : ''}`}
              onClick={() => setActiveTab('troubleshoot')}
            >
              <div className="tab-icon">🛠️</div>
              <span>แก้ปัญหา</span>
            </button>
          </div>
        </div>

        <div className="help-content-scroll">
          {activeTab === 'basic' && (
            <div className="help-visual-guide">
              <div className="visual-step">
                <div className="visual-icon" style={{ background: 'var(--accent-pink)' }}>
                  <SmartphoneIcon />
                </div>
                <div className="visual-text">
                  <strong>1. เตรียมอุปกรณ์</strong>
                  <span>เปิด PurrDrop บนเครื่องอื่นเพื่อเชื่อมต่อ</span>
                </div>
              </div>
              <div className="visual-connector"></div>
              <div className="visual-step">
                <div className="visual-icon" style={{ background: 'var(--accent-mint)' }}>
                  <PointerIcon />
                </div>
                <div className="visual-text">
                  <strong>2. เลือกและส่ง</strong>
                  <span>กดที่ชื่อเพื่อน เลือกไฟล์ หรือลากวางได้เลย</span>
                </div>
              </div>
              <div className="visual-connector"></div>
              <div className="visual-step">
                <div className="visual-icon" style={{ background: 'var(--accent-peach)' }}>
                  <GiftIcon />
                </div>
                <div className="visual-text">
                  <strong>3. รับไฟล์สำเร็จ</strong>
                  <span>เพื่อนกด "รับ" ไฟล์จะส่งผ่าน P2P โดยตรง</span>
                </div>
              </div>
              
              <div className="help-info-card">
                <div className="info-icon">💡</div>
                <p>ใช้ <strong>"โหมด WiFi"</strong> เพื่อความเร็วสูงสุดในการส่งไฟล์ระดับ GB</p>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="help-visual-guide">
              <div className="visual-step">
                <div className="visual-icon" style={{ background: 'var(--accent-lavender)' }}>
                  <FileTextIcon />
                </div>
                <div className="visual-text">
                  <strong>ส่งข้อความและลิงก์</strong>
                  <span>กดปุ่มเมฆข้อความมุมขวา เพื่อพิมพ์ส่งหาเพื่อน</span>
                </div>
              </div>
              <div className="help-info-card">
                <div className="info-icon">✨</div>
                <p>ลิงก์ที่ส่งมา สามารถคลิกเพื่อเปิดได้ทันทีจากเมนูประวัติ</p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="help-visual-guide">
              <div className="visual-step">
                <div className="visual-icon" style={{ background: 'var(--accent-pink)' }}>
                  <HistoryIcon />
                </div>
                <div className="visual-text">
                  <strong>ตรวจสอบประวัติ</strong>
                  <span>กดปุ่มนาฬิกามุมขวาบน เพื่อดูสิ่งที่เคยแชร์ไป</span>
                </div>
              </div>
              <p className="help-note">* ข้อมูลประวัติจะถูกเก็บไว้ในเครื่องของคุณเท่านั้น</p>
            </div>
          )}

          {activeTab === 'troubleshoot' && (
            <div className="help-faq-list">
              <FAQItem 
                question="หาเพื่อนไม่เจอ?"
                answer="เช็คว่าเปิดโหมดเดียวกัน (เช่น สาธารณะทั้งคู่) และลอง Refresh หน้าเว็บ"
              />
              <FAQItem 
                question="ความเร็วช้าเกินไป?"
                answer="หากอยู่ไกลกันระบบจะใช้ Relay Server แนะนำให้เข้า WiFi เดียวกันจะเร็วขึ้นมาก"
              />
              <FAQItem 
                question="เปิดใน LINE/FB แล้วใช้ไม่ได้?"
                answer="แอปโซเชียลมักบล็อกการส่งไฟล์ ให้กดเปิดใน Safari หรือ Chrome แทน"
              />
              <FAQItem 
                question="ส่งไฟล์ผ่าน 4G/5G ได้ไหม?"
                answer="ได้ครับ ให้ใช้ 'โหมดส่วนตัว' แล้วแชร์รหัสห้องให้เพื่อน"
              />
            </div>
          )}
        </div>

        <div className="help-footer">
          <button className="btn btn-primary btn-full" onClick={onClose}>เริ่มใช้งานเลย!</button>
        </div>
      </div>
    </div>
  );
}
