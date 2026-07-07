import { NextResponse } from 'next/server';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Simple in-memory rate store: Map<IP, Timestamp[]>
const rateLimitStore = new Map<string, number[]>();

export async function POST(req: Request) {
  try {
    if (!DISCORD_WEBHOOK_URL) {
      console.error('DISCORD_WEBHOOK_URL not configured');
      return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 });
    }

    // Rate Limiting Logic
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const limit = 3; // 3 requests per minute

    const timestamps = rateLimitStore.get(ip) || [];
    // Filter out old timestamps
    const recentRequests = timestamps.filter(time => now - time < windowMs);

    if (recentRequests.length >= limit) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Update store
    recentRequests.push(now);
    rateLimitStore.set(ip, recentRequests);

    const formData = await req.formData();
    const rating = formData.get('rating');
    const message = formData.get('message');
    const device = formData.get('device');
    const file = formData.get('file') as File | null;

    // Validate input
    if ((!message || !message.toString().trim()) && (!rating || Number(rating) < 1)) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const stars = rating ? '⭐'.repeat(Number(rating)) : 'ไม่ได้ให้คะแนน';

    // Construct Embed
    const embed = {
      title: '💬 Feedback ใหม่จาก PurrDrop',
      color: 0xff6b9d,
      fields: [
        { name: '⭐ Rating', value: stars, inline: true },
        { name: '📱 Device', value: device?.toString() || 'Unknown', inline: true },
        { name: '💬 ข้อความ', value: message?.toString() || '-' },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'PurrDrop Feedback System' }
    };

    const discordPayload = new FormData();
    discordPayload.append('payload_json', JSON.stringify({ embeds: [embed] }));

    if (file) {
      discordPayload.append('file', file);
    }

    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      body: discordPayload,
    });

    if (!res.ok) {
      console.error('Discord webhook failed:', res.status, await res.text());
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback API error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
