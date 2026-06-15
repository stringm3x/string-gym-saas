import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function InventarioPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/${slug}/inventario/productos`);
}
