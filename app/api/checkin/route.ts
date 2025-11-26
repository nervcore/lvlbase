import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// Inisialisasi Client Blockchain (Base)
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export async function POST(request: Request) {
  try {
    const { address, signature, message, referrer } = await request.json();

    // -------------------------------------------------------------------------
    // 1. VERIFIKASI TANDA TANGAN (KEAMANAN)
    // -------------------------------------------------------------------------
    const valid = await publicClient.verifyMessage({
      address,
      message,
      signature,
    });

    if (!valid) {
      return NextResponse.json({ error: 'Signature invalid!' }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // 2. CEK USER DI DATABASE
    // -------------------------------------------------------------------------
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', address)
      .single();

    // -------------------------------------------------------------------------
    // SKENARIO A: USER BARU (REGISTER)
    // -------------------------------------------------------------------------
    if (!user) {
      console.log("New User Detected! Referrer:", referrer);
      
      let finalReferrer = null;

      // Logika Referral: Beri Bonus ke Pengundang
      if (referrer && referrer !== address) {
        const { data: refUser } = await supabase
          .from('users')
          .select('wallet_address, xp, referral_count, bait')
          .eq('wallet_address', referrer)
          .single();

        if (refUser) {
          finalReferrer = referrer;
          
          // BONUS KE PENGUNDANG: +50 XP & +2 BAIT
          await supabase.from('users').update({
            xp: (refUser.xp || 0) + 50,
            bait: (refUser.bait || 0) + 2,
            referral_count: (refUser.referral_count || 0) + 1
          }).eq('wallet_address', referrer);
        }
      }

      // Buat User Baru
      // Modal Awal: 5 Bait (dari default DB) + 3 Bait (Bonus Login Hari Pertama) = 8 Bait
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{ 
          wallet_address: address, 
          xp: 20,                 // XP Awal
          level: 1, 
          current_streak: 1, 
          total_login_days: 1, 
          last_checkin: new Date().toISOString(),
          referrer_address: finalReferrer,
          bait: 8                 // Modal Awal + Daily Bonus
        }])
        .select()
        .single();
      
      if (createError) throw createError;

      // Catat Log Kalender
      const todayDate = new Date().toISOString().split('T')[0];
      try {
        await supabase.from('checkin_logs').insert([
            { wallet_address: address, checkin_date: todayDate }
        ]);
      } catch (e) { console.log("Log insert error:", e); }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Welcome! +20 XP & +3 Bait', 
        user: newUser 
      });
    }

    // -------------------------------------------------------------------------
    // SKENARIO B: USER LAMA (DAILY CHECK-IN)
    // -------------------------------------------------------------------------
    
    // Cek apakah sudah absen hari ini
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const lastCheckin = user.last_checkin ? new Date(user.last_checkin).toISOString().split('T')[0] : null;
    
    if (lastCheckin === todayDate) {
      return NextResponse.json({ 
        success: false, 
        message: 'Kamu sudah absen hari ini! Kembali besok.', 
        user 
      });
    }

    // Hitung Streak
    const oneDay = 24 * 60 * 60 * 1000;
    const lastDateObj = user.last_checkin ? new Date(user.last_checkin) : new Date(0);
    const diff = now.getTime() - lastDateObj.getTime();
    
    let newStreak = 1;
    // Jika login kemarin atau hari ini (toleransi < 48 jam), streak lanjut
    if (lastCheckin && diff < 2 * oneDay && diff > 0) {
      newStreak = user.current_streak + 1;
    }

    // Update Data
    const newTotalDays = (user.total_login_days || 0) + 1;
    const newXP = (user.xp || 0) + 20;      // Reward XP
    const newBait = (user.bait || 0) + 3;   // Reward Bait (+3 Umpan)

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        last_checkin: now.toISOString(),
        current_streak: newStreak,
        total_login_days: newTotalDays,
        xp: newXP,
        bait: newBait
      })
      .eq('wallet_address', address)
      .select()
      .single();

    if (updateError) throw updateError;

    // Catat Log Kalender
    try {
      await supabase.from('checkin_logs').insert([
        { wallet_address: address, checkin_date: todayDate }
      ]);
    } catch (logError) {
      // Abaikan jika duplikat log
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Absen Berhasil! +20 XP & +3 Bait', 
      user: updatedUser 
    });

  } catch (err: any) {
    console.error("Backend Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}