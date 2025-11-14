"use client";

interface DailyCountChartProps {
  data: { date: string; count: number }[];
}

export default function DailyCountChart({ data }: DailyCountChartProps) {
  if (data.length === 0) {
    return <p className="text-gray-500">데이터가 없습니다.</p>;
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="w-full space-y-2">
      {data.map((item) => (
        <div key={item.date} className="flex items-center gap-3">
          <div className="w-24 text-sm text-gray-600">{item.date}</div>
          <div className="flex-1">
            <div className="relative h-6 w-full overflow-hidden rounded bg-gray-100">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                {item.count}개
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

