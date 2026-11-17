import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const PaginationBar: React.FC<PaginationBarProps> = ({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}) => {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  const buildPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [1];
    if (safePage > 3) pages.push('ellipsis');
    const winStart = Math.max(2, safePage - 1);
    const winEnd = Math.min(totalPages - 1, safePage + 1);
    for (let p = winStart; p <= winEnd; p++) pages.push(p);
    if (safePage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="studio-card flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-xs text-stone-600 dark:text-slate-400">
      <div className="flex items-center gap-3">
        <span className="font-mono-tabular">
          Showing <span className="font-semibold text-stone-900 dark:text-slate-100">{startIdx}–{endIdx}</span> of{' '}
          <span className="font-semibold text-stone-900 dark:text-slate-100">{totalItems}</span> {itemLabel}
        </span>

        <label className="inline-flex items-center gap-1.5 text-stone-500 dark:text-slate-400">
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="rounded-lg border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] px-2 py-1 text-xs font-mono-tabular text-stone-800 dark:text-slate-200 focus:border-[#234aff] focus:ring-1 focus:ring-[#234aff] focus:outline-none"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Previous page"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] text-stone-700 dark:text-slate-300 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>

        {buildPageNumbers().map((token, idx) =>
          token === 'ellipsis' ? (
            <span key={`e-${idx}`} className="px-1.5 text-stone-400 dark:text-slate-600">
              …
            </span>
          ) : (
            <button
              key={token}
              type="button"
              onClick={() => onPageChange(token)}
              className={`min-w-[28px] px-2 py-1 rounded-lg border font-mono-tabular text-xs transition-colors ${
                token === safePage
                  ? 'bg-[#234aff] border-[#234aff] text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-[#182030] border-[#e5e3dc] dark:border-slate-700 text-stone-700 dark:text-slate-300 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800'
              }`}
            >
              {token}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Next page"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#e5e3dc] dark:border-slate-700 bg-white dark:bg-[#182030] text-stone-700 dark:text-slate-300 hover:bg-[#eeece6]/40 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
