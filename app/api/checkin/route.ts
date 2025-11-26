import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// Inisialisasi Client Blockchain (Base) untuk verifikasi tanda tangan
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export async function POST(request: Request) {
  try {
    // Ambil data dari body request frontend
    const { address, signature, message, referrer } = await request.json();

    // -------------------------------------------------------------------------
    // 1. VERIFIKASI TANDA TANGAN (WAJIB UNTUK KEAMANAN)
    // -------------------------------------------------------------------------
    // Kita pastikan request ini benar-benar dari pemilik wallet, bukan bot/hacker.
    const valid = await publicClient.verifyMessage({
      address,
      message,
      signature,
    });

    if (!valid) {
      return NextResponse.json({ error: 'Signature invalid! Verification failed.' }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // 2. CEK APAKAH USER SUDAH ADA DI DATABASE?
    // -------------------------------------------------------------------------
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', address)
      .single();

    // -------------------------------------------------------------------------
    // SKENARIO A: USER BARU (REGISTER PERTAMA KALI)
    // -------------------------------------------------------------------------
    if (!user) {
      console.log("New User Detected! Referrer:", referrer);
      
      let finalReferrer = null;

      // Logika Referral: Jika ada referrer & bukan mengundang diri sendiri
      if (referrer && referrer !== address) {
        // Cek validitas referrer di database (harus user asli)
        const { data: refUser } = await supabase
          .from('users')
          .select('wallet_address, xp, referral_count')
          .eq('wallet_address', referrer)
          .single();

        if (refUser) {
          finalReferrer = referrer;
          
          // BONUS XP KE PENGUNDANG (+50 XP)
          // Kita juga update counter referral mereka
          await supabase.from('users').update({
            xp: (refUser.xp || 0) + 50,
            referral_count: (refUser.referral_count || 0) + 1
          }).eq('wallet_address', referrer);
        }
      }

      // Buat User Baru di Database
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{ 
          wallet_address: address, 
          xp: 0, 
          level: 1, 
          current_streak: 1,      // Streak awal 1
          total_login_days: 1,    // Total hari login 1 (Plankton)
          last_checkin: new Date().toISOString(),
          referrer_address: finalReferrer
        }])
        .select()
        .single();
      
      if (createError) throw createError;

      // JANGAN LUPA: Catat juga ke tabel Log Kalender untuk hari pertama
      const todayDate = new Date().toISOString().split('T')[0];
      try {
        await supabase.from('checkin_logs').insert([
            { wallet_address: address, checkin_date: todayDate }
        ]);
      } catch (e) { console.log("Log insert error (minor):", e); }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Welcome! First Sign-in Success! +20 XP', 
        user: newUser 
      });
    }

    // -------------------------------------------------------------------------
    // SKENARIO B: USER LAMA (DAILY CHECK-IN)
    // -------------------------------------------------------------------------
    
    // 3. CEK APAKAH SUDAH ABSEN HARI INI? (Anti-Spam)
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const lastCheckin = user.last_checkin ? new Date(user.last_checkin).toISOString().split('T')[0] : null;
    
    if (lastCheckin === todayDate) {
      return NextResponse.json({ 
        success: false, 
        message: 'Kamu sudah absen hari ini! Kembali besok.', 
        user 
      });
    }

    // 4. HITUNG STREAK & TOTAL HARI
    const oneDay = 24 * 60 * 60 * 1000;
    const lastDateObj = user.last_checkin ? new Date(user.last_checkin) : new Date(0);
    const diff = now.getTime() - lastDateObj.getTime();
    
    let newStreak = 1; // Default reset ke 1 kalau putus streak
    
    // Jika selisih waktu < 48 jam (artinya login kemarin atau hari ini), streak lanjut
    // Logic: Jika login kemarin jam 23:00 dan sekarang jam 01:00 besoknya, itu masih dianggap streak lanjut
    // Kita beri toleransi sedikit di atas 24 jam (misal < 2 hari kalender)
    if (lastCheckin && diff < 2 * oneDay && diff > 0) {
      newStreak = user.current_streak + 1;
    }

    // Tambah Total Hari Login (Akumulasi seumur hidup untuk Badge Ikan)
    // Ini tidak akan mereset meskipun streak putus
    const newTotalDays = (user.total_login_days || 0) + 1;

    // 5. UPDATE DATABASE
    // Reward Harian: +20 XP
    const newXP = (user.xp || 0) + 20;

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        last_checkin: now.toISOString(),
        current_streak: newStreak,
        total_login_days: newTotalDays,
        xp: newXP
      })
      .eq('wallet_address', address)
      .select()
      .single();

    if (updateError) throw updateError;

    // 6. CATAT KE LOG KALENDER (PENTING UNTUK FITUR KALENDER)
    // Kita pakai try-catch silent di sini, kalau duplicate entry (error unik) biarkan saja
    try {
      await supabase.from('checkin_logs').insert([
        { wallet_address: address, checkin_date: todayDate }
      ]);
    } catch (logError) {
      // Abaikan error jika log hari ini sudah ada (just in case)
      console.log("Log calendar duplicate or error", logError);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Absen Berhasil! +20 XP', 
      user: updatedUser 
    });

  } catch (err: any) {
    console.error("Backend Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}