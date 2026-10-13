# OPTIMISTIC UI MUTATION TEMPLATE (60FPS ZERO-SPINNER UX)
> Mẫu triển khai React Query mutation cập nhật giao diện ngay lập tức trong 16ms (Linear / Figma style) kèm cơ chế tự động Rollback an toàn khi server báo lỗi.

---

## 1. NGUYÊN LÝ OPTIMISTIC UPDATE
1. Khi người dùng click (đổi status, like, check task, thanh toán):
   - Ngay lập tức hủy các query đang chạy dở (`cancelQueries`).
   - Chụp snapshot cache hiện tại làm điểm phục hồi (`previousData`).
   - Ghi đè cache ngay lập tức với dữ liệu dự kiến (`setQueryData`).
   - Giao diện người dùng đổi màu/badge ngay lập tức (16ms - 60fps).
2. Khi Server trả về kết quả:
   - Nếu lỗi (`onError`): Rollback cache về nguyên trạng từ `previousData`, hiển thị Toast thông báo lỗi nhân bản.
   - Khi hoàn tất (`onSettled`): Invalidate query để đồng bộ số liệu chính thức từ database.

---

## 2. CODE BLUEPRINT (REACT QUERY V5 + TYPESCRIPT)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import { api } from '@/core/api';
import { toast } from '@/components/ui/toast';

interface UpdateInvoiceStatusCommand {
  invoiceId: string;
  newStatus: 'PAID' | 'CANCELLED';
}

export function useUpdateInvoiceStatus(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, newStatus }: UpdateInvoiceStatusCommand) => {
      const res = await api.patch(`/api/v1/invoices/${invoiceId}/status`, { status: newStatus });
      return res.data;
    },
    // 1. NGAY KHI CLICK: Cập nhật giao diện lập tức trong 16ms
    onMutate: async ({ invoiceId, newStatus }) => {
      const listKey = queryKeys.list(tenantId);
      await queryClient.cancelQueries({ queryKey: listKey });

      // Lưu snapshot trước khi sửa
      const previousInvoices = queryClient.getQueryData<InvoiceDTO[]>(listKey);

      // Cập nhật lạc quan cache
      if (previousInvoices) {
        queryClient.setQueryData<InvoiceDTO[]>(listKey, (old = []) =>
          old.map((inv) => (inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
        );
      }

      return { previousInvoices };
    },
    // 2. NẾU LỖI: Rollback về snapshot cũ
    onError: (err, variables, context) => {
      if (context?.previousInvoices) {
        queryClient.setQueryData(queryKeys.list(tenantId), context.previousInvoices);
      }
      toast.error('Không thể cập nhật trạng thái hóa đơn. Vui lòng thử lại.');
    },
    // 3. KHI XONG: Đồng bộ lại với server
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.list(tenantId) });
    },
  });
}
```
