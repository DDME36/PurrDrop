import { NextResponse } from 'next/server';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function POST(req: Request) {
  try {
    if (!DISCORD_WEBHOOK_URL) {
      console.error('DISCORD_WEBHOOK_URL not configured');
      return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 });
    }

    const { rating, message, device } = await req.json();

    // Validate input
    if (!message?.trim() && (!rating || rating < 1 || rating > 5)) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const stars = rating ? '⭐'.repeat(rating) : 'ไม่ได้ให้คะแนน';
    
    const embed = {
      embeds: [{
        title: '💬 Feedback ใหม่จาก PurrDrop',
        color: 0xff6b9d,
        fields: [
          { name: '⭐ Rating', value: stars, inline: true },
          { name: '📱 Device', value: device || 'Unknown', inline: true },
          { name: '💬 ข้อความ', value: message || '-' },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'PurrDrop Feedback System' }
      }]
    };

    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
    });

    if (!res.ok) {
      console.error('Discord webhook failed:', res.status);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback API error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
