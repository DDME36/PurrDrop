# 🚀 วิธี Deploy PurrDrop

## 📋 สิ่งที่ต้องมี

- Node.js 18+
- Git
- บัญชี GitHub

---

## ขั้นตอนที่ 1: สร้าง GitHub Repository

### 1.1 สร้าง repo ใหม่บน GitHub

1. ไปที่ https://github.com/new
2. ตั้งชื่อ repo เช่น `purrdrop`
3. เลือก **Public** (ฟรี)
4. กด **Create repository**

### 1.2 Push โค้ดขึ้น GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/purrdrop.git
git push -u origin main
```

---

## ขั้นตอนที่ 2: เลือกวิธี Deploy

### Option A: Railway (แนะนำ)

1. ไปที่ https://railway.app
2. Login ด้วย GitHub
3. กด **New Project** → **Deploy from GitHub repo**
4. เลือก repo `purrdrop`
5. ไปที่ **Settings** → **Networking** → **Generate Domain**
6. รอ deploy เสร็จ (~2-3 นาที)

**Free Tier:** $5 credit/เดือน (~500 ชั่วโมง)

### Option B: Render (ฟรีตลอด - แนะนำสุด)

1. ไปที่ https://render.com
2. สร้าง **Web Service** จาก GitHub repo
3. ตั้งค่า:
   - Environment: `Node`
   - Build Command: `bun install && bun run build`
   - Start Command: `bun run start`
   - **Environment Variables**:
     - `BUN_VERSION`: `1.2.2` (หรือเวอร์ชันล่าสุด)
4. เลือก **Free** tier

**ข้อดี:** เซิร์ฟเวอร์ตื่นเร็วมากเมื่อใช้ Bun แทน Node.js ทั่วไป (แก้ปัญหา Cold start ของโฮสต์ฟรี)

### Option C: VPS / Self-hosted

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/purrdrop.git
cd purrdrop

# Install dependencies with Bun
bun install

# Build
bun run build

# Run with PM2 (production)
npm install -g pm2
pm2 start "bun run start" --name "purrdrop"

# หรือรันตรงๆ
bun run start
```

**ตั้งค่า Nginx (optional):**

```nginx
server {
    listen 80;
    server_name purrdrop.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## ขั้นตอนที่ 3: ใช้งาน Local Network

ถ้าต้องการใช้งานใน Local Network เท่านั้น:

```bash
# รัน development server
bun run dev

# หรือ production
bun run build && bun run start
```

เปิด URL ที่แสดงในอุปกรณ์อื่นๆ ใน Wi-Fi เดียวกัน:

```
http://192.168.x.x:3000
```

---

## 🔧 Environment Variables (Optional)

| Variable   | Default     | Description              |
| ---------- | ----------- | ------------------------ |
| `PORT`     | 3000        | Port ที่ server รัน      |
| `NODE_ENV` | development | production สำหรับ deploy |

---

## ✨ Features

- ✅ ส่งไฟล์ผ่าน WebRTC (P2P)
- ✅ รองรับหลายไฟล์ (auto ZIP)
- ✅ Dark Mode
- ✅ ประวัติการส่งไฟล์
- ✅ Push Notification
- ✅ PWA (ติดตั้งเป็น App ได้)
- ✅ Retry เมื่อส่งไม่สำเร็จ
- ✅ รองรับ iOS Safari

---

## 🔧 Troubleshooting

### Deploy ไม่ผ่าน?

- เช็คว่า push โค้ดขึ้น GitHub ครบ
- ดู logs ใน dashboard

### เชื่อมต่อไม่ได้?

- ตรวจสอบว่าอุปกรณ์ทั้งสองเปิด URL เดียวกัน
- ลอง refresh หน้าเว็บ
- ตรวจสอบว่าอยู่ใน network เดียวกัน

### ส่งไฟล์ไม่ได้?

- WebRTC ต้องการ HTTPS (ยกเว้น localhost)
- ถ้าอยู่คนละ network อาจต้องใช้ TURN server
- ลองรีเฟรชทั้งสองเครื่อง

### Dark Mode ไม่ทำงาน?

- ลอง hard refresh (Ctrl+Shift+R)
- เคลียร์ cache ของ browser

---

## 📱 การใช้งาน

1. เปิด URL ในอุปกรณ์ที่ 1
2. เปิด URL เดียวกันในอุปกรณ์ที่ 2
3. จะเห็นอุปกรณ์ของอีกเครื่องปรากฏขึ้น
4. คลิกที่การ์ดแล้วเลือกไฟล์ที่จะส่ง (หรือลากไฟล์มาวาง)
5. อีกเครื่องกด "รับเลย!"
6. ไฟล์จะถูกส่งผ่าน WebRTC โดยตรง!

---

## 📄 License

MIT License
