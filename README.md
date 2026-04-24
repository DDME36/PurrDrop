# 🐱 PurrDrop

**PurrDrop** คือเว็บแอปพลิเคชันสำหรับส่งไฟล์ข้ามอุปกรณ์ที่เน้นความง่าย ความเป็นส่วนตัว และความเร็ว โดยใช้เทคโนโลยี WebRTC สำหรับการส่งข้อมูลแบบ Peer-to-Peer (P2P) โดยไม่ต้องผ่านเซิร์ฟเวอร์ในสภาวะปกติ พร้อมระบบ Relay สำรองเพื่อให้ใช้งานได้ทุกเครือข่าย

![PurrDrop OG Image](/public/og-image.png)

## ✨ คุณสมบัติเด่น

- **🚀 Hybrid Transfer Mode**: 
  - **P2P Direct**: ส่งไฟล์ตรงระหว่างเครื่องผ่าน LAN/WiFi (เร็วที่สุด ไม่ผ่านเน็ต)
  - **Streaming Relay**: ระบบสำรองเมื่อ P2P ติด Firewall โดยใช้การ Stream ข้อมูลผ่านเซิร์ฟเวอร์ (ไม่เก็บไฟล์ในเซิร์ฟเวอร์เพื่อความเป็นส่วนตัว)
- **🔐 End-to-End Encryption (E2EE)**: ไฟล์และข้อความถูกเข้ารหัสด้วย AES-GCM 256-bit ก่อนออกจากเครื่องคุณ มีเพียงผู้รับเท่านั้นที่ถอดรหัสได้
- **📱 ประสบการณ์แบบ App**: รองรับ PWA (Progressive Web App) ติดตั้งลงเครื่องได้ทั้ง iOS, Android และ Desktop
- **📂 Multi-file & Folder Support**: เลือกส่งหลายไฟล์พร้อมกัน หรือบีบอัดเป็น Zip อัตโนมัติก่อนส่ง
- **💬 Text & Link Sharing**: แชร์ข้อความหรือลิงก์หากันได้ทันที พร้อมระบบคัดลอกลง Clipboard
- **🎨 UI ที่เป็นมิตร**: มาพร้อมระบบธีม (Light/Dark), สัญลักษณ์สัตว์น่ารัก (Critters) แทนตัวตน และระบบจัดการห้องแบบส่วนตัว (Private Room)

## 🛠 เทคโนโลยีที่ใช้

- **Frontend**: Next.js 15+, React, TypeScript, Tailwind CSS
- **Communication**: Socket.io (Signaling & Relay), WebRTC (DataChannels)
- **Security**: Web Crypto API (ECDH Key Exchange, AES-GCM Encryption)
- **Optimization**: Web Workers (สำหรับการคำนวณหนัก), Adaptive Chunking (ปรับความเร็วตามเน็ต)

## 🚀 เริ่มต้นใช้งาน (Local Development)

1. **ติดตั้ง Dependencies**:
   ```bash
   bun install
   # หรือ
   npm install
   ```

2. **ตั้งค่า Environment**:
   สร้างไฟล์ `.env` (ดูตัวอย่างที่ `.env.example`)
   ```env
   PORT=3000
   ALLOWED_ORIGINS=http://localhost:3000
   ```

3. **รันโหมด Development**:
   ```bash
   npm run dev
   ```

4. **สร้างและรันโหมด Production**:
   ```bash
   npm run build
   npm start
   ```

## 🛡 การรักษาความปลอดภัยและความเป็นส่วนตัว

- **No Storage**: เซิร์ฟเวอร์ทำหน้าที่เป็นเพียงทางผ่าน (Signaling/Relay) ข้อมูลไฟล์จะไม่ถูกเขียนลง Disk ของเซิร์ฟเวอร์
- **Local Encryption**: กุญแจเข้ารหัส (Secret Key) ถูกสร้างขึ้นใหม่ทุกครั้งที่มีการเชื่อมต่อและไม่เคยถูกส่งไปยังเซิร์ฟเวอร์
- **Identity Privacy**: ไม่มีการเก็บข้อมูลส่วนตัว ใช้เพียงชื่อสุ่มและไอคอนรูปสัตว์

## 📄 ใบอนุญาต

โปรเจคนี้อยู่ภายใต้ใบอนุญาต [MIT License](LICENSE) 

---
สร้างด้วย ❤️ เพื่อการส่งไฟล์ที่อิสระและปลอดภัยที่สุด