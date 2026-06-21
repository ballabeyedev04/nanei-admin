export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="animate-spin rounded-full border-2 border-gray-200 border-t-[#FF7A00]"
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={32} />
    </div>
  );
}
