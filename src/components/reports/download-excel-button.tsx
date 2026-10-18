"use client";

import { Button } from "@/components/ui/button";
import {
  downloadExcelWorkbook,
  type ExcelSheet,
} from "@/lib/excel-sheet";

export function DownloadExcelButton({
  filename,
  sheets,
  label = "Download Excel",
}: {
  filename: string;
  sheets: ExcelSheet[];
  label?: string;
}) {
  return (
    <Button
      type="button"
      className="w-full bg-[#0b3d2e] sm:w-auto"
      onClick={() => downloadExcelWorkbook(filename, sheets)}
    >
      {label}
    </Button>
  );
}
