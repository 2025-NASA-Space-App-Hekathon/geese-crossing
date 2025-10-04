"use client";
import React from 'react';
import { ClickInfo } from '../../components/utils/globeMath';

export default function ClickInfoPanel({ info, onClose }: { info: ClickInfo | null; onClose: () => void; }) {
    if (!info) return null;
    return (
        <div style={{
            position: 'absolute',
            top: 76,
            right: 16,
            backgroundColor: info.isKorea ? 'rgba(34, 197, 94, 0.9)' : 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'monospace',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            minWidth: '200px'
        }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                {info.isKorea ? '🇰🇷 대한민국' : '🌍 다른 지역'}
            </div>
            <div>위도: {info.latitude.toFixed(4)}°</div>
            <div>경도: {info.longitude.toFixed(4)}°</div>
            {info.mountainsValue !== undefined && (
                <div style={{ marginTop: 6 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>산 데이터</div>
                    <div>값: {info.mountainsValue}</div>
                    {info.mountainsPixelX !== undefined && info.mountainsPixelY !== undefined && (
                        <div style={{ marginTop: 2, fontSize: '12px', opacity: 0.85 }}>픽셀: ({info.mountainsPixelX}, {info.mountainsPixelY})</div>
                    )}
                </div>
            )}
            {/* Precipitation & angle info removed */}
            <button onClick={onClose} style={{
                marginTop: '8px',
                padding: '4px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px'
            }}>닫기</button>
        </div>
    );
}
