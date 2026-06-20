import type { NextConfig } from "next";

/**
 * Permite servir logos de gym desde Supabase Storage vía next/image.
 * El hostname se deriva de NEXT_PUBLIC_SUPABASE_URL para no hardcodearlo.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
