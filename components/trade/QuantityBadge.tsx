type QuantityBadgeProps = {
  quantity: number;
};

export function QuantityBadge({ quantity }: QuantityBadgeProps) {
  if (quantity <= 1) return null;

  return (
    <span className="absolute right-2 top-3 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-950 text-[7px] font-black leading-none text-white">
      ×{quantity}
    </span>
  );
}
