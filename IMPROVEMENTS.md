# 🎯 PurrDrop - สิ่งที่ปรับปรุงแล้ว

## วิธีทดสอบการเปลี่ยนแปลง

### 1. ♿ Reduced Motion (Accessibility)

**วิธีทดสอบ:**
1. เปิด Chrome DevTools (F12)
2. กด `Ctrl + Shift + P` (Windows) หรือ `Cmd + Shift + P` (Mac)
3. พิมพ์ "reduced motion"
4. เลือก "Emulate CSS prefers-reduced-motion: reduce"
5. Refresh หน้า

**ผลลัพธ์ที่คาดหวัง:**
- ✅ Background gradient หยุดเคลื่อนไหว
- ✅ Floating shapes หยุดลอย (opacity ลดลง)
- ✅ Clouds หยุดเคลื่อนไหว
- ✅ Sparkles หยุดกระพริบ
- ✅ Logo wave animation หยุด
- ✅ ทุก transition/animation เร็วมาก (0.01ms)

---

### 2. 🎨 CSS Variables - Border Radius

**วิธีทดสอบ:**
1. เปิด DevTools Console
2. พิมพ์:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--radius-pill')
```

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดง "50px" (เพิ่ม CSS variable ใหม่)

---

### 3. 🌙 Dark Mode - Complete Colors

**วิธีทดสอบ:**
1. กดปุ่ม theme toggle (ดวงจันทร์/ดวงอาทิตย์) มุมขวาบน
2. เปิด DevTools Console พิมพ์:
```javascript
// ดู status colors
getComputedStyle(document.documentElement).getPropertyValue('--status-error')
getComputedStyle(document.documentElement).getPropertyValue('--status-warning')
getComputedStyle(document.documentElement).getPropertyValue('--status-success')

