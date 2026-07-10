type QuantityBadgeProps = {
  quantity: number;
};

export function QuantityBadge({ quantity }: QuantityBadgeProps) {
  if (quantity <= 1) {
    return null;
  }

  return (
    <span className="absolute right-2.5 top-2.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-neutral-950 px-1 text-[8px] font-black leading-none text-white shadow-sm">
      ×{quantity}
    </span>
  );
}
