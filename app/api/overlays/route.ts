import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Ensure this route is always dynamic and runs on Node.js (uses fs)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
    try {
        // Use nextUrl to avoid static analysis issue; default to 'overlays'
        const folderParam = request.nextUrl?.searchParams?.get('folder') ?? 'overlays';
        // Normalize and sanitize: strip leading slashes, normalize, block traversal
        const stripped = folderParam.replace(/^\/+/, '');
        const normalized = path.posix.normalize(stripped);
        if (normalized.startsWith('..')) {
            return NextResponse.json({ success: false, error: 'Invalid folder path', files: [] }, { status: 400 });
        }

        const publicPath = path.join(process.cwd(), 'public');
        const fullPath = path.resolve(publicPath, normalized);
        // Ensure the resolved path is inside public
        if (!fullPath.startsWith(publicPath)) {
            return NextResponse.json({ success: false, error: 'Path traversal detected', files: [] }, { status: 400 });
        }

        // Check folder exists
        let stat: import('fs').Stats;
        try {
            stat = await fs.stat(fullPath);
        } catch {
            return NextResponse.json({ success: false, error: 'Folder not found', files: [] }, { status: 404 });
        }
        if (!stat.isDirectory()) {
            return NextResponse.json({ success: false, error: 'Not a directory', files: [] }, { status: 400 });
        }

        // Read directory
        const files = await fs.readdir(fullPath);
        const imageFiles = files.filter((file) => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp'].includes(ext);
        });

        // Build metadata
        const overlayFiles = await Promise.all(imageFiles.map(async (file) => {
            const name = path.parse(file).name;
            const ext = path.parse(file).ext.toLowerCase();
            const fileStat = await fs.stat(path.join(fullPath, file));
            const sizeKB = Math.round(fileStat.size / 1024);
            // Web path must use forward slashes and be rooted from /
            const fileWebPath = path.posix.join('/', normalized, file);
            return { id: name, name, file, path: fileWebPath, size: sizeKB, extension: ext };
        }));

        return NextResponse.json({ success: true, folder: `/${normalized}`, files: overlayFiles, count: overlayFiles.length });
    } catch (error) {
        console.error('Error reading overlay folder:', error);
        return NextResponse.json({ success: false, error: 'Failed to read overlay folder', files: [] }, { status: 500 });
    }
}
