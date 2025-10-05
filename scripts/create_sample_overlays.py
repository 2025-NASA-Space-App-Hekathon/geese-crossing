#!/usr/bin/env python3
"""
샘플 오버레이 이미지 생성 스크립트
2K 해상도 (2048x1024)로 다양한 데이터 시각화 오버레이 생성
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import math

def create_sample_overlays():
    """샘플 오버레이 이미지들 생성"""
    
    # 출력 디렉토리 생성
    output_dir = "public/overlays"
    os.makedirs(output_dir, exist_ok=True)
    
    # 2K 해상도 (2048x1024)
    width, height = 2048, 1024
    
    # 1. 산맥 오버레이 (기존 mountains.tif 기반)
    create_mountains_overlay(width, height, f"{output_dir}/mountains_2k.png")
    
    # 2. 강수량 오버레이
    create_precipitation_overlay(width, height, f"{output_dir}/precipitation_2k.png")
    
    # 3. 온도 오버레이
    create_temperature_overlay(width, height, f"{output_dir}/temperature_2k.png")
    
    # 4. 인구 밀도 오버레이
    create_population_overlay(width, height, f"{output_dir}/population_2k.png")
    
    # 5. 식생 오버레이
    create_vegetation_overlay(width, height, f"{output_dir}/vegetation_2k.png")
    
    # 6. 구름 오버레이
    create_clouds_overlay(width, height, f"{output_dir}/clouds_2k.png")
    
    # 7. 바람 오버레이
    create_wind_overlay(width, height, f"{output_dir}/wind_2k.png")
    
    # 8. 기압 오버레이
    create_pressure_overlay(width, height, f"{output_dir}/pressure_2k.png")
    
    # 9. 습도 오버레이
    create_humidity_overlay(width, height, f"{output_dir}/humidity_2k.png")
    
    # 10. 고도 오버레이
    create_elevation_overlay(width, height, f"{output_dir}/elevation_2k.png")
    
    print(f"샘플 오버레이 이미지들이 {output_dir}에 생성되었습니다!")

def create_mountains_overlay(width, height, output_path):
    """산맥 오버레이 생성"""
    # 위도별 산맥 밀도 시뮬레이션
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        for x in range(width):
            # 위도 계산 (y 좌표를 위도로 변환)
            lat = 90 - (y / height) * 180
            
            # 경도 계산
            lon = (x / width) * 360 - 180
            
            # 산맥 밀도 계산 (위도별, 경도별 패턴)
            mountain_density = 0
            
            # 알프스 (유럽)
            if 40 <= lat <= 50 and -10 <= lon <= 20:
                mountain_density += 0.8 * np.exp(-((lat-45)**2 + (lon-5)**2) / 100)
            
            # 히말라야 (아시아)
            if 25 <= lat <= 35 and 70 <= lon <= 100:
                mountain_density += 0.9 * np.exp(-((lat-30)**2 + (lon-85)**2) / 200)
            
            # 안데스 (남미)
            if -20 <= lat <= 10 and -80 <= lon <= -60:
                mountain_density += 0.7 * np.exp(-((lat+5)**2 + (lon+70)**2) / 150)
            
            # 록키 산맥 (북미)
            if 30 <= lat <= 60 and -130 <= lon <= -100:
                mountain_density += 0.6 * np.exp(-((lat-45)**2 + (lon+115)**2) / 300)
            
            if mountain_density > 0.1:
                alpha = int(min(255, mountain_density * 255))
                draw.point((x, y), fill=(55, 255, 0, alpha))
    
    img.save(output_path, 'PNG')
    print(f"산맥 오버레이 생성: {output_path}")

def create_precipitation_overlay(width, height, output_path):
    """강수량 오버레이 생성"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        for x in range(width):
            lat = 90 - (y / height) * 180
            lon = (x / width) * 360 - 180
            
            # 강수량 패턴 (적도 근처, 해안가)
            precipitation = 0
            
            # 적도 근처 강수량
            if -10 <= lat <= 10:
                precipitation += 0.8 * np.exp(-lat**2 / 50)
            
            # 해안가 강수량
            distance_from_coast = min(
                abs(lon - 0), abs(lon - 180), abs(lon + 180),
                abs(lat - 0), abs(lat - 90), abs(lat + 90)
            )
            if distance_from_coast < 30:
                precipitation += 0.6 * np.exp(-distance_from_coast / 20)
            
            if precipitation > 0.1:
                alpha = int(min(255, precipitation * 200))
                # 파란색 계열
                blue_intensity = int(min(255, precipitation * 255))
                draw.point((x, y), fill=(0, 100, blue_intensity, alpha))
    
    img.save(output_path, 'PNG')
    print(f"강수량 오버레이 생성: {output_path}")

