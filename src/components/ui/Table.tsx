interface Props {
  headers: string[];
  children: React.ReactNode;
  empty?: string;
  isEmpty?: boolean;
}

export function Table({ headers, children, empty = 'Aucune donnée', isEmpty }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-12 text-center text-gray-400 text-sm">
                {empty}
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3.5 text-sm text-gray-800 ${className}`}>{children}</td>;
}
