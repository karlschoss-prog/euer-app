// Extended File System Access API types not yet in TypeScript's lib.dom.d.ts
interface FileSystemHandle {
  queryPermission(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>
  requestPermission(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>
}
