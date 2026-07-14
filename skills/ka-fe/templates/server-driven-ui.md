### Template: Server-Driven UI (Authorization & Graceful Degradation)

File: `src/features/documents/components/DocumentRow.tsx`

This template demonstrates how the UI conditionally renders mutating actions (Edit/Delete) strictly based on the server-provided `_actions` list. If the `_actions` property is missing or doesn't permit a command, it degrades gracefully to a read-only rendering without hardcoding role checks.

```typescript
import React from 'react';
import { Link } from '@tanstack/react-router';
import { DocumentDto } from '@/api/generated/contracts';

interface DocumentRowProps {
  document: DocumentDto;
  orgId: string;
  onDelete: (id: string) => void;
}

export const DocumentRow: React.FC<DocumentRowProps> = ({ document, orgId, onDelete }) => {
  // Safe extraction of actions (Graceful Degradation fallback to empty object if undefined)
  const actions = document._actions ?? {};

  // Check if specific mutations are allowed by backend
  const canUpdate = !!actions.update;
  const canDelete = !!actions.delete;

  return (
    <tr className="border-b hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 font-medium text-gray-900">{document.title}</td>
      <td className="px-6 py-4 text-gray-500">{document.status}</td>
      <td className="px-6 py-4 text-right space-x-2">
        {/* Safe Navigation using TanStack Router Link */}
        <Link
          to="/orgs/$orgId/documents/$documentId"
          params={{ orgId, documentId: document.id }}
          className="text-blue-600 hover:text-blue-900 font-semibold"
        >
          View
        </Link>

        {/* Server-Driven UI button checks */}
        {canUpdate && (
          <Link
            to="/orgs/$orgId/documents/$documentId/edit"
            params={{ orgId, documentId: document.id }}
            className="text-amber-600 hover:text-amber-900 font-semibold"
          >
            Edit
          </Link>
        )}

        {canDelete && (
          <button
            onClick={() => onDelete(document.id)}
            className="text-red-600 hover:text-red-900 font-semibold bg-transparent border-0 cursor-pointer"
          >
            Delete
          </button>
        )}

        {/* Inform user if in read-only mode for this record */}
        {!canUpdate && !canDelete && (
          <span className="text-xs text-gray-400 italic">Read-Only</span>
        )}
      </td>
    </tr>
  );
};
```
