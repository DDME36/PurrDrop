# 🐱 PurrDrop

> Cute P2P File Transfer - ส่งไฟล์ง่ายๆ ไม่ต้องลงแอป!

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P-blue)](https://webrtc.org/)

![PurrDrop Demo](https://via.placeholder.com/800x400/ffd3b6/333?text=PurrDrop+Demo)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔗 **WebRTC P2P** | ไฟล์ส่งตรงระหว่าง Browser ไม่ผ่าน Server |
| 📦 **ไม่จำกัดขนาด** | ส่งไฟล์ใหญ่ได้ รองรับ Streaming สำหรับไฟล์ GB |
| 💬 **ส่งข้อความ/ลิงก์** | ส่งข้อความและ URL ได้ พร้อมเก็บประวัติและคัดลอก |
| 🐱 **Cute Characters** | สัตว์น่ารักตาม OS (แก้ไขได้) |
| 🎨 **Dark/Light Mode** | สลับธีมได้ตามใจชอบ |
| 📱 **PWA Support** | ติดตั้งเป็น App บนมือถือได้ |
| 🔔 **Push Notifications** | แจ้งเตือนเมื่อมีไฟล์เข้า |
| 📋 **Transfer History** | เก็บประวัติการส่งไฟล์และข้อความ 50 รายการ |
| 🗜️ **Smart ZIP** | รวมหลายไฟล์เป็น ZIP อัตโนมัติ (รองรับ folder structure) |
| 📶 **QR Code** | สแกน QR เข้าห้องได้ทันที |
| 🛡️ **Error Boundary** | จัดการ crash ด้วยหน้า Error น่ารักๆ |
| 📡 **Offline Detection** | แจ้งเตือนเมื่อเน็ตหลุด/กลับมา |
| 🔍 **SEO Optimized** | OpenGraph และ Twitter Cards สำหรับแชร์ลิงก์ |
| ⌨️ **Keyboard Navigation** | รองรับการใช้งานด้วยคีย์บอร์ด |

## 🔐 Discovery Modes

| Mode | Icon | Description |
|------|------|-------------|
| **Public** | 🌐 | เห็นทุกคนที่ใช้งาน |
| **WiFi** | 📶 | เห็นเฉพาะคนที่มี Public IP เดียวกัน |
| **Private** | 🔐 | เห็นเฉพาะคนที่มีรหัสห้อง + password |

## � Security Model

### ✅ สิ่งที่ปลอดภัย
- **ไฟล์ไม่ผ่าน Server** - ส่งตรง P2P ระหว่าง browsers
- **WebRTC มี DTLS encryption** - ข้อมูลเข้ารหัสระหว่างทาง
- **Private mode** - ใช้รหัสห้อง 5 หลัก + password (optional)
- **Server เห็นแค่ metadata** - ชื่อ, device type, IP (สำหรับ matching)

### ⚠️ ข้อควรระวัง
- **Public mode** - ทุกคนที่เปิดเว็บจะเห็นคุณ
- **WiFi mode บน Cloud** - ใช้ Public IP matching ซึ่งอาจไม่แม่นยำ 100%
- **ไม่มี E2E encryption เพิ่มเติม** - พึ่ง DTLS ของ WebRTC

## ⚡ Known Limitations

| ข้อจำกัด | สาเหตุ | วิธีแก้ |
|---------|--------|--------|
| **WiFi mode อาจเห็นคนผิด** | ISP บางเจ้าใช้ CGNAT (IP ซ้ำกัน) | ใช้ Private mode แทน |
| **ส่งไฟล์ข้าม network ไม่ได้** | NAT บางประเภทบล็อก WebRTC | ใช้ WiFi เดียวกัน หรือ hotspot |
| **iOS Safari download** | ไม่รองรับ download attribute | เปิด tab ใหม่ให้ save เอง |
| **VPN ทำให้ไม่เจอกัน** | IP เปลี่ยน | ปิด VPN หรือใช้ Private mode |

## 🚀 Quick Start

**ต้องติดตั้ง Bun ก่อน:** https://bun.sh

```bash
# Clone
git clone https://github.com/DDME36/PurrDrop.git
cd PurrDrop

# Install
bun install

# Development
bun run dev

# Production build
bun run build
bun start
```

เปิด http://localhost:3000

## 🌐 Deploy

### Render (แนะนำ - Free Tier)
1. Fork repo นี้
2. สร้าง Web Service ใหม่บน [Render](https://render.com)
3. เชื่อมต่อ GitHub repo
4. ตั้งค่า:
   - Build Command: `bun install && bun run build`
   - Start Command: `bun start`
   - Environment: Node

Render จะ auto-deploy ทุกครั้งที่ push ไป GitHub!

## 🐾 Characters by OS

| OS | Emoji | Name |
|----|-------|------|
| iOS/macOS | 🐱 | Shuba |
| iPadOS | 🦔 | Spike |
| Windows | 🐼 | Mochi |
| Android | 🐰 | Loppy |
| Linux | 🦉 | Hoot |
| Unknown | 🦊 | Foxy |

## 📱 How to Use

### ส่งไฟล์
1. **เปิดเว็บ** บนอุปกรณ์ที่ 1
2. **เปิดเว็บเดียวกัน** บนอุปกรณ์ที่ 2
3. **เลือกโหมด** (Public/WiFi/Private)
4. **คลิกที่ตัวละคร** ของเพื่อน → เลือกไฟล์
5. **อีกเครื่องกด** "รับเลย!" 🎉

### ส่งข้อความ/ลิงก์
1. **กดปุ่ม 📄** (Floating button ล่างขวา)
2. **พิมพ์ข้อความ** หรือวาง URL
3. **เลือกเพื่อน** ที่จะส่งให้
4. **กดส่ง** - ข้อความจะถูกเก็บในประวัติพร้อมปุ่มคัดลอก

### ดูประวัติ
- **กดไอคอน 📋** ที่มุมขวาบน
- **ดูข้อความย้อนหลัง** และคัดลอกได้ทันที
- **ดูไฟล์ที่ส่ง/รับ** ทั้งหมด

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **Runtime**: Bun (fast JavaScript runtime)
- **Real-time**: Socket.io (signaling)
- **Transfer**: WebRTC DataChannel (P2P)
- **PWA**: Service Worker

## 📊 Architecture

```
┌─────────────┐     Socket.io      ┌─────────────┐
│   User A    │◄──────────────────►│   Server    │
│  (Browser)  │    (Signaling)     │  (Render)   │
└──────┬──────┘                    └─────────────┘
       │                                  
       │         WebRTC (P2P)             
       │◄────────────────────────────────►
       │                                  
┌──────▼──────┐                    
│   User B    │                    
│  (Browser)  │                    
└─────────────┘                    
```

**Note**: ไฟล์ส่งตรง P2P ไม่ผ่าน Server!

## 🔒 Security

- WebRTC มี DTLS encryption ในตัว
- Private mode ใช้รหัสห้อง 5 หลัก + password (optional)
- ไม่เก็บไฟล์บน server

## 📝 License

[MIT](./LICENSE)

## 🤝 Contributing

Pull requests are welcome! 

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

Made with 🐱 by [DDME36](https://github.com/DDME36)
