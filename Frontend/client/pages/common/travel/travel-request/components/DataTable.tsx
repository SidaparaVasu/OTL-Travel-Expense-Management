import React from "react";
import { Edit2, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Column<T> {
  label: string;
  key?: keyof T;
  render?: (row: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  emptyMessage?: string;
  rowErrors?: Record<number, string>;
}

export function DataTable<T>({
  columns,
  data,
  onEdit,
  onDelete,
  emptyMessage = "No items added yet",
  rowErrors = {},
}: DataTableProps<T>) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={cn(
                    "px-4 py-3 text-sm font-semibold text-foreground",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                    !col.align && "text-left"
                  )}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-sm font-semibold text-foreground text-center w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const hasError = !!rowErrors[idx];
                return (
                  <tr
                    key={idx}
                    className={cn(
                      "transition-colors",
                      hasError 
                        ? "bg-destructive/5 hover:bg-destructive/10 border-l-4 border-l-destructive" 
                        : "hover:bg-muted/30"
                    )}
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className={cn(
                          "px-4 py-3 text-sm text-foreground",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right"
                        )}
                      >
                        {col.render
                          ? col.render(row, idx)
                          : col.key
                          ? String((row as Record<string, unknown>)[col.key as string] || "-")
                          : "-"}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {hasError && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="p-2 text-destructive">
                                  <AlertCircle size={16} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <p className="text-sm">{rowErrors[idx]}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <button
                          onClick={() => onEdit(idx)}
                          className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(idx)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}