/**
 * Preview System Component
 * 미리보기 렌더링 및 실시간 업데이트
 */

class PreviewSystem {
    constructor() {
        this.previewContent = null;
        this.currentTime = 0;

        // Easing 함수들
        this.easingFunctions = {
            linear: (t) => t,
            easeIn: (t) => t * t,
            easeOut: (t) => t * (2 - t),
            easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        };

        // 트랜스폼 컨트롤 상태
        this.selectedClipIds = [];
        this.isDragging = false;
        this.dragPending = false; // 드래그 대기 상태
        this.DRAG_THRESHOLD = 3; // 드래그 시작 임계값 (픽셀)
        this.isResizing = false;
        this.isRotating = false;
        this.rotateState = null; // 회전 상태 (연속 각도 누적)
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartValues = new Map(); // clipId -> {posX, posY, scale, rotation}
        this.resizeHandle = null;
        this.initialBoundingBox = null; // 리사이즈 시작 시 바운딩 박스

        // 논리적 캔버스 크기
        this.LOGICAL_CANVAS_WIDTH = 480; // x: -240 ~ 240
        this.LOGICAL_CANVAS_HEIGHT = 270; // y: -135 ~ 135

        // 카메라 상태 (렌더링 시 업데이트)
        this.cameraState = {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0
        };

        // 박스 선택
        this.selectionBox = {
            element: null,
            isSelecting: false,
            startX: 0,
            startY: 0,
            ctrlKey: false
        };

        // 캔버스 크기 추적
        this.lastCanvasWidth = 0;
        this.lastCanvasHeight = 0;

        // 리사이즈 디바운싱
        this.resizeTimeout = null;

        // 렌더링 캐시 (불필요한 재렌더링 방지)
        this.lastRenderedClips = new Set();

        this.init();
    }

    init() {
        this.previewContent = document.getElementById('previewContent');

        if (this.previewContent) {
            // 카메라 컨테이너 생성 (카메라 변환을 적용할 래퍼)
            this.cameraContainer = document.createElement('div');
            this.cameraContainer.className = 'camera-container';
            this.cameraContainer.style.width = '100%';
            this.cameraContainer.style.height = '100%';
            this.cameraContainer.style.position = 'relative';
            this.cameraContainer.style.transformOrigin = 'center center';
            this.previewContent.appendChild(this.cameraContainer);

            // 선택 박스 생성 (카메라 컨테이너 밖에 배치)
            this.selectionBox.element = document.createElement('div');
            this.selectionBox.element.className = 'selection-box';
            this.selectionBox.element.style.display = 'none';
            this.previewContent.appendChild(this.selectionBox.element);

            this.setupEventListeners();
            
            // 초기 캔버스 크기 저장
            const rect = this.previewContent.getBoundingClientRect();
            this.lastCanvasWidth = rect.width;
            this.lastCanvasHeight = rect.height;
            
            // ResizeObserver로 캔버스 크기 변경 감지 (디바운싱 적용)
            this.resizeObserver = new ResizeObserver(() => {
                if (this.resizeTimeout) {
                    clearTimeout(this.resizeTimeout);
                }
                this.resizeTimeout = setTimeout(() => {
                    this.update(this.currentTime);
                }, 100);
            });
            this.resizeObserver.observe(this.previewContent);
        }
    }

