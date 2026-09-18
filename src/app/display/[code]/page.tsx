import { RoomDisplay } from "./RoomDisplay";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomDisplay code={decodeURIComponent(code)} />;
}
