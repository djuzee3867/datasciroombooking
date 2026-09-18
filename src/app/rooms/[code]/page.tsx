import { RoomDetail } from "./RoomDetail";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomDetail code={decodeURIComponent(code)} />;
}
