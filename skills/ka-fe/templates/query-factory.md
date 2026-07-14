### Template: React Query Factory & Integration Hook

File: `src/features/documents/hooks/useDocuments.ts`

This template establishes the React Query keys structure and shows how to encapsulate hooks utilizing generated types/contracts from `ka-contract`.

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDocumentsApi, deleteDocumentApi } from '@/api/generated/documents';
import { DocumentDto, DocumentFilters } from '@/api/generated/contracts';

// 1. Modular Query Key Factory Pattern
export const documentKeys = {
  all: (orgId: string) => ['org', orgId, 'documents'] as const,
  lists: (orgId: string) => [...documentKeys.all(orgId), 'list'] as const,
  list: (orgId: string, filters: DocumentFilters) => [...documentKeys.lists(orgId), filters] as const,
  details: (orgId: string) => [...documentKeys.all(orgId), 'detail'] as const,
  detail: (orgId: string, id: string) => [...documentKeys.details(orgId), id] as const,
};

// 2. Custom Data Query Hook
export const useDocuments = (orgId: string, filters: DocumentFilters) => {
  return useQuery({
    queryKey: documentKeys.list(orgId, filters),
    queryFn: async () => {
      // Must pass tenant/org context safely to the backend
      const response = await getDocumentsApi({ orgId, ...filters });
      return response.data; // Expected type: DocumentDto[]
    },
    // Keep data fresh but prevent redundant refetching on transient state changes
    staleTime: 5000,
  });
};

// 3. Custom Mutation Hook
export const useDeleteDocument = (orgId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      await deleteDocumentApi({ orgId, id: documentId });
    },
    onSuccess: () => {
      // Invalidate relevant queries using the key factory to prevent cache collisions
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
    },
  });
};
```
