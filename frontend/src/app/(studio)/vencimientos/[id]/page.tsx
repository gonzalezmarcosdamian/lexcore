"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function VencimientoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/movimientos/${id}`); }, [id, router]);
  return null;
}
