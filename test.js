// ==== 전역 변수 ====
let cameraX = 0;
let cameraY = 0;
let cameraScale = 1;
let cameraRotation = 0; // degrees

// ==== 변환 함수 ====
function applyCameraTransform(direction, x, y, scale) {
    // 회전값(도 → 라디안)
    const rad = cameraRotation * Math.PI / 180;

    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    // 스크래치 블록과 동일한 계산식
    const relX = ((cosR * (x - cameraX)) - (sinR * (y - cameraY))) * scale;
    const relY = ((sinR * (x - cameraX)) + (cosR * (y - cameraY))) * scale;

    return { direction: direction - cameraRotation, x: relX, y: relY, scale: scale * cameraScale };
}
