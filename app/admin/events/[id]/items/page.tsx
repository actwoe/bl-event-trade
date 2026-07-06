import { redirect } from 'next/navigation';

type AdminEventItemsRedirectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminEventItemsRedirectPage({
  params,
}: AdminEventItemsRedirectPageProps) {
  const { id } = await params;

  redirect(`/admin/events/${id}`);
}