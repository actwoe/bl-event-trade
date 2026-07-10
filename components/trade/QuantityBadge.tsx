type QuantityBadgeProps = {
  quantity: number;
};

export function QuantityBadge({ quantity }: QuantityBadgeProps) {
  if (quantity <= 1) {
    return null;
  }

  return (
    <span className="absolute right-2.5 top-2.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-neutral-950 px-1.5 text-[9px] font-black leading-none text-white shadow-sm">
      ×{quantity}
    </span>
  );
}
