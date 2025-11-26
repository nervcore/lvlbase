import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// --- KONFIGURASI ---
// Pastikan ini SAMA PERSIS dengan yang di app/page.tsx
const DEV_WALLET = "0x09fa94d76E8d974cdd2B12ba1E3959CFd5447EfA"; 

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export async function POST(request: Request) {
  try {
    const { address, txHash } = await request.json();

    if (!txHash || !address) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' });
    }

    // -------------------------------------------------------------------------
    // 1. CEK BATAS HARIAN (PENTING: INI YANG KURANG SEBELUMNYA)
    // -------------------------------------------------------------------------
    const { data: user } = await supabase
      .from('users')
      .select('bait, last_claim_supply')
      .eq('wallet_address', address)
      .single();

    if (!user) {
        return NextResponse.json({ success: false, message: 'User tidak ditemukan' });
    }

    const now = new Date();
    const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const lastClaimDate = user.last_claim_supply ? new Date(user.last_claim_supply).toISOString().split('T')[0] : null;

    if (lastClaimDate === todayDate) {
        return NextResponse.json({ success: false, message: '❌ Gagal: Kamu sudah klaim hari ini! Kembali besok.' });
    }

    // -------------------------------------------------------------------------
    // 2. CEK APAKAH HASH INI SUDAH PERNAH DIPAKAI? (Anti-Replay)
    // -------------------------------------------------------------------------
    const { data: existingTx } = await supabase
      .from('processed_txs')
      .select('*')
      .eq('tx_hash', txHash)
      .single();

    if (existingTx) {
      return NextResponse.json({ success: false, message: '❌ Gagal: Hash transaksi ini sudah pernah dipakai!' });
    }

    // -------------------------------------------------------------------------
    // 3. VERIFIKASI KE BLOCKCHAIN
    // -------------------------------------------------------------------------
    const transaction = await publicClient.waitForTransactionReceipt({ 
      hash: txHash 
    });

    // Cek Status Sukses
    if (transaction.status !== 'success') {
      return NextResponse.json({ success: false, message: '❌ Transaksi Gagal di Blockchain' });
    }

    // Cek Penerima (Longgarkan sedikit untuk Smart Wallet, tapi tetap warning kalau beda jauh)
    // Kita log saja jika beda, tapi tetap loloskan untuk MVP Smart Wallet
    if (transaction.to && transaction.to.toLowerCase() !== DEV_WALLET.toLowerCase()) {
       console.warn(`[Warning] Claim dari ${address} masuk ke ${transaction.to} bukan DEV_WALLET. (Smart Wallet Proxy?)`);
       // Jika kamu mau strict, uncomment baris di bawah:
       // return NextResponse.json({ success: false, message: 'Salah Alamat!' });
    }

    // -------------------------------------------------------------------------
    // 4. UPDATE DATABASE (BERI HADIAH + CATAT TANGGAL)
    // -------------------------------------------------------------------------
    const newBait = (user.bait || 0) + 10;

    // Update bait DAN last_claim_supply agar tidak bisa klaim lagi hari ini
    await supabase.from('users').update({ 
        bait: newBait,
        last_claim_supply: now.toISOString() 
    }).eq('wallet_address', address);

    // Catat Hash agar tidak bisa dipakai lagi
    await supabase.from('processed_txs').insert([{ tx_hash: txHash, wallet_address: address }]);

    return NextResponse.json({ success: true, message: '✅ Supply Received! +10 Bait', new_bait: newBait });

  } catch (err: any) {
    console.error("Transaction Error:", err);
    return NextResponse.json({ error: "Verifikasi Gagal. Coba lagi." }, { status: 500 });
  }
}