    setupEventListeners() {
        // 미리보기 배경색 변경 - input 이벤트로 실시간 반영
        const previewBgColor = document.getElementById('previewBgColor');
        if (previewBgColor) {
            previewBgColor.addEventListener('input', (e) => {
                this.previewContent.style.backgroundColor = e.target.value;
            });
            previewBgColor.addEventListener('change', (e) => {
                this.previewContent.style.backgroundColor = e.target.value;
                // 자동 저장 트리거
                if (window.app && window.app.timeline) {
                    window.app.timeline.triggerAutoSave('미리보기 배경색 변경');
                }
            });
        }

        // 프리뷰 이벤트
        this.previewContent.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    handleMouseDown(e) {
        const target = e.target;

        // 핸들 클릭 확인
        if (target.classList.contains('transform-handle')) {
            this.handleHandleMouseDown(e, target);
            return;
        }

        // 클립 요소 클릭 확인
        const clipElement = target.closest('[data-clip-id]');
        if (clipElement) {
            const clipId = clipElement.dataset.clipId;
            const ctrlSelect = e.ctrlKey || e.metaKey;
            const shiftSelect = e.shiftKey;
            const multiSelect = ctrlSelect || shiftSelect;

            // Timeline에 선택 전달
            if (window.app && window.app.timeline) {
                const clip = window.app.timeline.clips[clipId];
                if (clip && clip.type !== 'fill') {
                    const isAlreadySelected = this.selectedClipIds.includes(clipId);

                    // 다중 선택 키를 누르거나, 아직 선택되지 않은 클립을 클릭했을 때만 선택 로직 실행
                    if (multiSelect || !isAlreadySelected) {
                        // shiftSelect 플래그를 세 번째 인자로 전달
                        window.app.timeline.selectClip(clipId, ctrlSelect, shiftSelect);
                    }

                    // 선택된 클립들 가져오기
                    this.selectedClipIds = [...window.app.timeline.selectedClipIds];

                    // 드래그 준비
                    this.dragPending = true; // 드래그 시작 대기
                    this.isDragging = false; // 아직 드래그 중 아님
                    this.dragStartX = e.clientX;
                    this.dragStartY = e.clientY;

                    // 모든 선택된 클립의 시작 값 저장 (현재 시간 기준)
                    this.dragStartValues.clear();
                    this.selectedClipIds.forEach(id => {
                        const c = window.app.timeline.clips[id];
                        if (!c) return;

                        // 애니메이션 시작/끝 값도 저장 (비율 유지를 위해)
                        const posXAnim = c.animation?.posX || { start: 0, end: 0 };
                        const posYAnim = c.animation?.posY || { start: 0, end: 0 };
                        const scaleAnim = c.animation?.scale || { start: 100, end: 100 };
                        const rotationAnim = c.animation?.rotation || { start: 0, end: 0 };

                        this.dragStartValues.set(id, {
                            posX: this.calculateAnimatedValue(c, 'posX', this.currentTime),
                            posY: this.calculateAnimatedValue(c, 'posY', this.currentTime),
                            scale: this.calculateAnimatedValue(c, 'scale', this.currentTime),
                            rotation: this.calculateAnimatedValue(c, 'rotation', this.currentTime),
                            // 애니메이션 원본 값
                            posXStart: posXAnim.start,
                            posXEnd: posXAnim.end,
                            posYStart: posYAnim.start,
                            posYEnd: posYAnim.end,
                            scaleStart: scaleAnim.start,
                            scaleEnd: scaleAnim.end,
                            rotationStart: rotationAnim.start,
                            rotationEnd: rotationAnim.end
                        });
                    });

                    e.preventDefault();
                }
            }

            this.renderTransformHandles();
        } else if (target === this.previewContent || target === this.cameraContainer) {
            // 빈 공간 클릭 - 박스 선택 시작 (previewContent 또는 cameraContainer 클릭)
            const rect = this.previewContent.getBoundingClientRect();
            this.selectionBox.isSelecting = true;
            this.selectionBox.startX = e.clientX - rect.left;
            this.selectionBox.startY = e.clientY - rect.top;
            this.selectionBox.ctrlKey = e.ctrlKey || e.metaKey;

            // Ctrl 키를 누르지 않은 경우 선택 해제
            if (!this.selectionBox.ctrlKey) {
                this.selectedClipIds = [];
                this.clearTransformHandles();
                if (window.app && window.app.timeline) {
                    window.app.timeline.deselectAllClips();
                }
            }

            e.preventDefault();
        }
    }

    handleHandleMouseDown(e, handleElement) {
        const handleType = handleElement.dataset.handle;
        const previewRect = this.previewContent.getBoundingClientRect();

        if (handleType === 'rotate') {
            this.isRotating = true;

            // 회전용 그룹 바운딩 박스 계산 (절대 좌표와 로컬 좌표 모두)
            let minAbsX = Infinity, minAbsY = Infinity, maxAbsX = -Infinity, maxAbsY = -Infinity;
            let minLocalX = Infinity, minLocalY = Infinity, maxLocalX = -Infinity, maxLocalY = -Infinity;

            this.selectedClipIds.forEach(clipId => {
                const clipElement = this.cameraContainer.querySelector(`[data-clip-id="${clipId}"]`);
                if (!clipElement) return;

                const rect = clipElement.getBoundingClientRect();
                // 절대 좌표(클라이언트 기준)
                minAbsX = Math.min(minAbsX, rect.left);
                minAbsY = Math.min(minAbsY, rect.top);
                maxAbsX = Math.max(maxAbsX, rect.right);
                maxAbsY = Math.max(maxAbsY, rect.bottom);

                // 로컬 좌표(previewContent 기준)
                const left = rect.left - previewRect.left;
                const top = rect.top - previewRect.top;
                const right = left + rect.width;
                const bottom = top + rect.height;

                minLocalX = Math.min(minLocalX, left);
                minLocalY = Math.min(minLocalY, top);
                maxLocalX = Math.max(maxLocalX, right);
                maxLocalY = Math.max(maxLocalY, bottom);
            });

            const centerClientX = (minAbsX + maxAbsX) / 2;
            const centerClientY = (minAbsY + maxAbsY) / 2;
            const centerLocalX = (minLocalX + maxLocalX) / 2;
            const centerLocalY = (minLocalY + maxLocalY) / 2;

            const startAngleRad = Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX);

            this.rotateState = {
                centerClientX,
                centerClientY,
                centerLocalX,
                centerLocalY,
                lastAngleRad: startAngleRad,
                accumulatedRad: 0
            };
        } else {
            this.isResizing = true;
            this.resizeHandle = handleType;

            // 초기 바운딩 박스 저장
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            this.selectedClipIds.forEach(clipId => {
                const clipElement = this.cameraContainer.querySelector(`[data-clip-id="${clipId}"]`);
                if (!clipElement) return;

                const rect = clipElement.getBoundingClientRect();
                const left = rect.left - previewRect.left;
                const top = rect.top - previewRect.top;
                const right = left + rect.width;
                const bottom = top + rect.height;

                minX = Math.min(minX, left);
                minY = Math.min(minY, top);
                maxX = Math.max(maxX, right);
                maxY = Math.max(maxY, bottom);
            });

            this.initialBoundingBox = {
                left: minX,
                top: minY,
                right: maxX,
                bottom: maxY,
                width: maxX - minX,
                height: maxY - minY,
                centerX: (minX + maxX) / 2,
                centerY: (minY + maxY) / 2
            };
        }

        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        // 모든 선택된 클립의 시작 값과 화면상 위치 저장
        this.dragStartValues.clear();
        this.selectedClipIds.forEach(id => {
            const c = window.app.timeline.clips[id];
            if (!c) return;

            const clipElement = this.cameraContainer.querySelector(`[data-clip-id="${id}"]`);
            if (!clipElement) return;

            const clipRect = clipElement.getBoundingClientRect();

            // 애니메이션 시작/끝 값도 저장 (비율 유지를 위해)
            const posXAnim = c.animation?.posX || { start: 0, end: 0 };
            const posYAnim = c.animation?.posY || { start: 0, end: 0 };
            const scaleAnim = c.animation?.scale || { start: 100, end: 100 };
            const rotationAnim = c.animation?.rotation || { start: 0, end: 0 };

            this.dragStartValues.set(id, {
                posX: this.calculateAnimatedValue(c, 'posX', this.currentTime),
                posY: this.calculateAnimatedValue(c, 'posY', this.currentTime),
                scale: this.calculateAnimatedValue(c, 'scale', this.currentTime),
                rotation: this.calculateAnimatedValue(c, 'rotation', this.currentTime),
                // 화면상의 실제 위치 (previewContent 기준)
                screenLeft: clipRect.left - previewRect.left,
                screenTop: clipRect.top - previewRect.top,
                screenWidth: clipRect.width,
                screenHeight: clipRect.height,
                // 애니메이션 원본 값
                posXStart: posXAnim.start,
                posXEnd: posXAnim.end,
                posYStart: posYAnim.start,
                posYEnd: posYAnim.end,
                scaleStart: scaleAnim.start,
                scaleEnd: scaleAnim.end,
                rotationStart: rotationAnim.start,
                rotationEnd: rotationAnim.end
            });
        });

        e.preventDefault();
        e.stopPropagation();
    }

    handleMouseMove(e) {
        // 드래그 대기 상태에서 임계값 이상 움직이면 드래그 시작
        if (this.dragPending && !this.isResizing && !this.isRotating) {
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > this.DRAG_THRESHOLD) {
                this.isDragging = true;
                this.dragPending = false;
            }
        }

