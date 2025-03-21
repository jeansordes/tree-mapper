export function basename(path: string): string {
    const normalizedPath = path.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    return parts[parts.length - 1] || '';
}