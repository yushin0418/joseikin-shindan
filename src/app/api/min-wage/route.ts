import { NextResponse } from "next/server";
import { allPrefectureMinWages, getMinWageMeta } from "@/lib/minWage";

export const dynamic = "force-dynamic";

/**
 * 都道府県ごとの地域別最低賃金（令和8年度・改定前）と発効予定日を返す。
 * 診断フォームが、都道府県の選択肢と、地域別最低賃金の自動表示に使う（公開情報）。
 */
export async function GET() {
  return NextResponse.json({
    meta: getMinWageMeta(),
    prefectures: allPrefectureMinWages(),
  });
}
