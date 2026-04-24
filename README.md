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

## 🚀 เริ่มต้นใช้งาน

### Local Development

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

### Production Deployment

#### ⚡ Optimized for Render Free Tier

โปรเจคนี้ถูกปรับแต่งให้ทำงานได้ดีบน **Render Free Tier** (512MB RAM):

**คุณสมบัติที่เพิ่มเข้ามา:**
- ✅ **Keep-Alive System**: ป้องกัน server หลับทุก 14 นาที
- ✅ **Memory-Efficient Rate Limiting**: จำกัดการใช้งานโดยใช้ RAM น้อย
- ✅ **Backpressure Control**: จัดการ buffer overflow ใน Relay mode
- ✅ **Adaptive Chunking**: ปรับขนาด chunk ตามสภาพเครือข่าย (16KB-128KB)
- ✅ **Chunk Size Validation**: จำกัด relay chunk ไม่เกิน 128KB
- ✅ **Graceful Error Handling**: จัดการ uncaught exceptions และ unhandled rejections

**ขั้นตอนการ Deploy บน Render:**

1. Fork หรือ Clone repository นี้
2. สร้าง Web Service ใหม่บน [Render](https://render.com)
3. เชื่อมต่อกับ GitHub repository
4. ตั้งค่า Build & Start Commands:
   ```
   Build Command: npm install && npm run build
   Start Command: npm start
   ```
5. เพิ่ม Environment Variables:
   ```
   NODE_ENV=production
   PORT=3000
   ALLOWED_ORIGINS=https://your-app.onrender.com
   ```

**หมายเหตุสำหรับ Free Tier:**
- Server จะหลับหลังไม่มีการใช้งาน 15 นาที (ระบบ Keep-Alive จะช่วยป้องกัน)
- RAM จำกัดที่ 512MB (ระบบ Relay ถูกจำกัดเพื่อป้องกัน OOM)
- แนะนำให้ใช้ P2P เป็นหลัก, Relay เป็นทางเลือกสำรอง

#### 🔧 Advanced: Scaling for Production

สำหรับการใช้งานจริงที่มีผู้ใช้จำนวนมาก แนะนำให้:

1. **Redis Adapter** - สำหรับ horizontal scaling:
   ```bash
   npm install @socket.io/redis-adapter redis
   ```

2. **Dedicated TURN Server** - ติดตั้ง Coturn บน VPS:
   ```bash
   sudo apt install coturn
   ```

3. **PM2 Clustering** - รัน multiple instances:
   ```bash
   npm install -g pm2
   pm2 start server.js -i max
   ```

4. **Nginx Reverse Proxy** - Load balancing และ SSL termination

## 🛡 การรักษาความปลอดภัยและความเป็นส่วนตัว

- **No Storage**: เซิร์ฟเวอร์ทำหน้าที่เป็นเพียงทางผ่าน (Signaling/Relay) ข้อมูลไฟล์จะไม่ถูกเขียนลง Disk ของเซิร์ฟเวอร์
- **Local Encryption**: กุญแจเข้ารหัส (Secret Key) ถูกสร้างขึ้นใหม่ทุกครั้งที่มีการเชื่อมต่อและไม่เคยถูกส่งไปยังเซิร์ฟเวอร์
- **Identity Privacy**: ไม่มีการเก็บข้อมูลส่วนตัว ใช้เพียงชื่อสุ่มและไอคอนรูปสัตว์
- **Rate Limiting**: ป้องกัน abuse และ DDoS attacks
- **Payload Validation**: ตรวจสอบข้อมูลที่ส่งเข้ามาทั้งหมด

## 🎯 Performance Features

- **Adaptive Chunking**: ปรับขนาด chunk อัตโนมัติตามสภาพเครือข่าย (16KB-128KB)
- **Backpressure Management**: ป้องกัน memory overflow ด้วยการจัดการ buffer
- **Stream Processing**: ใช้ StreamSaver.js สำหรับไฟล์ขนาดใหญ่ (>50MB)
- **Web Workers**: ประมวลผลการบีบอัดและเข้ารหัสแยกจาก main thread
- **Connection Monitoring**: ตรวจสอบคุณภาพการเชื่อมต่อและเลือก transfer mode อัตโนมัติ

## 📊 System Architecture

```
┌─────────────┐         WebRTC P2P          ┌─────────────┐
│   Client A  │◄──────────────────────────►│   Client B  │
└──────┬──────┘                             └──────┬──────┘
       │                                           │
       │         Socket.IO Signaling               │
       └──────────────┬───────────────────────────┘
                      │
              ┌───────▼────────┐
              │  PurrDrop      │
              │  Server        │
              │  (Stateless)   │
              └────────────────┘
                      │
              ┌───────▼────────┐
              │  Redis         │  (Optional)
              │  (State Store) │
              └────────────────┘
```

## 🤝 Contributing

ยินดีรับ Pull Requests! สำหรับการเปลี่ยนแปลงใหญ่ กรุณาเปิด Issue เพื่อหารือก่อน

## 📄 ใบอนุญาต

โปรเจคนี้อยู่ภายใต้ใบอนุญาต [MIT License](LICENSE) 

---

**สร้างด้วย ❤️ เพื่อการส่งไฟล์ที่อิสระและปลอดภัยที่สุด**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)