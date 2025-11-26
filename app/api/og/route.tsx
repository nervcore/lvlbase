import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Ambil data dari URL (contoh: ?level=5&streak=7)
    const level = searchParams.get('level') || '1';
    const streak = searchParams.get('streak') || '1';
    const xp = searchParams.get('xp') || '0';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            backgroundImage: 'linear-gradient(to bottom right, #111827, #000000)',
            fontFamily: 'sans-serif',
            color: 'white',
            position: 'relative',
          }}
        >
          {/* Background Glow */}
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '400px', height: '400px', background: '#2563EB', filter: 'blur(100px)', opacity: 0.3, borderRadius: '50%' }}></div>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
             <h1 style={{ fontSize: 60, fontWeight: 'bold', color: '#3B82F6', margin: 0 }}>LvLBASE</h1>
          </div>

          {/* Stats Box */}
          <div style={{ display: 'flex', gap: '40px', padding: '40px', border: '2px solid #374151', borderRadius: '20px', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 24, color: '#9CA3AF' }}>LEVEL</span>
              <span style={{ fontSize: 64, fontWeight: 'bold' }}>{level}</span>
            </div>
            <div style={{ width: '2px', height: '100px', background: '#374151' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 24, color: '#F59E0B' }}>STREAK</span>
              <span style={{ fontSize: 64, fontWeight: 'bold' }}>{streak}🔥</span>
            </div>
            <div style={{ width: '2px', height: '100px', background: '#374151' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 24, color: '#9CA3AF' }}>XP</span>
              <span style={{ fontSize: 64, fontWeight: 'bold' }}>{xp}</span>
            </div>
          </div>

          {/* CTA Button Visual */}
          <div style={{ marginTop: '50px', backgroundColor: '#2563EB', padding: '15px 40px', borderRadius: '50px', display: 'flex' }}>
            <span style={{ fontSize: 30, fontWeight: 'bold', color: 'white' }}>JOIN MY SQUAD 🚀</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e: any) {
    return new Response(`Failed to generate image`, { status: 500 });
  }
}