import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFoundingNumberForUser } from "@/lib/founding.functions";
import { FoundingCreatorBadge } from "./FoundingCreatorBadge";

type Props = {
  sellerId: string;
  size?: "sm" | "md";
  className?: string;
};

/** Shows the Founding Creator mark only when the registry has a number for this seller. */
export function StorefrontFoundingBadge({ sellerId, size = "sm", className }: Props) {
  const fetchNumber = useServerFn(getFoundingNumberForUser);
  const { data } = useQuery({
    queryKey: ["founding-number", sellerId],
    queryFn: () => fetchNumber({ data: { userId: sellerId } }),
    staleTime: 10 * 60 * 1000,
  });

  if (!data?.foundingNumber) return null;
  return (
    <FoundingCreatorBadge foundingNumber={data.foundingNumber} size={size} className={className} />
  );
}