def create_temperature_overlay(width, height, output_path):
    """온도 오버레이 생성"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        for x in range(width):
            lat = 90 - (y / height) * 180
            
            # 온도 계산 (위도에 따른 기본 패턴)
            base_temp = 30 - abs(lat) * 0.5
            
            # 계절 변동 (간단한 시뮬레이션)
            seasonal_variation = 10 * math.sin(lat * math.pi / 180)
            temp = base_temp + seasonal_variation
            
            # 온도에 따른 색상
            if temp > 0:
                alpha = int(min(255, abs(temp) * 8))
                if temp > 20:
                    # 뜨거운 지역 (빨간색)
                    red_intensity = int(min(255, (temp - 20) * 12))
                    draw.point((x, y), fill=(red_intensity, 0, 0, alpha))
                elif temp > 0:
                    # 차가운 지역 (파란색)
                    blue_intensity = int(min(255, (20 - temp) * 12))
                    draw.point((x, y), fill=(0, 0, blue_intensity, alpha))
    
    img.save(output_path, 'PNG')
    print(f"온도 오버레이 생성: {output_path}")

def create_population_overlay(width, height, output_path):
    """인구 밀도 오버레이 생성"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 주요 도시 위치들
    cities = [
        (40.7128, -74.0060, 0.9),   # 뉴욕
        (51.5074, -0.1278, 0.8),    # 런던
        (35.6762, 139.6503, 0.8),   # 도쿄
        (22.3193, 114.1694, 0.7),   # 홍콩
        (1.3521, 103.8198, 0.6),    # 싱가포르
        (-33.8688, 151.2093, 0.6),  # 시드니
        (37.7749, -122.4194, 0.7),  # 샌프란시스코
        (48.8566, 2.3522, 0.6),     # 파리
        (55.7558, 37.6176, 0.5),    # 모스크바
        (-23.5505, -46.6333, 0.6),  # 상파울루
    ]
    
    for y in range(height):
        for x in range(width):
            lat = 90 - (y / height) * 180
            lon = (x / width) * 360 - 180
            
            population_density = 0
            
            # 도시별 인구 밀도
            for city_lat, city_lon, density in cities:
                distance = math.sqrt((lat - city_lat)**2 + (lon - city_lon)**2)
                if distance < 5:  # 5도 반경
                    population_density += density * np.exp(-distance / 2)
            
            if population_density > 0.1:
                alpha = int(min(255, population_density * 200))
                # 핑크색 계열
                pink_intensity = int(min(255, population_density * 255))
                draw.point((x, y), fill=(pink_intensity, 0, pink_intensity, alpha))
    
    img.save(output_path, 'PNG')
    print(f"인구 밀도 오버레이 생성: {output_path}")

def create_vegetation_overlay(width, height, output_path):
    """식생 오버레이 생성"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        for x in range(width):
            lat = 90 - (y / height) * 180
            lon = (x / width) * 360 - 180
            
            # 식생 밀도 (위도, 강수량 패턴 기반)
            vegetation = 0
            
            # 적도 근처 밀림
            if -10 <= lat <= 10:
                vegetation += 0.9 * np.exp(-lat**2 / 30)
            
            # 온대 숲
            if 30 <= abs(lat) <= 60:
                vegetation += 0.6 * np.exp(-(abs(lat) - 45)**2 / 100)
            
            # 툰드라
            if abs(lat) > 60:
                vegetation += 0.3 * np.exp(-(abs(lat) - 60) / 20)
            
            if vegetation > 0.1:
                alpha = int(min(255, vegetation * 200))
                # 초록색 계열
                green_intensity = int(min(255, vegetation * 255))
                draw.point((x, y), fill=(0, green_intensity, 0, alpha))
    
    img.save(output_path, 'PNG')
    print(f"식생 오버레이 생성: {output_path}")

def create_clouds_overlay(width, height, output_path):
    """구름 오버레이 생성"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 노이즈 기반 구름 패턴
    for y in range(0, height, 4):
        for x in range(0, width, 4):
            # 간단한 노이즈 패턴
            noise = np.random.random()
            lat = 90 - (y / height) * 180
            
            # 위도별 구름 밀도
            cloud_density = 0.3 + 0.4 * np.sin(lat * np.pi / 180) + noise * 0.3
            
            if cloud_density > 0.5:
                alpha = int(min(255, (cloud_density - 0.5) * 400))
                # 흰색 계열
                draw.rectangle([x, y, x+3, y+3], fill=(255, 255, 255, alpha))
    
    img.save(output_path, 'PNG')
    print(f"구름 오버레이 생성: {output_path}")

