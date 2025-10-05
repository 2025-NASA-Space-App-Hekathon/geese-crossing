import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const folderPath = searchParams.get('folder') || '/overlays';
        
        // public 폴더 기준으로 절대 경로 생성
        const publicPath = path.join(process.cwd(), 'public');
        const fullPath = path.join(publicPath, folderPath);
        
        // 폴더 존재 확인
        if (!fs.existsSync(fullPath)) {
            return NextResponse.json({ 
                error: 'Folder not found',
                files: [] 
            });
        }
        
        // 폴더 내 파일 목록 읽기
        const files = fs.readdirSync(fullPath);
        
        // 모든 이미지 파일 필터링 (이름과 숫자에 상관없이)
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp'].includes(ext);
        });
        
        // 파일 정보 생성
        const overlayFiles = imageFiles.map(file => {
            const name = path.parse(file).name;
            const ext = path.parse(file).ext;
            const filePath = path.join(folderPath, file);
            
            // 파일 크기 확인
            const stats = fs.statSync(path.join(fullPath, file));
            const sizeKB = Math.round(stats.size / 1024);
            
            return {
                id: name,
                name: name,
                file: file,
                path: filePath,
                size: sizeKB,
                extension: ext
            };
        });
        
        return NextResponse.json({
            success: true,
            folder: folderPath,
            files: overlayFiles,
            count: overlayFiles.length
        });
        
    } catch (error) {
        console.error('Error reading overlay folder:', error);
        return NextResponse.json({ 
            error: 'Failed to read overlay folder',
            files: [] 
        }, { status: 500 });
    }
}