// ดู transfer colors
getComputedStyle(document.documentElement).getPropertyValue('--transfer-filename')
getComputedStyle(document.documentElement).getPropertyValue('--transfer-status')
getComputedStyle(document.documentElement).getPropertyValue('--transfer-track')
```

**ผลลัพธ์ที่คาดหวัง:**
- ✅ Light mode: แสดงสีแดง, เหลือง, เขียว
- ✅ Dark mode: แสดงสีที่เหมาะสมกับพื้นหลังมืด

---

### 4. 🧹 CSS Cleanup - ลบ Duplicate

**วิธีทดสอบ:**
1. เปิดไฟล์ `src/app/globals.css`
2. ค้นหา `@keyframes logoWave`
3. ค้นหา `@keyframes shimmer`

**ผลลัพธ์ที่คาดหวัง:**
- ✅ มี `@keyframes logoWave` เพียง 1 ตัว (ไม่ซ้ำ)
- ✅ ไม่มี `@keyframes shimmer` (ลบออกแล้ว - dead code)
- ✅ ไม่มี duplicate `.logo`, `.logo-text`, `.logo-char`

---

### 5. 🔒 Server - Max Peers Limit

**วิธีทดสอบ:**
1. เปิด DevTools Console
2. ดู Network tab → WS (WebSocket)
3. ดู Messages

**ผลลัพธ์ที่คาดหวัง:**
- ✅ ถ้ามี peers > 100 จะเห็น event `server-full`
- ✅ Server จะ disconnect ทันที

---

### 6. 📊 Server - Extended Health Check

**วิธีทดสอบ:**
1. เปิด browser ไปที่ http://localhost:3000/health
2. หรือใน Console:
```javascript
fetch('/health').then(r => r.json()).then(console.log)
```

**ผลลัพธ์ที่คาดหวัง:**
```json
{
  "status": "ok",
  "uptime": 123.456,
  "memory": {
    "rss": 123456789,
    "heapTotal": 12345678,
    "heapUsed": 1234567,
    "external": 123456,
    "arrayBuffers": 12345
  },
  "peers": 0,
  "rooms": 0,
  "timestamp": "2025-03-20T..."
}
```

---

### 7. 🛡️ Server - Input Validation

**วิธีทดสอบ:** (ต้องมี 2 เครื่อง)
1. เปิด 2 tabs/browsers
2. ลองส่งข้อความขนาด > 1MB
3. ลองส่งไฟล์ผ่าน relay > 100MB

**ผลลัพธ์ที่คาดหวัง:**
- ✅ ข้อความ > 1MB จะถูกปฏิเสธ
- ✅ ไฟล์ relay > 100MB จะถูกปฏิเสธ
- ✅ เห็น error message ที่เหมาะสม

---

### 8. 🌐 Server - WiFi Mode IP Fix

**วิธีทดสอบ:** (ต้อง deploy บน Render)
1. Deploy ไป Render
2. เปิด 2 เครื่องในเครือข่ายเดียวกัน
3. เลือก WiFi mode

**ผลลัพธ์ที่คาดหวัง:**
- ✅ ใช้ `x-forwarded-for` header แทน `socket.handshake.address`
- ✅ เห็นกันได้ถูกต้องในเครือข่ายเดียวกัน

---

### 9. 🔄 Server - Graceful Shutdown

**วิธีทดสอบ:**
1. รัน server ใน terminal
2. กด `Ctrl + C`

**ผลลัพธ์ที่คาดหวัง:**
```
⚠️ SIGTERM received, shutting down gracefully...
✅ Server closed
```
- ✅ Server ส่ง `server-shutdown` event ให้ clients
- ✅ รอ 10 วินาทีก่อน force shutdown

---

### 10. 📱 iOS Detection Fix

**วิธีทดสอบ:**
1. เปิด DevTools
2. เปลี่ยนเป็น iPad mode (Responsive Design Mode)
3. เปิด Console พิมพ์:
```javascript
// Simulate iPad
Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
// Reload page
```

**ผลลัพธ์ที่คาดหวัง:**
- ✅ ตรวจจับ iPad ได้ถูกต้อง (แม้ว่า UA จะบอกว่าเป็น Mac)
- ✅ ไม่ force relay mode (ให้ลอง WebRTC ก่อน)

---

## 📝 สรุปการปรับปรุง

### Server (8 จุด)
- ✅ Next.js standalone output
- ✅ WiFi mode IP fix (x-forwarded-for)
- ✅ CORS restriction (ALLOWED_ORIGINS)
- ✅ Relay file size limit (100MB)
- ✅ Max peers limit (100)
- ✅ Graceful shutdown (SIGTERM)
- ✅ Extended health check
- ✅ Input validation (text 1MB, relay 100MB)

### CSS/UI (5 จุด)
- ✅ prefers-reduced-motion support
- ✅ ลบ duplicate selectors (logoWave, logo, shimmer)
- ✅ เพิ่ม CSS variables (--radius-pill, --status-*, --transfer-*)
- ✅ Dark mode colors complete
- ✅ iOS/iPad detection fix

### Config (3 จุด)
- ✅ render.yaml blueprint
- ✅ Bun optimized
- ✅ README updated

**รวม: 16 การปรับปรุง**


---

## 🐛 Bug Fixes - File Transfer Issues

### Issue: iPhone → Windows file transfer stuck at 0%

**Root Cause:**
1. iOS was forced to use Relay mode (in `deviceDetection.ts`)
2. iPhone sent 146MB video file via relay
3. Server rejected it (> 100MB limit) and sent `relay-error` back
4. iPhone had no `relay-error` handler, continued sending chunks blindly
5. Server never forwarded `relay-start` to Windows
6. Windows received `relay-end` but had no receiving file entry → error

**Fixes Applied:**

1. ✅ **Changed iOS to try WebRTC first** (`deviceDetection.ts`)
   - Removed forced relay mode for iOS
   - Only use relay for browsers that truly don't support WebRTC
   - Or for very slow connections (2g, slow-2g)

2. ✅ **Increased MAX_RELAY_SIZE** (`server.ts`)
   - Changed from 100MB → 500MB
   - Safe because server uses streaming (forward immediately, no memory storage)
   - Chunks are forwarded instantly and garbage collected

3. ✅ **Added relay-error handler** (`usePeerConnection.ts`)
   - Client now listens for `relay-error` event from server
   - Stops sending chunks immediately when error received
   - Cleans up pending files and receiving files
   - Shows error message to user
   - Releases wake lock

4. ✅ **Fixed server.ts syntax error**
   - Removed duplicate closing braces in relay-chunk handler
   - Fixed TypeScript type for file-offer event

**Testing:**
1. Send large video file (>100MB) from iPhone to Windows
2. Should now use WebRTC (P2P) instead of relay
3. If relay is needed, files up to 500MB are supported
4. If file is too large, user sees clear error message

**Expected Behavior:**
- 80-90% of transfers use WebRTC (P2P, unlimited size)
- 10-20% use relay fallback (up to 500MB)
- Files > 500MB show error: "ไฟล์ใหญ่เกินไปสำหรับ relay (สูงสุด 500MB)"
