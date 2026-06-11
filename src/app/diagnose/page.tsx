import { DiagnoseForm } from "@/components/DiagnoseForm";

export default function DiagnosePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">助成金診断フォーム</h1>
        <p className="mt-1 text-sm text-slate-500">
          わかる範囲で入力してください。未確定の項目は社労士が追加確認します。
        </p>
      </div>
      <DiagnoseForm />
    </div>
  );
}
