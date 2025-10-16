import * as React from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

// Responsive Table Components

interface ResponsiveTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ResponsiveTable = React.forwardRef<HTMLDivElement, ResponsiveTableProps>(
  ({ className, children, ...props }, ref) => {
    const isMobile = useIsMobile();

    return (
      <div ref={ref} className={className} {...props}>
        <div className={cn("md:hidden", isMobile ? "block" : "hidden")}>
          {/* Mobile card view */}
          {children}
        </div>
        <div className={cn("hidden md:block", !isMobile ? "block" : "hidden")}>
          {/* Desktop table view */}
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              {children}
            </table>
          </div>
        </div>
      </div>
    );
  }
);
ResponsiveTable.displayName = "ResponsiveTable";

interface ResponsiveRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  headers?: string[];
}

const ResponsiveRow = React.forwardRef<HTMLDivElement, ResponsiveRowProps>(
  ({ className, children, headers = [], ...props }, ref) => {
    const isMobile = useIsMobile();

    if (!isMobile) {
      return (
        <tr 
          className={cn(
            "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
            className
          )} 
          {...props}
        >
          {children}
        </tr>
      );
    }

    // Mobile card view
    const cells = React.Children.toArray(children);
    
    return (
      <div 
        ref={ref}
        className={cn(
          "p-4 mb-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800/50 transition-colors",
          className
        )}
        {...props}
      >
        {cells.map((cell, index) => {
          // Skip if it's not a valid React element
          if (!React.isValidElement(cell)) return null;
          
          // Extract content from the cell
          const cellContent = cell.props.children;
          const header = headers[index] || '';
          
          return (
            <div key={index} className="flex flex-col mb-3 last:mb-0">
              {header && (
                <div className="text-xs font-medium text-slate-400 mb-1">
                  {header}
                </div>
              )}
              <div className="text-sm text-slate-200">
                {cellContent}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);
ResponsiveRow.displayName = "ResponsiveRow";

const ResponsiveHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    // Hide headers on mobile since they'll be inline with data
    return null;
  }
  
  return (
    <thead ref={ref as any} className={cn("[&_tr]:border-b", className)} {...props}>
      {children}
    </thead>
  );
});
ResponsiveHeader.displayName = "ResponsiveHeader";

const ResponsiveBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <div ref={ref} className={cn("space-y-3", className)} {...props}>
        {children}
      </div>
    );
  }
  
  return (
    <tbody
      ref={ref as any}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    >
      {children}
    </tbody>
  );
});
ResponsiveBody.displayName = "ResponsiveBody";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  ResponsiveTable,
  ResponsiveRow,
  ResponsiveHeader,
  ResponsiveBody,
}