def create_wind_overlay(width, height, output_path):
    """바람 오버레이 생성"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    for y in range(0, height, 8):
        for x in range(0, width, 8):
            lat = 90 - (y / height) * 180
            lon = (x / width) * 360 - 180
            
            # 바람 강도 (위도별 패턴)
            wind_strength = 0.5 + 0.3 * np.sin(lat * np.pi / 90) + np.random.random() * 0.2
            
            if wind_strength > 0.6:
                alpha = int(min(255, (wind_strength - 0.6) * 500))
                # 청록색 계열
                draw.rectangle([x, y, x+7, y+7], fill=(0, 200, 200, alpha))
    
    img.save(output_path, 'PNG')
    print(f"바람 오버레이 생성: {output_path}")

def create_pressure_overlay(width, height, output_path):
    """기압 오버레이 생성"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        for x in range(width):
            lat = 90 - (y / height) * 180
            
            # 기압 패턴 (위도별)
            pressure = 1013 + 20 * np.sin(lat * np.pi / 90) + np.random.random() * 10
            
            if abs(pressure - 1013) > 5:
                alpha = int(min(255, abs(pressure - 1013) * 10))
                if pressure > 1013:
                    # 고기압 (보라색)
                    draw.point((x, y), fill=(128, 0, 128, alpha))
                else:
                    # 저기압 (주황색)
                    draw.point((x, y), fill=(255, 128, 0, alpha))
    
    img.save(output_path, 'PNG')
    print(f"기압 오버레이 생성: {output_path}")

def create_humidity_overlay(width, height, output_path):
    """습도 오버레이 생성"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        for x in range(width):
            lat = 90 - (y / height) * 180
            lon = (x / width) * 360 - 180
            
            # 습도 패턴
            humidity = 0.3 + 0.4 * np.sin(lat * np.pi / 180) + 0.2 * np.random.random()
            
            if humidity > 0.5:
                alpha = int(min(255, (humidity - 0.5) * 400))
                # 하늘색 계열
                blue_intensity = int(min(255, humidity * 255))
                draw.point((x, y), fill=(100, 150, blue_intensity, alpha))
    
    img.save(output_path, 'PNG')
    print(f"습도 오버레이 생성: {output_path}")

def create_elevation_overlay(width, height, output_path):
    """고도 오버레이 생성"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        for x in range(width):
            lat = 90 - (y / height) * 180
            lon = (x / width) * 360 - 180
            
            # 고도 패턴 (산맥과 유사하지만 다른 색상)
            elevation = 0
            
            # 주요 산맥들
            if 40 <= lat <= 50 and -10 <= lon <= 20:  # 알프스
                elevation += 0.8 * np.exp(-((lat-45)**2 + (lon-5)**2) / 100)
            if 25 <= lat <= 35 and 70 <= lon <= 100:  # 히말라야
                elevation += 0.9 * np.exp(-((lat-30)**2 + (lon-85)**2) / 200)
            if -20 <= lat <= 10 and -80 <= lon <= -60:  # 안데스
                elevation += 0.7 * np.exp(-((lat+5)**2 + (lon+70)**2) / 150)
            
            if elevation > 0.1:
                alpha = int(min(255, elevation * 255))
                # 갈색 계열
                brown_intensity = int(min(255, elevation * 255))
                draw.point((x, y), fill=(brown_intensity, brown_intensity//2, 0, alpha))
    
    img.save(output_path, 'PNG')
    print(f"고도 오버레이 생성: {output_path}")

if __name__ == "__main__":
    create_sample_overlays()