        if (this.selectionBox.isSelecting) {
            this.handleBoxSelectMove(e);
        } else if (this.isDragging && this.selectedClipIds.length > 0) {
            this.handleDragMove(e);
        } else if (this.isResizing && this.selectedClipIds.length > 0) {
            this.handleResizeMove(e);
        } else if (this.isRotating && this.selectedClipIds.length > 0) {
            this.handleRotateMove(e);
        }
    }

    handleBoxSelectMove(e) {
        const rect = this.previewContent.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const left = Math.min(this.selectionBox.startX, currentX);
        const top = Math.min(this.selectionBox.startY, currentY);
        const width = Math.abs(currentX - this.selectionBox.startX);
        const height = Math.abs(currentY - this.selectionBox.startY);

        // 박스 표시
        this.selectionBox.element.style.display = 'block';
        this.selectionBox.element.style.left = left + 'px';
        this.selectionBox.element.style.top = top + 'px';
        this.selectionBox.element.style.width = width + 'px';
        this.selectionBox.element.style.height = height + 'px';
    }

    handleDragMove(e) {
        const rect = this.previewContent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const pixelDeltaX = e.clientX - this.dragStartX;
        const pixelDeltaY = e.clientY - this.dragStartY;

        // 픽셀 변화량을 논리적 좌표 변화량으로 변환
        const logicalDeltaX = (pixelDeltaX / rect.width) * this.LOGICAL_CANVAS_WIDTH;
        const logicalDeltaY = (-pixelDeltaY / rect.height) * this.LOGICAL_CANVAS_HEIGHT; // Y축 반전

        const isShiftDrag = e.shiftKey; // Shift 키 체크

        // 모든 선택된 클립에 동일한 델타 적용
        this.selectedClipIds.forEach(clipId => {
            const startValues = this.dragStartValues.get(clipId);
            if (!startValues) return;

            const newPosX = startValues.posX + logicalDeltaX;
            const newPosY = startValues.posY + logicalDeltaY;

            if (isShiftDrag) {
                // Shift + 드래그: 현재 방식 (시작 또는 끝 중 하나만 변경)
                this.updateClipAnimation(clipId, 'posX', newPosX, newPosX);
                this.updateClipAnimation(clipId, 'posY', newPosY, newPosY);
            } else {
                // 일반 드래그: 시작/끝 차이를 유지하며 둘 다 변경
                this.updateClipAnimationBoth(clipId, 'posX', startValues.posXStart + logicalDeltaX, startValues.posXEnd + logicalDeltaX);
                this.updateClipAnimationBoth(clipId, 'posY', startValues.posYStart + logicalDeltaY, startValues.posYEnd + logicalDeltaY);
            }
        });

        this.update(this.currentTime);
        this.renderTransformHandles();
    }

    handleResizeMove(e) {
        if (!this.initialBoundingBox) return;

        const previewRect = this.previewContent.getBoundingClientRect();
        const mouseX = e.clientX - previewRect.left;
        const mouseY = e.clientY - previewRect.top;

        const iBox = this.initialBoundingBox;
        const centerX = iBox.centerX;
        const centerY = iBox.centerY;

        // 초기 마우스 위치 (previewContent 기준)
        const initialMouseX = this.dragStartX - previewRect.left;
        const initialMouseY = this.dragStartY - previewRect.top;

        // 중심점에서 초기 마우스 위치까지의 거리
        const initialDist = Math.sqrt(Math.pow(initialMouseX - centerX, 2) + Math.pow(initialMouseY - centerY, 2));

        // 중심점에서 현재 마우스 위치까지의 거리
        const currentDist = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));

        // 스케일 비율 계산
        if (initialDist < 1) return; // 분모가 0이 되는 것 방지
        const scaleRatio = currentDist / initialDist;

        const isShiftResize = e.shiftKey; // Shift 키 체크

        // 모든 선택된 클립에 scale과 위치 적용
        this.selectedClipIds.forEach(clipId => {
            const startValues = this.dragStartValues.get(clipId);
            if (!startValues) return;

            // 1. 스케일 업데이트
            const newScale = Math.max(1, startValues.scale * scaleRatio); // 최소 스케일 1%
            
            if (isShiftResize) {
                // Shift + 리사이즈: 현재 방식 (시작 또는 끝 중 하나만 변경)
                this.updateClipAnimation(clipId, 'scale', newScale, newScale);
            } else {
                // 일반 리사이즈: 시작/끝 차이를 유지하며 둘 다 변경
                const scaleDelta = newScale - startValues.scale;
                const newScaleStart = Math.max(1, startValues.scaleStart + scaleDelta); // 최소 1% 보장
                const newScaleEnd = Math.max(1, startValues.scaleEnd + scaleDelta); // 최소 1% 보장
                this.updateClipAnimationBoth(clipId, 'scale', newScaleStart, newScaleEnd);
            }

            // 2. 위치 업데이트 (그룹의 중심점을 기준으로)
            const initialClipCenterX = startValues.screenLeft + startValues.screenWidth / 2;
            const initialClipCenterY = startValues.screenTop + startValues.screenHeight / 2;

            // 그룹 중심점에서 클립 중심점까지의 벡터 (픽셀 좌표)
            const vecX = initialClipCenterX - centerX;
            const vecY = initialClipCenterY - centerY;

            // 스케일링된 벡터
            const newVecX = vecX * scaleRatio;
            const newVecY = vecY * scaleRatio;

            // 새로운 클립 중심점
            const newClipCenterX = centerX + newVecX;
            const newClipCenterY = centerY + newVecY;

            // 위치 변화량 (픽셀)
            const pixelDeltaX = newClipCenterX - initialClipCenterX;
            const pixelDeltaY = newClipCenterY - initialClipCenterY;

            // 픽셀 좌표를 논리적 좌표로 변환
            const logicalDeltaX = (pixelDeltaX / previewRect.width) * this.LOGICAL_CANVAS_WIDTH;
            const logicalDeltaY = (-pixelDeltaY / previewRect.height) * this.LOGICAL_CANVAS_HEIGHT; // Y축 반전

            // 새로운 애니메이션 위치값
            const newPosX = startValues.posX + logicalDeltaX;
            const newPosY = startValues.posY + logicalDeltaY;

            if (isShiftResize) {
                this.updateClipAnimation(clipId, 'posX', newPosX, newPosX);
                this.updateClipAnimation(clipId, 'posY', newPosY, newPosY);
            } else {
                this.updateClipAnimationBoth(clipId, 'posX', startValues.posXStart + logicalDeltaX, startValues.posXEnd + logicalDeltaX);
                this.updateClipAnimationBoth(clipId, 'posY', startValues.posYStart + logicalDeltaY, startValues.posYEnd + logicalDeltaY);
            }
        });

        this.update(this.currentTime);
        this.renderTransformHandles();
    }

    handleRotateMove(e) {
        if (!window.app || !window.app.timeline) return;

        // 연속 회전 상태가 없으면 종료
        if (!this.rotateState) return;

        const state = this.rotateState;
        const previewRect = this.previewContent.getBoundingClientRect();

        // 현재 각도 계산 (클라이언트 기준 중심 사용)
        const currentAngleRad = Math.atan2(e.clientY - state.centerClientY, e.clientX - state.centerClientX);

        // 프레임 간 각도 변화(스텝)를 -π~π로 정규화하여 누적 => 경계 통과 시 튐 방지
        let stepRad = currentAngleRad - state.lastAngleRad;
        if (stepRad < -Math.PI) stepRad += Math.PI * 2;
        else if (stepRad > Math.PI) stepRad -= Math.PI * 2;
        state.accumulatedRad += stepRad;
        state.lastAngleRad = currentAngleRad;

        const deltaAngleRad = state.accumulatedRad;
        const deltaAngleDeg = deltaAngleRad * (180 / Math.PI);
        
        // 픽셀 좌표계에서의 회전 (위치 계산용)
        const cosAngle = Math.cos(deltaAngleRad);
        const sinAngle = Math.sin(deltaAngleRad);

        // 그룹 중심점 (previewContent 로컬 좌표)
        const groupCenterX = state.centerLocalX;
        const groupCenterY = state.centerLocalY;

        const isShiftRotate = e.shiftKey; // Shift 키 체크

        // 모든 선택된 클립에 동일한 회전 변화 적용
        this.selectedClipIds.forEach(clipId => {
            const startValues = this.dragStartValues.get(clipId);
            if (!startValues) return;

            // Y축 반전 좌표계에 맞춰 회전 각도 반전
            const newRotation = startValues.rotation - deltaAngleDeg;

            if (isShiftRotate) {
                // Shift + 회전: 현재 방식 (시작 또는 끝 중 하나만 변경)
                this.updateClipAnimation(clipId, 'rotation', newRotation, newRotation);
            } else {
                // 일반 회전: 시작/끝 차이를 유지하며 둘 다 변경
                const rotationDelta = newRotation - startValues.rotation;
                this.updateClipAnimationBoth(clipId, 'rotation', startValues.rotationStart + rotationDelta, startValues.rotationEnd + rotationDelta);
            }

            // 위치값 업데이트 (그룹 중심 기준 회전)
            const initialClipCenterX = startValues.screenLeft + startValues.screenWidth / 2;
            const initialClipCenterY = startValues.screenTop + startValues.screenHeight / 2;

            // 그룹 중심점으로부터의 상대 좌표 (픽셀)
            const relX = initialClipCenterX - groupCenterX;
            const relY = initialClipCenterY - groupCenterY;

            // 상대 좌표 회전 (픽셀 좌표계)
            const newRelX = relX * cosAngle - relY * sinAngle;
            const newRelY = relX * sinAngle + relY * cosAngle;

            // 새로운 클립 중심점 (픽셀)
            const newClipCenterX = groupCenterX + newRelX;
            const newClipCenterY = groupCenterY + newRelY;

            // 위치 변화량 (픽셀)
            const pixelDeltaX = newClipCenterX - initialClipCenterX;
            const pixelDeltaY = newClipCenterY - initialClipCenterY;

            // 픽셀 좌표를 논리적 좌표로 변환
            const logicalDeltaX = (pixelDeltaX / previewRect.width) * this.LOGICAL_CANVAS_WIDTH;
            const logicalDeltaY = (-pixelDeltaY / previewRect.height) * this.LOGICAL_CANVAS_HEIGHT; // Y축 반전

            // 새로운 애니메이션 위치 적용
            const newPosX = startValues.posX + logicalDeltaX;
            const newPosY = startValues.posY + logicalDeltaY;

            if (isShiftRotate) {
                this.updateClipAnimation(clipId, 'posX', newPosX, newPosX);
                this.updateClipAnimation(clipId, 'posY', newPosY, newPosY);
            } else {
                this.updateClipAnimationBoth(clipId, 'posX', startValues.posXStart + logicalDeltaX, startValues.posXEnd + logicalDeltaX);
                this.updateClipAnimationBoth(clipId, 'posY', startValues.posYStart + logicalDeltaY, startValues.posYEnd + logicalDeltaY);
            }
        });

        this.update(this.currentTime);
        this.renderTransformHandles();
    }

    handleMouseUp(e) {
        if (this.selectionBox.isSelecting) {
            this.handleBoxSelectEnd(e);
        } else if (this.isDragging || this.isResizing || this.isRotating) {
            // 상태 저장
            if (window.app && window.app.timeline) {
                window.app.timeline.saveState('트랜스폼 조정');
            }
        }

        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.rotateState = null;
        this.dragPending = false; // 드래그 대기 상태도 초기화
        this.resizeHandle = null;
    }

    handleBoxSelectEnd(e) {
        if (!window.app || !window.app.timeline) return;

        const boxWidth = parseFloat(this.selectionBox.element.style.width || '0');
        const boxHeight = parseFloat(this.selectionBox.element.style.height || '0');

        // 박스가 충분히 크면 선택 처리
        if (boxWidth > 5 || boxHeight > 5) {
            const rect = this.previewContent.getBoundingClientRect();
            const boxRect = this.selectionBox.element.getBoundingClientRect();

            // 박스 내의 클립들 찾기
            const selectedIds = this.selectionBox.ctrlKey ? [...this.selectedClipIds] : [];
            const clips = window.app.timeline.getAllClips();

            Object.values(clips).forEach(clip => {
                if (clip.type === 'fill') return;

                const clipElement = this.cameraContainer.querySelector(`[data-clip-id="${clip.id}"]`);
                if (!clipElement) return;

                const clipRect = clipElement.getBoundingClientRect();

                // 박스와 교차하는지 확인
                const intersects = !(
                    clipRect.right < boxRect.left ||
                    clipRect.left > boxRect.right ||
                    clipRect.bottom < boxRect.top ||
                    clipRect.top > boxRect.bottom
                );

                if (intersects && !selectedIds.includes(clip.id)) {
                    selectedIds.push(clip.id);
                }
            });

            // 선택 적용
            if (selectedIds.length > 0) {
                this.selectedClipIds = selectedIds;
                window.app.timeline.selectedClipIds = [...selectedIds];

                // 타임라인의 주 선택 클립 ID 설정 (마지막 선택된 클립 기준)
                window.app.timeline.selectedClipId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;

                // 타임라인 및 관련 패널들의 UI 업데이트를 한번에 처리
                window.app.timeline.updateClipSelection();

                this.renderTransformHandles();
            }
        }

        // 박스 숨기기
        this.selectionBox.isSelecting = false;
        this.selectionBox.element.style.display = 'none';
        this.selectionBox.ctrlKey = false;
    }

    updateClipAnimation(clipId, property, startValue, endValue) {
        if (!window.app || !window.app.timeline) return;

        const clip = window.app.timeline.clips[clipId];
        if (!clip) return;

        if (!clip.animation) clip.animation = {};
        if (!clip.animation[property]) {
            clip.animation[property] = {
                start: 0,
                end: 0,
                easing: 'easeInOut'
            };
        }

        const anim = clip.animation[property];

        // 전달된 값은 "현재 시간에서의 목표 값"으로 해석한다
        const round1 = (v) => Math.round(v * 10) / 10;
        const currentValue = round1(startValue); // 기존 호출부는 start/end 동일값을 넘김, 0.1 단위 반올림

        const clipStartTime = clip.startTime;
        const clipEndTime = clip.startTime + clip.duration;
        const duration = Math.max(clipEndTime - clipStartTime, 1e-6);

        // 현재 시간 기준 진행도 및 이징 값
        const rawProgress = Math.max(0, Math.min(1, (this.currentTime - clipStartTime) / duration));
        const easingFunc = this.easingFunctions[anim.easing] || this.easingFunctions.linear;
        const u = easingFunc(rawProgress);

        // 어느 키를 수정할지 결정: 현재 시간이 더 가까운 쪽 (시작/끝)
        const distToStart = Math.abs(this.currentTime - clipStartTime);
        const distToEnd = Math.abs(clipEndTime - this.currentTime);

        let newStart = anim.start;
        let newEnd = anim.end;

        // 수치적 안정성: u가 0 또는 1에 매우 근접하면 해당 반대 키를 조정
        const EPS = 1e-6;

        if (distToStart <= distToEnd) {
            // 시작 키 조정 (u != 1 필요)
            if (u >= 1 - EPS) {
                // 끝에 매우 가까우면 끝 키 조정으로 대체
                const denom = Math.max(u, EPS);
                newEnd = (currentValue - anim.start * (1 - u)) / denom;
            } else {
                const denom = Math.max(1 - u, EPS);
                newStart = (currentValue - anim.end * u) / denom;
            }
        } else {
            // 끝 키 조정 (u != 0 필요)
            if (u <= EPS) {
                // 시작에 매우 가까우면 시작 키 조정으로 대체
                const denom = Math.max(1 - u, EPS);
                newStart = (currentValue - anim.end * u) / denom;
            } else {
                const denom = Math.max(u, EPS);
                newEnd = (currentValue - anim.start * (1 - u)) / denom;
            }
        }

        // 스케일은 최소 1% 보장
        if (property === 'scale') {
            newStart = Math.max(1, newStart);
            newEnd = Math.max(1, newEnd);
        }

        clip.animation[property].start = round1(newStart);
        clip.animation[property].end = round1(newEnd);

        window.app.timeline.updateClipData(clipId, {
            animation: clip.animation
        });

        // PropertiesPanel 업데이트 (단일 선택인 경우만)
        if (window.app.propertiesPanel && this.selectedClipIds.length === 1 && this.selectedClipIds[0] === clipId) {
            window.app.propertiesPanel.updateTransformProperties(clip);
        }
    }

    /**
     * 클립 애니메이션 양쪽(시작/끝) 모두 업데이트 (비율 유지)
     */
    updateClipAnimationBoth(clipId, property, startValue, endValue) {
        if (!window.app || !window.app.timeline) return;

        const clip = window.app.timeline.clips[clipId];
        if (!clip) return;

        if (!clip.animation) clip.animation = {};
        if (!clip.animation[property]) {
            clip.animation[property] = {
                start: 0,
                end: 0,
                easing: 'easeInOut'
            };
        }

        const round1 = (v) => Math.round(v * 10) / 10;

        // 스케일은 최소 1% 보장
        if (property === 'scale') {
            startValue = Math.max(1, startValue);
            endValue = Math.max(1, endValue);
        }

        clip.animation[property].start = round1(startValue);
        clip.animation[property].end = round1(endValue);

        window.app.timeline.updateClipData(clipId, {
            animation: clip.animation
        });

        // PropertiesPanel 업데이트 (단일 선택인 경우만)
        if (window.app.propertiesPanel && this.selectedClipIds.length === 1 && this.selectedClipIds[0] === clipId) {
            window.app.propertiesPanel.updateTransformProperties(clip);
        }
    }

    renderTransformHandles() {
        this.clearTransformHandles();

        if (this.selectedClipIds.length === 0 || !window.app || !window.app.timeline) return;

        // 다중 선택일 경우 모든 오브젝트의 바운딩 박스 계산
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.selectedClipIds.forEach(clipId => {
            const clip = window.app.timeline.clips[clipId];
            if (!clip || clip.type === 'fill') return;

            const clipElement = this.previewContent.querySelector(`[data-clip-id="${clipId}"]`);
            if (!clipElement) return;

            const rect = clipElement.getBoundingClientRect();
            const previewRect = this.previewContent.getBoundingClientRect();

            const left = rect.left - previewRect.left;
            const top = rect.top - previewRect.top;
            const right = left + rect.width;
            const bottom = top + rect.height;

            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, right);
            maxY = Math.max(maxY, bottom);
        });

        if (minX === Infinity) return;

        const relativeRect = {
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY
        };

        // 컨테이너 생성
        const container = document.createElement('div');
        container.className = 'transform-controls';
        container.style.position = 'absolute';
        container.style.left = relativeRect.left + 'px';
        container.style.top = relativeRect.top + 'px';
        container.style.width = relativeRect.width + 'px';
        container.style.height = relativeRect.height + 'px';
        container.style.pointerEvents = 'none';

        // 테두리
        const border = document.createElement('div');
        border.className = 'transform-border';
        border.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border: 2px solid #00a8ff;
            pointer-events: none;
        `;
        container.appendChild(border);

        // 핸들 위치
        const handles = [
            { type: 'nw', style: 'top: -5px; left: -5px; cursor: nwse-resize;' },
            { type: 'ne', style: 'top: -5px; right: -5px; cursor: nesw-resize;' },
            { type: 'sw', style: 'bottom: -5px; left: -5px; cursor: nesw-resize;' },
            { type: 'se', style: 'bottom: -5px; right: -5px; cursor: nwse-resize;' }
        ];

        handles.forEach(h => {
            const handle = document.createElement('div');
            handle.className = 'transform-handle';
            handle.dataset.handle = h.type;
            handle.style.cssText = `
                position: absolute;
                width: 10px;
                height: 10px;
                background: #00a8ff;
                border: 2px solid white;
                border-radius: 50%;
                pointer-events: auto;
                ${h.style}
            `;
            container.appendChild(handle);
        });

        // 회전 핸들
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'transform-handle';
        rotateHandle.dataset.handle = 'rotate';
        rotateHandle.style.cssText = `
            position: absolute;
            width: 10px;
            height: 10px;
            background: #00ff00;
            border: 2px solid white;
            border-radius: 50%;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            pointer-events: auto;
            cursor: grab;
        `;
        container.appendChild(rotateHandle);

        // 회전 핸들 연결선
        const rotateLine = document.createElement('div');
        rotateLine.style.cssText = `
            position: absolute;
            width: 2px;
            height: 20px;
            background: #00ff00;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            pointer-events: none;
        `;
        container.appendChild(rotateLine);

        this.previewContent.appendChild(container);
    }

    clearTransformHandles() {
        const existing = this.previewContent.querySelectorAll('.transform-controls');
        existing.forEach(el => el.remove());
    }

    /**
     * 미리보기 업데이트
     */
    update(time) {
        this.currentTime = time;
        this.render();

        // 선택된 클립이 있으면 핸들 다시 렌더링
        if (this.selectedClipIds.length > 0) {
            this.renderTransformHandles();
        }
    }

    /**
     * 카메라 변환 계산
     */
    getCameraTransformAtTime(time) {
        if (!window.app || !window.app.timeline) {
            return { x: 0, y: 0, scale: 100, rotation: 0 };
        }

        const timeline = window.app.timeline;
        const keyframes = timeline.cameraKeyframes || [];

        // 키프레임이 없으면 기본값
        if (keyframes.length === 0) {
            return { x: 0, y: 0, scale: 100, rotation: 0 };
        }

        // 0초에 기본 키프레임 추가
        const allKeyframes = [
            { time: 0, values: { x: 0, y: 0, scale: 100, rotation: 0 }, easing: 'linear' },
            ...keyframes
        ].sort((a, b) => a.time - b.time);

        // 현재 시간에 해당하는 키프레임 구간 찾기
        let prevKeyframe = allKeyframes[0];
        let nextKeyframe = null;

        for (let i = 0; i < allKeyframes.length; i++) {
            if (allKeyframes[i].time <= time) {
                prevKeyframe = allKeyframes[i];
            }
            if (allKeyframes[i].time > time) {
                nextKeyframe = allKeyframes[i];
                break;
            }
        }

        // 마지막 키프레임 이후면 마지막 값 유지
        if (!nextKeyframe) {
            return prevKeyframe.values;
        }

        // 두 키프레임 사이에서 보간
        const duration = nextKeyframe.time - prevKeyframe.time;
        const elapsed = time - prevKeyframe.time;
        const t = duration > 0 ? elapsed / duration : 0;

        // 이징 적용
        const easing = nextKeyframe.easing || 'linear';
        const easingFunc = this.easingFunctions[easing] || this.easingFunctions.linear;
        const easedT = easingFunc(t);

        // 값 보간
        return {
            x: prevKeyframe.values.x + (nextKeyframe.values.x - prevKeyframe.values.x) * easedT,
            y: prevKeyframe.values.y + (nextKeyframe.values.y - prevKeyframe.values.y) * easedT,
            scale: prevKeyframe.values.scale + (nextKeyframe.values.scale - prevKeyframe.values.scale) * easedT,
            rotation: prevKeyframe.values.rotation + (nextKeyframe.values.rotation - prevKeyframe.values.rotation) * easedT
        };
    }

    /**
     * 카메라 변환 적용
     */
    applyCameraTransform({ direction = 0, x = 0, y = 0, scale = 1 }) {
        const camera = this.cameraState || { x: 0, y: 0, scale: 1, rotation: 0 };

        const cameraRotation = Number.isFinite(camera.rotation) ? camera.rotation : 0;
        const rawCameraScale = Number.isFinite(camera.scale) ? camera.scale : 1;
        const cameraScale = rawCameraScale === 0 ? 0.0001 : Math.abs(rawCameraScale);

        const rad = cameraRotation * Math.PI / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        const relX = (cosR * (x - camera.x)) - (sinR * (y - camera.y));
        const relY = (sinR * (x - camera.x)) + (cosR * (y - camera.y));

        return {
            direction: direction - cameraRotation,
            x: relX * cameraScale,
            y: relY * cameraScale,
            scale: scale * cameraScale
        };
    }

    /**
     * 렌더링
     */
    render() {
        if (!this.previewContent || !this.cameraContainer) return;

        // 캔버스 크기 변경 감지 및 오브젝트 스케일 조절
        const rect = this.previewContent.getBoundingClientRect();
        if (this.lastCanvasWidth > 0 && this.lastCanvasHeight > 0) {
            const widthRatio = rect.width / this.lastCanvasWidth;
            const heightRatio = rect.height / this.lastCanvasHeight;
            
            // 가로/세로 중 작은 비율을 사용 (비율 유지)
            const scaleRatio = Math.min(widthRatio, heightRatio);
            
            // 크기가 실제로 변경되었을 때만 처리
            if (Math.abs(scaleRatio - 1.0) > 0.001) {
                this.scaleAllClips(scaleRatio);
            }
        }
        
        // 현재 캔버스 크기 저장
        this.lastCanvasWidth = rect.width;
        this.lastCanvasHeight = rect.height;

        // 카메라 변환 계산 및 적용
        const cameraTransform = this.getCameraTransformAtTime(this.currentTime);
        const cameraX = Number(cameraTransform.x);
        const cameraY = Number(cameraTransform.y);
        const cameraRotation = Number(cameraTransform.rotation);
        const cameraScalePercent = Number(cameraTransform.scale);
        const normalizedCameraScale = Number.isFinite(cameraScalePercent) ? cameraScalePercent / 100 : 1;
        this.cameraState = {
            x: Number.isFinite(cameraX) ? cameraX : 0,
            y: Number.isFinite(cameraY) ? cameraY : 0,
            scale: normalizedCameraScale,
            rotation: Number.isFinite(cameraRotation) ? cameraRotation : 0
        };

        // 카메라 변환은 각 요소에 개별 적용하므로 컨테이너는 초기화
        this.cameraContainer.style.transform = '';

        // 기존 요소 제거 (핸들과 선택 박스 제외)
        const handles = this.previewContent.querySelectorAll('.transform-controls');
        const selectionBox = this.previewContent.querySelector('.selection-box');
        this.cameraContainer.innerHTML = '';

        if (!window.app || !window.app.timeline) return;

        const clips = window.app.timeline.getAllClips();

        // 현재 시간에 활성화된 클립들을 렌더링
        // Z-order를 위해 트랙 역순으로 정렬 (아래쪽 트랙이 위에 렌더링)
        const activeClips = Object.values(clips)
            .filter(clip => {
                const endTime = clip.startTime + clip.duration;
                // 숨겨진 클립은 렌더링하지 않음
                const isHidden = window.app.timeline.isClipHidden(clip.id);
                return this.currentTime >= clip.startTime && this.currentTime <= endTime && !isHidden;
            })
            .sort((a, b) => b.trackIndex - a.trackIndex);

        activeClips.forEach(clip => {
            this.renderClip(clip);
        });

        // 선택 박스와 핸들을 맨 위로 (카메라 컨테이너 밖)
        if (selectionBox) this.previewContent.appendChild(selectionBox);
        handles.forEach(h => this.previewContent.appendChild(h));
    }

    /**
     * 클립 렌더링
     */
    renderClip(clip) {
        switch (clip.type) {
            case 'text':
                this.renderTextClip(clip);
                break;
            case 'rectangle':
                this.renderRectangleClip(clip);
                break;
            case 'circle':
                this.renderCircleClip(clip);
                break;
            case 'triangle':
                this.renderTriangleClip(clip);
                break;
            case 'star':
                this.renderStarClip(clip);
                break;
            case 'heart':
                this.renderHeartClip(clip);
                break;
            case 'hexagon':
                this.renderHexagonClip(clip);
                break;
            case 'diamond':
                this.renderDiamondClip(clip);
                break;
            case 'pentagon':
                this.renderPentagonClip(clip);
                break;
            case 'arrow':
                this.renderArrowClip(clip);
                break;
            case 'speechBubble':
                this.renderSpeechBubbleClip(clip);
                break;
            case 'cross':
                this.renderCrossClip(clip);
                break;
            case 'image':
                this.renderImageClip(clip);
                break;
            case 'fill':
                this.renderFillClip(clip);
                break;
        }
    }

    /**
     * 텍스트 클립 렌더링
     */
    renderTextClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-text';
        element.dataset.clipId = clip.id;
        element.textContent = clip.content || '새 텍스트';

        // 텍스트 스타일 적용
        element.style.fontFamily = clip.fontFamily || '나눔고딕';
        element.style.fontSize = (clip.fontSize || 32) + 'px';
        element.style.color = clip.textColor || '#ffffff';

        if (clip.bgTransparent) {
            element.style.backgroundColor = 'transparent';
        } else {
            element.style.backgroundColor = clip.bgColor || '#000000';
        }

        if (clip.bold) element.style.fontWeight = 'bold';
        if (clip.italic) element.style.fontStyle = 'italic';
        if (clip.underline) element.style.textDecoration = 'underline';

        // 변형 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 사각형 클립 렌더링
     */
    renderRectangleClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-rect';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        element.style.width = size + 'px';
        element.style.height = size + 'px';
        element.style.backgroundColor = clip.shapeColor || '#FF0000';

        // 변형 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 원 클립 렌더링
     */
    renderCircleClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-circle';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        element.style.width = size + 'px';
        element.style.height = size + 'px';
        element.style.borderRadius = '50%';
        element.style.backgroundColor = clip.shapeColor || '#00FF00';

        // 변형 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 삼각형 클립 렌더링
     */
    renderTriangleClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-triangle';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        const color = clip.shapeColor || '#FFFF00';

        // SVG로 삼각형 생성
        const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <polygon points="50,15 85,85 15,85"
                     fill="${color}" />
        </svg>`;
        element.innerHTML = svg;

        // 변형 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 별 클립 렌더링
     */
    renderStarClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-star';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        const color = clip.shapeColor || '#FFD700';

        // SVG로 별 모양 생성
        const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <polygon points="50,10 61,35 88,35 67,52 74,77 50,60 26,77 33,52 12,35 39,35"
                     fill="${color}" />
        </svg>`;
        element.innerHTML = svg;

        // 변형 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 하트 클립 렌더링
     */
    renderHeartClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-heart';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        const color = clip.shapeColor || '#FF1493';

        // SVG로 하트 모양 생성
        const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <path d="M50,85 C50,85 15,60 15,40 C15,25 25,15 35,15 C42,15 48,20 50,25 C52,20 58,15 65,15 C75,15 85,25 85,40 C85,60 50,85 50,85 Z"
                  fill="${color}" />
        </svg>`;
        element.innerHTML = svg;

        // 변형 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 육각형 클립 렌더링
     */
    renderHexagonClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-hexagon';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        const color = clip.shapeColor || '#00CED1';

        // SVG로 육각형 생성
        const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <polygon points="50,5 93.3,25 93.3,75 50,95 6.7,75 6.7,25"
                     fill="${color}" />
        </svg>`;
        element.innerHTML = svg;

        // 변형 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 다이아몬드 클립 렌더링
     */
    renderDiamondClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-diamond';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        const color = clip.shapeColor || '#FF69B4';

        // SVG로 다이아몬드 생성
        const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <polygon points="50,10 85,50 50,90 15,50"
                     fill="${color}" />
        </svg>`;
        element.innerHTML = svg;

        // 변형 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 오각형 클립 렌더링
     */
    renderPentagonClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-pentagon';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        const color = clip.shapeColor || '#9370DB';

        // SVG로 오각형 생성
        const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <polygon points="50,10 90,40 75,85 25,85 10,40"
                     fill="${color}" />
        </svg>`;
        element.innerHTML = svg;

        // 변형 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 화살표 클립 렌더링
     */
    renderArrowClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-arrow';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        const color = clip.shapeColor || '#4682B4';

        const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <polygon points="50,10 70,40 55,40 55,90 45,90 45,40 30,40" fill="${color}" />
        </svg>`;
        element.innerHTML = svg;

        this.applyTransform(element, clip);
        this.cameraContainer.appendChild(element);
    }

    /**
     * 말풍선 클립 렌더링
     */
    renderSpeechBubbleClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-speechBubble';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        const color = clip.shapeColor || '#3CB371';

        const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <path d="M10 10 H 90 V 70 H 55 L 50 80 L 45 70 H 10 Z" fill="${color}" />
        </svg>`;
        element.innerHTML = svg;

        this.applyTransform(element, clip);
        this.cameraContainer.appendChild(element);
    }

    /**
     * 십자 클립 렌더링
     */
    renderCrossClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-cross';
        element.dataset.clipId = clip.id;

        const size = clip.shapeSize || 100;
        const color = clip.shapeColor || '#6A5ACD';

        const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <polygon points="20,10 10,20 40,50 10,80 20,90 50,60 80,90 90,80 60,50 90,20 80,10 50,40" fill="${color}" />
        </svg>`;
        element.innerHTML = svg;

        this.applyTransform(element, clip);
        this.cameraContainer.appendChild(element);
    }

    /**
     * 이미지 클립 렌더링
     */
    renderImageClip(clip) {
        if (!clip.imageURL) return;

        const container = document.createElement('div');
        container.className = 'preview-image';
        container.dataset.clipId = clip.id;

        const img = document.createElement('img');
        img.src = clip.imageURL;
        
        // 이미지가 로드되면 컨테이너 크기를 이미지 비율에 맞게 설정
        img.onload = () => {
            // 이미지의 원본 비율 유지
            const aspectRatio = img.naturalWidth / img.naturalHeight;

            // 기본 크기 설정 (200px 기준, 비율 유지)
            let displayWidth, displayHeight;
            if (aspectRatio >= 1) {
                // 가로가 더 긴 이미지
                displayWidth = 200;
                displayHeight = 200 / aspectRatio;
            } else {
                // 세로가 더 긴 이미지
                displayHeight = 200;
                displayWidth = 200 * aspectRatio;
            }

            container.style.width = displayWidth + 'px';
            container.style.height = displayHeight + 'px';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';

            // 변형 다시 적용 (크기 변경 후)
            this.applyTransform(container, clip);

            // 선택된 클립이면 변환 핸들도 다시 렌더링 (requestAnimationFrame으로 최적화)
            if (this.selectedClipIds.includes(clip.id)) {
                requestAnimationFrame(() => {
                    this.renderTransformHandles();
                });
            }
        };
        
        // 이미지가 이미 로드된 경우를 위한 처리
        if (img.complete) {
            img.onload();
        }

        container.appendChild(img);

        // 초기 변형 적용
        this.applyTransform(container, clip);

        this.cameraContainer.appendChild(container);
    }

    /**
     * 배경 채우기 클립 렌더링
     */
    renderFillClip(clip) {
        const element = document.createElement('div');
        element.className = 'preview-fill';
        element.dataset.clipId = clip.id;
        element.style.backgroundColor = clip.fillColor || '#0000FF';

        // 애니메이션 적용된 투명도 (100 = 투명, 0 = 불투명)
        const opacityValue = this.calculateAnimatedValue(clip, 'opacity', this.currentTime);
        const opacity = (100 - opacityValue) / 100;
        element.style.opacity = opacity;

        // 카메라 변환 적용
        this.applyTransform(element, clip);

        this.cameraContainer.appendChild(element);
    }

    /**
     * 애니메이션 값 계산
     */
    calculateAnimatedValue(clip, property, currentTime) {
        if (!clip.animation || !clip.animation[property]) {
            // 애니메이션이 없으면 기본값 반환
            const defaults = { posX: 0, posY: 0, scale: 100, rotation: 0, opacity: 0 };
            return defaults[property];
        }

        const anim = clip.animation[property];
        const { start, end, easing } = anim;

        // 클립 내에서의 진행도 계산 (0~1)
        const clipStartTime = clip.startTime;
        const clipDuration = clip.duration;
        const progress = Math.max(0, Math.min(1, (currentTime - clipStartTime) / clipDuration));

        // Easing 함수 적용
        const easingFunc = this.easingFunctions[easing] || this.easingFunctions.linear;
        const easedProgress = easingFunc(progress);

        // 시작값과 끝값 사이를 보간
        return start + (end - start) * easedProgress;
    }

    /**
     * 변형 적용 (위치, 크기, 회전, 투명도)
     */
    applyTransform(element, clip) {
        const rect = this.previewContent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // 현재 시간에 따라 애니메이션 값 계산
        const logicalPosX = this.calculateAnimatedValue(clip, 'posX', this.currentTime);
        const logicalPosY = this.calculateAnimatedValue(clip, 'posY', this.currentTime);
        const objectScale = this.calculateAnimatedValue(clip, 'scale', this.currentTime) / 100;
        const rotation = this.calculateAnimatedValue(clip, 'rotation', this.currentTime);
        const opacityValue = this.calculateAnimatedValue(clip, 'opacity', this.currentTime);
        const opacity = (100 - opacityValue) / 100;

        // 카메라 기반 변환 적용 (논리 좌표계 기준)
        const cameraApplied = this.applyCameraTransform({
            direction: rotation,
            x: logicalPosX,
            y: logicalPosY,
            scale: objectScale
        });

        const safeX = Number.isFinite(cameraApplied.x) ? cameraApplied.x : 0;
        const safeY = Number.isFinite(cameraApplied.y) ? cameraApplied.y : 0;
        const safeScale = Number.isFinite(cameraApplied.scale) && cameraApplied.scale > 0 ? cameraApplied.scale : 1;
        const safeDirection = Number.isFinite(cameraApplied.direction) ? cameraApplied.direction : 0;

        // 논리적 좌표를 실제 픽셀 좌표로 변환
        const stageToPixelX = rect.width / this.LOGICAL_CANVAS_WIDTH;
        const stageToPixelY = rect.height / this.LOGICAL_CANVAS_HEIGHT;
        const posX = safeX * stageToPixelX;
        const posY = -safeY * stageToPixelY; // Y축 반전

        // Transform 적용
        let transform = `translate(-50%, -50%)`;

        // 위치 조정 (중앙이 (0, 0))
        if (posX !== 0 || posY !== 0) {
            transform += ` translate(${posX}px, ${posY}px)`;
        }

        // 크기
        if (safeScale !== 1) {
            transform += ` scale(${safeScale})`;
        }

        // 회전 (Y축 반전 좌표계에 맞춰 각도 반전)
        if (safeDirection !== 0) {
            transform += ` rotate(${-safeDirection}deg)`;
        }

        element.style.transform = transform;

        element.style.opacity = opacity;
    }

    /**
     * 모든 요소 제거
     */
    clear() {
        if (this.previewContent) {
            this.previewContent.innerHTML = '';
        }
    }

    /**
     * 타임라인 선택 상태를 동기화 (타임라인 -> 프리뷰)
     */
    syncSelectionFromTimeline() {
        if (!window.app || !window.app.timeline) return;
        this.selectedClipIds = [...window.app.timeline.selectedClipIds];
        this.renderTransformHandles();
    }

    /**
     * 모든 클립의 스케일을 비율에 맞춰 조절
     */
    scaleAllClips(scaleRatio) {
        if (!window.app || !window.app.timeline) return;

        const clips = window.app.timeline.getAllClips();
        
        Object.values(clips).forEach(clip => {
            // fill 타입은 제외
            if (clip.type === 'fill') return;
            
            // 텍스트 폰트 크기 조절
            if (clip.type === 'text' && clip.fontSize) {
                clip.fontSize *= scaleRatio;
            }
            
            // 도형 크기 조절
            if (clip.shapeSize) {
                clip.shapeSize *= scaleRatio;
            }
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PreviewSystem;
}
