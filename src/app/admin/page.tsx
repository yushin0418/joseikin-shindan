import { getSession } from "@/lib/auth";
import { AdminTable } from "@/components/AdminTable";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">診断一覧（管理画面）</h1>
          <p className="mt-1 text-sm text-slate-500">
            ログイン中：{session?.name}（{session?.email}）
          </p>
        </div>
      </div>
      <AdminTable />
    </div>
  );
}
