import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    // 1. Ambil data user
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', address)
      .single();

    if (!user) return NextResponse.json({ success: false, message: 'User not found' });

    // 2. Cek Syarat: Streak Minimal 7 Hari
    if (user.current_streak < 7) {
      return NextResponse.json({ success: false, message: 'Streak belum cukup (Min. 7 Hari)' });
    }

    // 3. Cek apakah minggu ini sudah klaim?
    // Logika: Cek selisih waktu klaim terakhir dengan sekarang > 7 hari
    const now = new Date();
    const lastClaim = user.last_weekly_claim ? new Date(user.last_weekly_claim) : new Date(0); // Kalau null anggap tahun 1970
    
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const diff = now.getTime() - lastClaim.getTime();

    if (diff < oneWeek) {
      return NextResponse.json({ success: false, message: 'Hadiah mingguan sudah diklaim!' });
    }

    // 4. Beri Hadiah Massive (+100 XP)
    const newXP = user.xp + 100;
    
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ 
        xp: newXP,
        last_weekly_claim: now.toISOString()
      })
      .eq('wallet_address', address)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Weekly Reward Claimed! +100 XP', user: updatedUser });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}