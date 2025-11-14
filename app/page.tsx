"use client";

import { useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import Heatmap from "@/components/Heatmap";
import DailyCountChart from "@/components/DailyCountChart";
import { ApiResponse, AnalysisResult } from "@/lib/types";
import { ProfileKey } from "@/config/profiles";

export default function Home() {
  const [profile, setProfile] = useState<ProfileKey>("yoyo");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>("7");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // 프로필 변경 시 리포트 데이터 초기화
  const handleProfileChange = (newProfile: ProfileKey) => {
    setProfile(newProfile);
    setResult(null);
    setError(null);
    setLoading(false);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams();
      params.set("profile", profile);
      if (from && to) {
        params.set("from", from);
        params.set("to", to);
      } else {
        params.set("preset", preset);
      }

      const response = await fetch(`/api/run?${params.toString()}`, {
        method: "POST",
      });

      const data: ApiResponse = await response.json();

      if (data.status === "success") {
        setResult(data);
      } else if (data.status === "empty") {
        setError(data.message);
      } else if (data.status === "error") {
        setError(data.message);
      }
    } catch (err) {
      setError("서버 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {loading && <LoadingOverlay />}

      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">Get Note Insight</h1>
          <p className="text-gray-600">Notion 메모 분석 리포트</p>
        </header>

        {/* 프로필 선택 섹션 */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow-md">
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm font-medium text-gray-700">프로필</span>
            <button
              className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                profile === "yoyo"
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => handleProfileChange("yoyo")}
            >
              yoyo
            </button>
            <button
              className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                profile === "jojo"
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => handleProfileChange("jojo")}
            >
              jojo
            </button>
          </div>
        </div>

        {/* 기간 선택 섹션 */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">분석 기간 선택</h2>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">최근 N일</label>
            <div className="flex gap-2">
              {["7", "14", "28"].map((days) => (
                <button
                  key={days}
                  onClick={() => {
                    setPreset(days);
                    setFrom("");
                    setTo("");
                  }}
                  className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                    preset === days && !from && !to
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {days}일
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">또는 날짜 범위 지정</label>
            <div className="flex gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-600">시작일</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (e.target.value) {
                      setPreset("");
                    }
                  }}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">종료일</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    if (e.target.value) {
                      setPreset("");
                    }
                  }}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
          >
            분석 실행
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-8 rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* 리포트 결과 */}
        {result && (
          <div className="space-y-6">
            {/* 리포트 헤더 */}
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold text-blue-900">
                  Profile: <span className="font-normal">{profile}</span>
                </span>
                <span className="text-blue-600">·</span>
                <span className="text-blue-700">
                  {preset && !from && !to ? `최근 ${preset}일` : from && to ? `${from} ~ ${to}` : "기본 기간"}
                </span>
                <span className="text-blue-600">·</span>
                <span className="text-blue-700">메모 {result.noteCount}개</span>
              </div>
            </div>

            {/* 패턴 분석 */}
            <section className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-2xl font-bold text-gray-800">작성 패턴</h2>
              <p className="mb-4 text-sm text-gray-600">총 {result.noteCount}개의 메모가 분석되었습니다.</p>

              <div className="mb-6">
                <h3 className="mb-3 text-lg font-semibold text-gray-700">작성 시간 히트맵</h3>
                <Heatmap data={result.pattern.heatmap} />
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold text-gray-700">일자별 메모 개수</h3>
                <DailyCountChart data={result.pattern.dailyCount} />
              </div>
            </section>

            {/* 키워드 */}
            <section className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-2xl font-bold text-gray-800">핵심 키워드</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">키워드</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.content.keywords.map((kw, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-900">{kw.term}</td>
                        <td className="px-4 py-3 text-gray-600">{kw.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 감정 분석 */}
            <section className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-2xl font-bold text-gray-800">감정 흐름</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">경향</p>
                  <p className="text-lg text-gray-900">{result.content.sentiment.trend}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">요약</p>
                  <p className="text-gray-700">{result.content.sentiment.summary}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">점수</p>
                  <p className="text-lg text-gray-900">
                    {result.content.sentiment.score > 0 ? "+" : ""}
                    {result.content.sentiment.score.toFixed(2)}
                  </p>
                </div>
              </div>
            </section>

            {/* 내용 흐름 */}
            <section className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-2xl font-bold text-gray-800">내용 흐름 요약</h2>
              <p className="whitespace-pre-line text-gray-700">{result.content.contentFlow}</p>
            </section>

            {/* 다음 행동 */}
            <section className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-2xl font-bold text-gray-800">다음 행동 추천</h2>
              <ul className="space-y-2">
                {result.content.nextActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" />
                    <span className="text-gray-700">{action}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
