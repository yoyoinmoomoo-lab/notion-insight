"use client";

interface HeatmapProps {
  data: { dow: number; hour: number; count: number }[];
}

export default function Heatmap({ data }: HeatmapProps) {
  // dow(1~7) x hour(0~23) 매트릭스 생성
  const matrix: number[][] = [];
  const dowLabels = ["월", "화", "수", "목", "금", "토", "일"];
  const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString());

  // 초기화: 7x24 매트릭스
  for (let dow = 1; dow <= 7; dow++) {
    const row: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const item = data.find((d) => d.dow === dow && d.hour === hour);
      row.push(item ? item.count : 0);
    }
    matrix.push(row);
  }

  // 최대값 계산 (색상 강도용)
  const maxValue = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="w-full overflow-x-auto">
      <table className="mx-auto w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold"></th>
            {hourLabels.map((h) => (
              <th
                key={h}
                className="border border-gray-300 bg-gray-50 px-1 py-2 text-xs font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dowLabels.map((dow, i) => (
            <tr key={i}>
              <td className="border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold">
                {dow}
              </td>
              {hourLabels.map((_, j) => {
                const count = matrix[i]?.[j] || 0;
                return (
                  <td
                    key={j}
                    className="border border-gray-300 px-1 py-2 text-center text-xs"
                    style={{
                      backgroundColor:
                        count === 0
                          ? "#f3f4f6"
                          : `rgba(59, 130, 246, ${0.3 + (count / maxValue) * 0.7})`,
                      color: count === 0 ? "#9ca3af" : "#1f2937",
                      fontWeight: count > 0 ? "500" : "normal",
                    }}
                  >
                    {count || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

