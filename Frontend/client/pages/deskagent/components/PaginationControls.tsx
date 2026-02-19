import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Pagination } from "@/src/types/travel-desk.types";

interface PaginationControlsProps {
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  pagination,
  onPageChange,
}) => {
  const [jumpPage, setJumpPage] = React.useState("");

  if (!pagination) return null;

  const { current_page, total_pages, next, previous } = pagination;

  const handleJump = () => {
    const pageNum = parseInt(jumpPage, 10);
    if (!pageNum || pageNum < 1 || pageNum > total_pages) return;
    onPageChange(pageNum);
    setJumpPage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJump();
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (total_pages <= maxVisible) {
      return Array.from({ length: total_pages }, (_, i) => i + 1);
    }

    pages.push(1);

    if (current_page > 3) {
      pages.push("...");
    }

    for (
      let i = Math.max(2, current_page - 1);
      i <= Math.min(total_pages - 1, current_page + 1);
      i++
    ) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (current_page < total_pages - 2) {
      pages.push("...");
    }

    if (total_pages > 1) {
      pages.push(total_pages);
    }

    return pages;
  };

  return (
    <div
      className="sticky bottom-0 left-0 right-0 bg-white 
      rounded-b-md border shadow-[0_2px_2px_0_rgba(59,130,247,0.30)] overflow-hidden 
      bg-card mt-0 py-4 px-4 flex flex-col gap-3 
      md:flex-row md:items-center md:justify-between sm:gap-4 z-20"
      style={{ marginTop: "0px" }}
    >
      <div className="flex items-center gap-2 md:justify-start sm:justify-center xs:justify-center">
        <span className="text-sm text-muted-foreground">Jump to:</span>
        <Input
          value={jumpPage}
          onChange={(e) => setJumpPage(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-auto h-8 text-center"
          placeholder="Page"
          type="number"
          min={1}
          max={total_pages}
        />
        <Button
          variant="default"
          size="sm"
          className="h-8 px-3"
          onClick={handleJump}
        >
          Go
        </Button>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!previous}
          onClick={() => onPageChange(current_page - 1)}
          className="h-8"
        >
          Previous
        </Button>

        <div className="flex flex-wrap gap-1 justify-center">
          {getPageNumbers().map((page, idx) =>
            typeof page === "number" ? (
              <Button
                key={page}
                size="sm"
                variant={page === current_page ? "default" : "outline"}
                className="h-8 px-3"
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            ) : (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 py-1 text-muted-foreground"
              >
                {page}
              </span>
            ),
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={!next}
          onClick={() => onPageChange(current_page + 1)}
          className="h-8"
        >
          Next
        </Button>
      </div>

      <div className="text-sm text-muted-foreground text-center md:text-right">
        Page <b>{current_page}</b> of <b>{total_pages}</b>
      </div>
    </div>
  );
};
