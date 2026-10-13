# PLATFORM PORTS & ADAPTERS TEMPLATE (ZERO NATIVE LEAKS)
> Mẫu thiết kế phân tách ranh giới giữa Web Browser và Native Desktop (Tauri v2 / Electron) để đạt chuẩn Single Codebase Dual Targets.

---

## 1. NGUYÊN TẮC "ZERO NATIVE LEAKS"
- **Tuyệt đối cấm**: Import trực tiếp `@tauri-apps/*` hoặc thư viện Native bên trong React components, hooks hoặc pages.
- **Bắt buộc**: Mọi tương tác phần cứng (in tem nhiệt, mở file hộp thoại, quét mã vạch, khay hệ thống) phải đi qua `IPlatformPort`.
- Khi chạy trên Web Browser: Hệ thống tự động fallback sang cơ chế Web (ví dụ: `window.print()` hoặc Web File API) mà không bị crash.

---

## 2. CODE BLUEPRINT

```typescript
// src/lib/platform/platform-port.ts
export interface IPlatformPort {
  readonly isNativeDesktop: boolean;
  printThermalLabel(zplContent: string): Promise<boolean>;
  saveFileDialog(defaultName: string): Promise<string | null>;
  showSystemNotification(title: string, body: string): Promise<void>;
}

// src/lib/platform/platform-service.ts
import { IPlatformPort } from './platform-port';

class PlatformService implements IPlatformPort {
  public readonly isNativeDesktop: boolean;

  constructor() {
    this.isNativeDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  async printThermalLabel(zplContent: string): Promise<boolean> {
    if (this.isNativeDesktop) {
      // Lazy import để tránh vỡ bundle khi chạy trên Web tĩnh
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('print_thermal_command', { content: zplContent });
    }
    // Fallback trên Web: Báo cảnh báo hoặc in qua browser driver
    console.warn('In tem nhiệt native chỉ hỗ trợ trên ứng dụng Desktop.');
    window.print();
    return true;
  }

  async saveFileDialog(defaultName: string): Promise<string | null> {
    if (this.isNativeDesktop) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      return await save({ defaultPath: defaultName });
    }
    return defaultName;
  }

  async showSystemNotification(title: string, body: string): Promise<void> {
    if (this.isNativeDesktop) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({ title, body });
      return;
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
}

export const platform = new PlatformService();
```
