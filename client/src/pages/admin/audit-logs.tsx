import { useQuery } from "@tanstack/react-query";
import ProtectedAdminRoute from "@/components/admin/ProtectedAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { AdminAuditLog, AdminUser } from "@shared/schema";
import { FileText, User } from "lucide-react";
import { format } from "date-fns";

interface AuditLogWithAdmin extends AdminAuditLog {
  admin?: AdminUser;
}

export default function AuditLogs() {
  const { data: logs, isLoading, error } = useQuery<AdminAuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  const { data: admins } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const getAdminById = (id: string) => {
    return admins?.find(admin => admin.id === id);
  };

  const logsWithAdmins: AuditLogWithAdmin[] = logs?.map(log => ({
    ...log,
    admin: getAdminById(log.adminId),
  })) || [];

  return (
    <ProtectedAdminRoute requireSuperAdmin={true}>
      <AdminLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Audit Logs</h1>
            <p className="text-slate-400">Track all admin actions and system changes</p>
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-500" />
                Admin Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 bg-slate-800" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-4">Failed to load audit logs: {error instanceof Error ? error.message : 'Unknown error'}</p>
                  <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] })} variant="outline" className="border-slate-700 text-slate-300">
                    Retry
                  </Button>
                </div>
              ) : logsWithAdmins.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No audit logs found</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-950">
                  <Table data-testid="table-audit-logs">
                    <TableHeader>
                      <TableRow className="border-slate-800 hover:bg-slate-900">
                        <TableHead className="text-slate-400">Admin</TableHead>
                        <TableHead className="text-slate-400">Action</TableHead>
                        <TableHead className="text-slate-400">Resource</TableHead>
                        <TableHead className="text-slate-400">Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsWithAdmins.map((log) => (
                        <TableRow key={log.id} className="border-slate-800 hover:bg-slate-900/50">
                          <TableCell className="text-slate-100">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-500" />
                              <div>
                                <p className="font-medium">
                                  {log.admin?.firstName} {log.admin?.lastName}
                                </p>
                                <p className="text-xs text-slate-500">{log.admin?.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-600/20 text-purple-400">
                              {log.action}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-400">
                            {log.resourceType && log.resourceId ? (
                              <div>
                                <p className="text-slate-300">{log.resourceType}</p>
                                <p className="text-xs text-slate-500 font-mono">{log.resourceId.substring(0, 8)}...</p>
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-400">
                            {log.createdAt ? format(new Date(log.createdAt), 'MMM d, yyyy h:mm a') : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
