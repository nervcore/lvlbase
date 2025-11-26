import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from './providers';

const inter = Inter({ subsets: ["latin"] });

// --- KONFIGURASI UNTUK FARCASTER / WARPCAST ---
// GANTI URL DI BAWAH INI DENGAN DOMAIN VERCEL ASLI KAMU!
const APP_URL = "https://lvlbase.vercel.app"; // <--- GANTI INI!

export const metadata: Metadata = {
  title: "LvLBASE",
  description: "The Ultimate Onchain Fishing & Social Game",
  // Metadata Standar untuk Preview Link (Twitter/Discord/Warpcast)
  openGraph: {
    title: "LvLBASE - Fishing Game",
    description: "Catch fish, earn XP, and climb the ocean hierarchy.",
    images: ["https://scontent-iad4-1.choicecdn.com/-/rs:fill:2000:2000/g:ce/f:webp/aHR0cHM6Ly9zY29udGVudC1pYWQ0LTEuY2hvaWNlY2RuLmNvbS8tL3JzOmZpdDoyNDAwOjI0MDAvZjpiZXN0L2FIUjBjSE02THk5dFlXZHBZeTVrWldObGJuUnlZV3hwZW1Wa0xXTnZiblJsYm5RdVkyOXRMMmx3Wm5NdlltRm1lV0psYVdWa1oyWnZjMkprYjJKdFpta3lhSFZ6ZVdJMmIyZHJkamRvWTNSNGNXWndkelV6YVRKbGMyRmlhbmMwWjJreWRYVndZM0U9"],
  },
  // Metadata KHUSUS untuk Tombol Launch di Farcaster
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://scontent-iad4-1.choicecdn.com/-/rs:fill:2000:2000/g:ce/f:webp/aHR0cHM6Ly9zY29udGVudC1pYWQ0LTEuY2hvaWNlY2RuLmNvbS8tL3JzOmZpdDoyNDAwOjI0MDAvZjpiZXN0L2FIUjBjSE02THk5dFlXZHBZeTVrWldObGJuUnlZV3hwZW1Wa0xXTnZiblJsYm5RdVkyOXRMMmx3Wm5NdlltRm1lV0psYVdWa1oyWnZjMkprYjJKdFpta3lhSFZ6ZVdJMmIyZHJkamRvWTNSNGNXWndkelV6YVRKbGMyRmlhbmMwWjJreWRYVndZM0U9",
      button: {
        title: "🎣 Start Fishing",
        action: {
          type: "launch_frame",
          name: "LvLBASE",
          url: APP_URL, // URL Aplikasi Vercel
          splashImageUrl: "https://scontent-iad4-1.choicecdn.com/-/rs:fill:2000:2000/g:ce/f:webp/aHR0cHM6Ly9zY29udGVudC1pYWQ0LTEuY2hvaWNlY2RuLmNvbS8tL3JzOmZpdDoyNDAwOjI0MDAvZjpiZXN0L2FIUjBjSE02THk5dFlXZHBZeTVrWldObGJuUnlZV3hwZW1Wa0xXTnZiblJsYm5RdVkyOXRMMmx3Wm5NdlltRm1lV0psYVdWa1oyWnZjMkprYjJKdFpta3lhSFZ6ZVdJMmIyZHJkamRvWTNSNGNXWndkelV6YVRKbGMyRmlhbmMwWjJreWRYVndZM0U9",
          splashBackgroundColor: "#000000",
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
