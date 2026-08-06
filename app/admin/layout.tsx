import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Admin Gyms",
    template: "%s | Admin Gyms",
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
