/**
 * Timeline Component
 * 타임라인 관리, 클립 추가/편집/삭제, 드래그&드롭, Ctrl+휠로 확대/축소
 */

class Timeline {
    constructor() {
        this.clips = {}; // 모든 클립 데이터 저장
        this.tracks = []; // 트랙 DOM 요소들
        this.selectedClipId = null;
        this.selectedClipIds = []; // 다중 선택된 클립 ID 배열
        this.currentTime = 0;
        this.totalDuration = 300; // 무한 타임라인 (300초 = 5분, 자동 확장)
        this.pixelsPerSecond = 50; // 1초당 픽셀 (Ctrl+휠로 조절 가능)
        this.minZoom = 20;
        this.maxZoom = 200;
        this.clipboard = null; // 복사/잘라내기 데이터
        this.trackClipboard = null; // 트랙 복사 데이터
        this.keyframeClipboard = null; // 카메라 키프레임 복사 데이터
        this.hiddenClips = new Set(); // 숨겨진 클립 ID 저장
        this.timelineMode = 'clip'; // 'clip' 또는 'camera'

        // 카메라 키프레임 데이터
        this.cameraKeyframes = [];
        this.selectedKeyframeId = null; // 선택된 카메라 키프레임 ID

        this.timelineScrollContainer = null;
        this.cameraLabelsContainer = null;

        // Undo/Redo 히스토리
        this.history = []; // 상태 스냅샷 배열
        this.historyIndex = -1; // 현재 히스토리 위치
        this.maxHistorySize = 50; // 최대 히스토리 크기
        this.isRestoringState = false; // 상태 복원 중인지 여부 (무한 루프 방지)

        // 드래그 상태
        this.dragState = {
            isDragging: false,
            isResizing: false,
            resizeDirection: null, // 'left' or 'right'
            clipId: null,
            startX: 0,
            startY: 0,
            startTime: 0,
            startDuration: 0,
            originalTrackIndex: null,
            originalPositions: {}, // 다중 선택 시 각 클립의 원래 위치 저장
            // 카메라 키프레임 드래그 상태
            isDraggingKeyframe: false,
            keyframeId: null,
            keyframeStartTime: 0,
            keyframeHasMoved: false
        };

        // 타임 인디케이터 드래그 상태
        this.timeIndicatorDrag = {
            isDragging: false
        };

        // 드래그 박스 선택 상태
        this.selectionBox = {
            isSelecting: false,
            startX: 0,
            startY: 0,
            element: null,
            ctrlKey: false,
            hasMoved: false
        };

        this.init();
    }

    init() {
        this.timelineBody = document.getElementById('timelineBody');
        this.tracksContainer = document.getElementById('tracksContainer');
        this.timeIndicator = document.getElementById('timeIndicator');
        this.timelineRuler = document.getElementById('timelineRuler');
        this.timelineScrollContainer = document.querySelector('.timeline-scroll-container');
        this.cameraLabelsContainer = document.getElementById('cameraLabelsContainer');

        // 드래그 박스 선택 요소 생성
        this.selectionBox.element = document.createElement('div');
        this.selectionBox.element.className = 'selection-box';
        this.selectionBox.element.style.display = 'none';
        this.timelineBody.appendChild(this.selectionBox.element);

        // 기본 트랙 3개 생성
        this.tracks = [];
        this.isRestoringState = true; // 초기 트랙 생성은 히스토리에 저장하지 않음
        for (let i = 0; i < 3; i++) {
            this.addTrack();
        }
        this.isRestoringState = false;

        this.setupEventListeners();
        this.updateRuler();
        this.updateTimeIndicator();
        this.updateTracksWidth();

        // 초기 상태 저장
        this.saveState('초기 상태');

        // 타임라인 모드 전환 버튼 이벤트
        this.setupModeSwitch();
    }

    setupModeSwitch() {
        const modeBtns = document.querySelectorAll('.timeline-mode-switch .mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                
                // 버튼 활성화 상태 먼저 업데이트
                modeBtns.forEach(b => {
                    b.classList.remove('active');
                    b.disabled = false; // 버튼 활성화
                });
                btn.classList.add('active');
                
                this.switchTimelineMode(mode);
            });
        });
    }

    switchTimelineMode(mode) {
        if (this.timelineMode === mode) return;

        // 드래그 상태 초기화 (모드 전환 시 드래그 상태가 남아있으면 클립 선택 문제 발생)
        this.dragState = {
            isDragging: false,
            isResizing: false,
            isDraggingClip: false,
            isDraggingKeyframe: false,
            isDraggingValue: false,
            keyframeId: null,
            keyframeProperty: null,
            clipId: null,
            resizeHandle: null,
            startX: 0,
            startTime: 0,
            startDuration: 0,
            minValue: 0,
            maxValue: 0,
            keyframeStartValue: null,
            keyframeInitialValue: null
        };

        // 클립/키프레임 선택 상태 초기화
        this.selectedClipId = null;
        this.selectedClipIds = [];
        this.selectedKeyframeId = null;

        this.timelineMode = mode;
        const addTrackBtn = document.getElementById('addTrackBtn');
        const tracksContainer = document.getElementById('tracksContainer');
        const cameraLabelsContainer = document.getElementById('cameraLabelsContainer');

        if (mode === 'camera') {
            // 카메라 모드: 4개의 카메라 타임라인
            tracksContainer.innerHTML = '';
            cameraLabelsContainer.innerHTML = '';
            this.tracks = [];
            cameraLabelsContainer.style.display = 'flex';
            if (this.timelineScrollContainer) {
                cameraLabelsContainer.style.transform = `translateY(-${this.timelineScrollContainer.scrollTop}px)`;
            }

            const cameraProperties = [
                { name: 'X', icon: 'fa-solid fa-arrows-left-right', color: '#ff4444' },
                { name: 'Y', icon: 'fa-solid fa-arrows-up-down', color: '#44ff44' },
                { name: '크기', icon: 'fa-solid fa-expand', color: '#4444ff' },
                { name: '방향', icon: 'fa-solid fa-rotate', color: '#ffaa00' }
            ];

            cameraProperties.forEach((prop, index) => {
                const track = document.createElement('div');
                track.className = 'track camera-timeline-track';
                track.dataset.cameraProperty = prop.name.toLowerCase();
                track.style.width = (this.totalDuration * this.pixelsPerSecond) + 'px';

                // 카메라 트랙 우클릭 이벤트 (빈 곳 클릭 시 키프레임 추가 메뉴)
                track.addEventListener('contextmenu', (e) => {
                    // 키프레임 마커나 그래프 캔버스가 아닌 빈 곳 클릭일 때만
                    if (!e.target.closest('.camera-keyframe-marker') && !e.target.closest('.camera-graph-canvas')) {
                        e.preventDefault();
                        this.showCameraTrackContextMenu(e, track);
                    }
                });

                // 레이블 생성
                const label = document.createElement('div');
                label.className = 'camera-label-item';
                label.style.borderLeft = `3px solid ${prop.color}`;
                label.style.height = '100px'; // 트랙 높이와 일치
                label.style.minHeight = '100px'; // 최소 높이도 설정
                label.style.boxSizing = 'border-box'; // 패딩이 높이에 포함되도록
                label.innerHTML = `<i class="${prop.icon}" style="color: ${prop.color};"></i> ${prop.name}`;
                cameraLabelsContainer.appendChild(label);

                tracksContainer.appendChild(track);
                this.tracks.push(track);
            });

            if (addTrackBtn) {
                addTrackBtn.style.visibility = 'hidden';
                addTrackBtn.style.pointerEvents = 'none';
            }

            this.renderCameraKeyframes();

        } else {
            // 클립 모드: 일반 클립 기반 타임라인
            tracksContainer.innerHTML = '';
            cameraLabelsContainer.innerHTML = '';
            cameraLabelsContainer.style.display = 'none';
            cameraLabelsContainer.style.transform = '';
            this.tracks = [];

            // 기본 3개 트랙 생성
            this.isRestoringState = true;
            for (let i = 0; i < 3; i++) {
                this.addTrack();
            }
            this.isRestoringState = false;

            // 트랙 추가 버튼 표시
            if (addTrackBtn) {
                addTrackBtn.style.visibility = 'visible';
                addTrackBtn.style.pointerEvents = 'auto';
            }

            // 클립 다시 렌더링
            Object.values(this.clips).forEach(clipData => {
                if (clipData.trackIndex < this.tracks.length) {
                    const clipEl = this.createClipElement(clipData);
                    this.tracks[clipData.trackIndex].appendChild(clipEl);
                }
            });
        }

        this.updateTimeIndicator();
        this.saveState('타임라인 모드 전환');
        
        // 레이어 목록 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }

        // PreviewSystem의 선택 상태도 초기화 (카메라 모드에서 클립 모드로 전환 시 드래그 상태 초기화)
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.selectedClipIds = [];
            window.app.previewSystem.isDragging = false;
            window.app.previewSystem.dragPending = false;
            window.app.previewSystem.isResizing = false;
            window.app.previewSystem.isRotating = false;
            window.app.previewSystem.rotateState = null;
            window.app.previewSystem.initialBoundingBox = null;
            window.app.previewSystem.dragStartValues.clear();
            
            // 박스 선택 상태도 초기화
            if (window.app.previewSystem.selectionBox) {
                window.app.previewSystem.selectionBox.isSelecting = false;
                if (window.app.previewSystem.selectionBox.element) {
                    window.app.previewSystem.selectionBox.element.style.display = 'none';
                }
            }
            
            window.app.previewSystem.clearTransformHandles();
        }

        // PropertiesPanel 초기화 (카메라 키프레임 속성 패널 숨기기)
        if (window.app && window.app.propertiesPanel) {
            if (mode === 'clip') {
                // 클립 모드로 전환 시 카메라 키프레임 속성 패널 숨기기
                window.app.propertiesPanel.hideCameraKeyframeProperties();
            }
        }

        // 모드 전환 버튼 상태 명시적으로 업데이트
        const modeBtns = document.querySelectorAll('.timeline-mode-switch .mode-btn');
        modeBtns.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
                btn.disabled = false;
            } else {
                btn.classList.remove('active');
                btn.disabled = false;
            }
        });
    }

    addCameraKeyframe(easing, time = null) {
        const keyframeTime = time !== null ? time : this.currentTime;

        // 해당 시간에 이미 키프레임이 있는지 확인 (간단한 중복 방지)
        const existingKeyframe = this.cameraKeyframes.find(kf => Math.abs(kf.time - keyframeTime) < 0.01);
        if (existingKeyframe) {
            // 기존 키프레임의 이징 값만 변경
            existingKeyframe.easing = easing;
            this.saveState('카메라 키프레임 이징 변경');
            this.renderCameraKeyframes();
            
            // 레이어 목록 업데이트
            if (window.app && window.app.leftPanel) {
                window.app.leftPanel.updateLayers();
            }
            
            // PropertiesPanel 업데이트
            if (window.app && window.app.propertiesPanel) {
                window.app.propertiesPanel.updateCameraProperties(this.currentTime);
            }
            
            // 프리뷰 업데이트
            if (window.app && window.app.previewSystem) {
                window.app.previewSystem.update(this.currentTime);
            }
            
            return existingKeyframe;
        }

        const keyframe = {
            id: 'kf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            time: keyframeTime,
            easing: easing,
            values: { // x, y, 크기, 방향(rotation)
                x: 0,
                y: 0,
                scale: 100,
                rotation: 0
            }
        };

        this.cameraKeyframes.push(keyframe);
        this.cameraKeyframes.sort((a, b) => a.time - b.time); // 시간순 정렬

        this.saveState('카메라 키프레임 추가');
        this.renderCameraKeyframes();
        
        // 레이어 목록 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }
        
        // PropertiesPanel 업데이트
        if (window.app && window.app.propertiesPanel) {
            window.app.propertiesPanel.updateCameraProperties(this.currentTime);
        }
        
        // 프리뷰 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }
        
        return keyframe;
    }

    renderCameraKeyframes() {
        if (this.timelineMode !== 'camera') return;

        // 기존 마커, 그래프 곡선, 캔버스 모두 제거
        this.tracks.forEach(track => {
            track.querySelectorAll('.camera-keyframe-marker, .camera-graph-curve, .camera-graph-canvas').forEach(el => el.remove());
        });

        if (this.tracks.length < 4) return;

        const propertyNames = ['x', 'y', 'scale', 'rotation'];
        const trackHeight = 100; // 트랙 높이 (CSS와 일치)
        const padding = 10; // 상하 패딩

        // 0초에 기본 키프레임 추가 (그래프 시작점용)
        const allKeyframes = [
            {
                time: 0,
                values: { x: 0, y: 0, scale: 100, rotation: 0 },
                easing: 'linear',
                isDefault: true
            },
            ...this.cameraKeyframes.map(kf => ({ ...kf, isDefault: false }))
        ].sort((a, b) => a.time - b.time);

        // AnimationGraph와 동일한 이징 함수들
        const easingFunctions = {
            linear: t => t,
            easeIn: t => t * t,
            easeOut: t => t * (2 - t),
            easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            'ease-in': t => t * t * t,
            'ease-out': t => 1 - Math.pow(1 - t, 3),
            'ease-in-out': t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        };

        // 각 트랙별로 그래프 렌더링
        propertyNames.forEach((propName, trackIndex) => {
            const track = this.tracks[trackIndex];
            if (!track) return;

            // 해당 프로퍼티의 모든 값 수집
            const values = allKeyframes.map(kf => kf.values[propName]);

            // AnimationGraph와 동일한 동적 범위 계산
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            const range = Math.max(Math.abs(maxVal - minVal), 100);
            const calculatedMin = Math.floor(minVal - range * 0.2);
            const calculatedMax = Math.ceil(maxVal + range * 0.2);

            // scale은 0 미만 불가
            let minValue = calculatedMin;
            let maxValue = calculatedMax;
            if (propName === 'scale') {
                minValue = Math.max(0, calculatedMin);
            }

            const valueRange = maxValue - minValue;

            // 값을 Y 좌표로 변환 (값이 높을수록 위로, AnimationGraph와 동일)
            const valueToY = (value) => {
                const normalizedValue = (value - minValue) / valueRange;
                const height = trackHeight - padding * 2;
                return padding + height - normalizedValue * height;
            };

            // 캔버스 생성
            const canvas = document.createElement('canvas');
            canvas.className = 'camera-graph-canvas';
            canvas.style.position = 'absolute';
            canvas.style.left = '0px';
            canvas.style.top = '0px';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'auto';
            canvas.style.zIndex = '1';

            // 캔버스 크기 설정
            const trackWidth = track.offsetWidth || (this.totalDuration * this.pixelsPerSecond);
            canvas.width = trackWidth;
            canvas.height = trackHeight;

            const ctx = canvas.getContext('2d');

            // 배경 그리드 및 범위 레이블 (AnimationGraph 스타일)
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.fillStyle = '#555';
            ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
            ctx.textAlign = 'left';

            const graphHeight = trackHeight - padding * 2;

            // 가로선과 범위 값
            for (let i = 0; i <= 4; i++) {
                const y = padding + (graphHeight / 4) * i;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();

                // 범위 값 표시 (위에서 아래로)
                const rangeValue = Math.round(maxValue - (valueRange / 4) * i);
                ctx.fillText(rangeValue.toString(), 2, y + 3);
            }

            ctx.setLineDash([]);

            // 각 트랙별 색상
            const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffaa00'];
            const graphColor = colors[trackIndex];

            // 키프레임 간 곡선 그리기
            for (let i = 0; i < allKeyframes.length - 1; i++) {
                const kf1 = allKeyframes[i];
                const kf2 = allKeyframes[i + 1];

                const x1 = kf1.time * this.pixelsPerSecond;
                const x2 = kf2.time * this.pixelsPerSecond;
                const width = x2 - x1;

                if (width <= 0) continue;

                const value1 = kf1.values[propName];
                const value2 = kf2.values[propName];

                // 이징 함수 결정 (easeInOut이 기본값)
                let easingKey = kf2.easing || 'easeInOut';
                if (easingKey === 'easeIn') easingKey = 'easeIn';
                else if (easingKey === 'easeOut') easingKey = 'easeOut';
                else if (easingKey === 'easeInOut') easingKey = 'easeInOut';
                else if (easingKey === 'ease-in') easingKey = 'ease-in';
                else if (easingKey === 'ease-out') easingKey = 'ease-out';
                else if (easingKey === 'ease-in-out') easingKey = 'ease-in-out';

                const easingFunc = easingFunctions[easingKey] || easingFunctions.easeInOut;

                // 곡선 그리기 (AnimationGraph 스타일)
                ctx.strokeStyle = graphColor;
                ctx.lineWidth = 2;
                ctx.beginPath();

                for (let j = 0; j <= 50; j++) {
                    const t = j / 50;
                    const easedT = easingFunc(t);
                    const interpolatedValue = value1 + (value2 - value1) * easedT;
                    const y = valueToY(interpolatedValue);
                    const x = x1 + t * width;

                    if (j === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                ctx.stroke();

                // 시작점과 끝점 표시 (AnimationGraph 스타일)
                const startY = valueToY(value1);
                const endY = valueToY(value2);

                // 시작점 (첫 키프레임만)
                if (i === 0) {
                    ctx.fillStyle = graphColor;
                    ctx.beginPath();
                    ctx.arc(x1, startY, 5, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 끝점
                ctx.beginPath();
                ctx.arc(x2, endY, 5, 0, Math.PI * 2);
                ctx.fill();

                // 값 표시
                ctx.fillStyle = '#888';
                ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
                if (i === 0) {
                    ctx.textAlign = 'left';
                    ctx.fillText(value1.toString(), x1 + 8, startY - 8);
                }
                ctx.textAlign = 'right';
                ctx.fillText(value2.toString(), x2 - 8, endY - 8);
            }

            track.appendChild(canvas);

            // 캔버스 우클릭 이벤트 (빈 곳 클릭 시 키프레임 추가 메뉴)
            canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 클릭 위치에서 시간 계산
                const rect = track.getBoundingClientRect();
                const scrollLeft = this.timelineScrollContainer ? this.timelineScrollContainer.scrollLeft : (this.timelineBody ? this.timelineBody.scrollLeft : 0);
                const clickX = e.clientX - rect.left + scrollLeft;
                const clickTime = clickX / this.pixelsPerSecond;
                
                // 클릭한 위치에서 가장 가까운 키프레임 찾기
                let nearestKeyframe = null;
                let minDistance = Infinity;
                
                allKeyframes.forEach(kf => {
                    if (kf.isDefault) return;
                    const distance = Math.abs(kf.time - clickTime);
                    if (distance < minDistance && distance < 0.1) { // 0.1초 이내 (마커 근처)
                        minDistance = distance;
                        nearestKeyframe = kf;
                    }
                });
                
                // 키프레임 마커 근처가 아니면 메뉴 표시
                if (!nearestKeyframe) {
                    this.showCameraTrackContextMenu(e, track);
                }
            });

            // 트랙 클릭 이벤트 추가 (그래프 클릭으로 값 설정)
            const handleTrackClick = (e) => {
                if (this.dragState.keyframeId || this.dragState.isDraggingKeyframe) return;

                const rect = track.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const clickTime = clickX / this.pixelsPerSecond;

                // 클릭한 위치에서 가장 가까운 키프레임 찾기
                let nearestKeyframe = null;
                let minDistance = Infinity;

                allKeyframes.forEach(kf => {
                    const distance = Math.abs(kf.time - clickTime);
                    if (distance < minDistance && distance < 0.5) { // 0.5초 이내
                        minDistance = distance;
                        nearestKeyframe = kf;
                    }
                });

                if (nearestKeyframe && !nearestKeyframe.isDefault) {
                    // 클릭한 Y 위치에서 값 계산
                    const normalizedY = (graphHeight - (clickY - padding)) / graphHeight;
                    let clickValue = minValue + normalizedY * valueRange;
                    let roundedValue = Math.round(clickValue);

                    if (propName === 'scale') {
                        roundedValue = Math.max(0, roundedValue);
                    }

                    // 키프레임 값 업데이트
                    this.updateCameraKeyframe(nearestKeyframe.id, {
                        values: { ...nearestKeyframe.values, [propName]: roundedValue }
                    }, true);
                }
            };

            // 기존 클릭 이벤트 제거 후 재추가
            canvas.removeEventListener('click', handleTrackClick);
            canvas.addEventListener('click', handleTrackClick);

            // 실제 키프레임 마커 렌더링 (기본 키프레임 제외)
            allKeyframes.forEach(keyframe => {
                if (keyframe.isDefault) return;

                const marker = document.createElement('div');
                marker.className = 'camera-keyframe-marker';
                marker.dataset.keyframeId = keyframe.id;
                marker.dataset.property = propName;
                marker.dataset.easing = keyframe.easing;

                const xPos = keyframe.time * this.pixelsPerSecond;
                const yPos = valueToY(keyframe.values[propName]);

                marker.style.left = xPos + 'px';
                marker.style.top = yPos + 'px';
                marker.style.zIndex = '2';
                marker.style.backgroundColor = graphColor;

                // 선택 상태 복원
                if (keyframe.id === this.selectedKeyframeId) {
                    marker.classList.add('selected');
                }

                // 드래그 & 클릭을 위한 마우스다운 설정
                marker.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.handleKeyframeMouseDown(e, keyframe, propName, minValue, maxValue);
                });

                // 우클릭 컨텍스트 메뉴
                marker.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showCameraKeyframeContextMenu(e, keyframe);
                });

                // 같은 키프레임 세트 전체 호버 동기화
                marker.addEventListener('mouseenter', () => {
                    this.setKeyframeHover(keyframe.id, true);
                });
                marker.addEventListener('mouseleave', () => {
                    this.setKeyframeHover(keyframe.id, false);
                });

                track.appendChild(marker);
            });
        });
    }

    setKeyframeHover(keyframeId, isHover) {
        document.querySelectorAll(`[data-keyframe-id="${keyframeId}"]`).forEach(m => {
            if (isHover) m.classList.add('hover');
            else m.classList.remove('hover');
        });
    }

    handleKeyframeMouseDown(e, keyframe, propName, minValue, maxValue) {
        if (e.button !== 0) return; // 좌클릭만
        this.dragState.keyframeId = keyframe.id;
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;
        this.dragState.keyframeStartTime = keyframe.time;
        this.dragState.keyframeProperty = propName;
        this.dragState.keyframeMinValue = minValue;
        this.dragState.keyframeMaxValue = maxValue;
        this.dragState.keyframeStartValue = keyframe.values[propName];
        this.dragState.keyframeHasMoved = false;
        this.dragState.isDraggingKeyframe = false;
        this.dragState.isDraggingValue = false; // 값 드래그 여부
        this.dragState.keyframeInitialValue = keyframe.values[propName]; // 초기값 저장
        e.preventDefault();
    }

    handleKeyframeDrag(e) {
        if (!this.dragState.keyframeId) return;

        const deltaX = e.clientX - this.dragState.startX;
        const deltaY = e.clientY - this.dragState.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // 5px 이상 이동했을 때만 드래그로 간주
        if (!this.dragState.isDraggingKeyframe && distance > 5) {
            this.dragState.isDraggingKeyframe = true;
            this.dragState.keyframeHasMoved = true;

            // 드래그가 시작되면 해당 키프레임을 선택하여 속성 패널에 표시
            const keyframe = this.cameraKeyframes.find(kf => kf.id === this.dragState.keyframeId);

            this.selectKeyframe(keyframe);

            // X와 Y 중 더 큰 변화 방향으로 결정
            if (Math.abs(deltaY) > Math.abs(deltaX)) {
                this.dragState.isDraggingValue = true; // Y 값 드래그
            } else {
                this.dragState.isDraggingValue = false; // X 위치(시간) 드래그
            }
        }

        if (this.dragState.isDraggingKeyframe) {
            const keyframe = this.cameraKeyframes.find(kf => kf.id === this.dragState.keyframeId);
            if (!keyframe) return;

            if (this.dragState.isDraggingValue && this.dragState.keyframeProperty) {
                // Y 값 드래그 (AnimationGraph와 동일한 방식)
                // 마커를 통해 트랙 찾기
                const marker = document.querySelector(`[data-keyframe-id="${this.dragState.keyframeId}"][data-property="${this.dragState.keyframeProperty}"]`);
                const track = marker?.closest('.track');

                if (track) {
                    const trackHeight = 100;
                    const padding = 10;
                    const graphHeight = trackHeight - padding * 2;
                    const rect = track.getBoundingClientRect();
                    const currentY = e.clientY - rect.top;

                    // Y 좌표를 값으로 변환
                    const normalizedY = (graphHeight - (currentY - padding)) / graphHeight;
                    const valueRange = this.dragState.keyframeMaxValue - this.dragState.keyframeMinValue;
                    let newValue = this.dragState.keyframeMinValue + normalizedY * valueRange;
                    let roundedValue = Math.round(newValue);

                    // scale은 0 미만 불가
                    if (this.dragState.keyframeProperty === 'scale') {
                        roundedValue = Math.max(0, roundedValue);
                    }

                    // 키프레임 값 업데이트
                    keyframe.values[this.dragState.keyframeProperty] = roundedValue;

                    // 속성 패널 업데이트
                    if (window.app && window.app.propertiesPanel && this.selectedKeyframeId === keyframe.id) {
                        const propValue = roundedValue;
                        const propNameCap = this.dragState.keyframeProperty.charAt(0).toUpperCase() + this.dragState.keyframeProperty.slice(1);
                        const inputId = propNameCap === 'Scale' ? 'camKfScale' :
                            propNameCap === 'Rotation' ? 'camKfRotation' :
                                `camKf${propNameCap}`;
                        const input = document.getElementById(inputId);
                        if (input && parseFloat(input.value) !== propValue) {
                            input.value = propValue;
                        }
                    }

                    this.renderCameraKeyframes(); // 실시간 위치 갱신
                }
            } else {
                // X 위치(시간) 드래그
                const deltaTime = deltaX / this.pixelsPerSecond;
                const newTime = Math.max(0, Math.min(this.totalDuration, this.dragState.keyframeStartTime + deltaTime));
                keyframe.time = newTime;

                // 속성 패널 업데이트
                if (window.app && window.app.propertiesPanel && this.selectedKeyframeId === keyframe.id) {
                    const timeInput = document.getElementById('camKfTime');
                    if (timeInput && parseFloat(timeInput.value) !== newTime) {
                        timeInput.value = newTime.toFixed(2);
                    }
                }

                this.renderCameraKeyframes(); // 실시간 위치 갱신
            }
        }
    }

    selectKeyframe(keyframe) {
        // 선택된 키프레임 ID 저장
        this.selectedKeyframeId = keyframe ? keyframe.id : null;

        // 모든 키프레임 선택 해제
        document.querySelectorAll('.camera-keyframe-marker').forEach(m => m.classList.remove('selected'));
        // 선택된 키프레임 표시
        if (keyframe) {
            document.querySelectorAll(`[data-keyframe-id="${keyframe.id}"]`).forEach(m => m.classList.add('selected'));
        }

        // 속성 패널 표시
        if (window.app && window.app.propertiesPanel && this.timelineMode === 'camera') {
            if (keyframe) {
                window.app.propertiesPanel.showCameraKeyframeProperties(keyframe);
            } else {
                window.app.propertiesPanel.hideCameraKeyframeProperties();
            }
        }
    }

    updateCameraKeyframe(keyframeId, updates, save = true) {
        const kf = this.cameraKeyframes.find(k => k.id === keyframeId);
        if (!kf) return false;
        // time 경계 처리
        if (updates.time !== undefined) {
            updates.time = Math.max(0, Math.min(this.totalDuration, parseFloat(updates.time)));
        }
        Object.assign(kf, updates);
        // 시간 변경 시 정렬
        if (updates.time !== undefined) {
            this.cameraKeyframes.sort((a, b) => a.time - b.time);
        }
        this.renderCameraKeyframes();
        if (save) this.saveState('카메라 키프레임 수정');
        
        // 레이어 목록 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }
        
        // 프리뷰 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }
        
        return true;
    }

    setupEventListeners() {
        // Ctrl + 휠로 타임라인 확대/축소
        this.timelineBody.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 1.1 : 0.9;
                this.zoom(delta);
            }
        }, { passive: false });

        // 타임라인 클릭 (드래그 박스 선택과 충돌 방지를 위해 mousedown에서 처리)
        this.timelineBody.addEventListener('mousedown', (e) => {
            // 좌클릭에서만 박스 선택 시작
            if (e.button !== 0) return;
            if (e.target === this.timelineBody || e.target === this.tracksContainer || e.target.classList.contains('track')) {
                // Ctrl 키 없으면 선택 해제
                if (!e.ctrlKey && !e.metaKey) {
                    this.deselectAllClips();
                }

                // 드래그 박스 선택 시작
                const rect = this.timelineBody.getBoundingClientRect();
                this.selectionBox.isSelecting = true;
                this.selectionBox.startX = e.clientX - rect.left + this.timelineBody.scrollLeft;
                this.selectionBox.startY = e.clientY - rect.top + this.timelineBody.scrollTop;
                this.selectionBox.ctrlKey = e.ctrlKey || e.metaKey; // Ctrl 키 상태 저장
                this.selectionBox.hasMoved = false;

                e.preventDefault();
            }
        });

        // 타임라인 룰러 클릭으로 시간 이동
        this.timelineRuler.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            this.timeIndicatorDrag.isDragging = true;
            document.body.style.cursor = 'ew-resize';
        });

        // 스크롤 동기화
        this.timelineBody.addEventListener('scroll', () => {
            this.updateTimeIndicator();
            this.syncRulerScroll();
        });

        // 타임 인디케이터 드래그
        this.timeIndicator.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // 좌클릭에서만 드래그 시작
            e.preventDefault();
            e.stopPropagation();
            this.timeIndicatorDrag.isDragging = true;
            document.body.style.cursor = 'ew-resize';
        });

        // 전역 마우스 이벤트
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // 전역 클릭으로 컨텍스트 메뉴 닫기
        document.addEventListener('click', (e) => {
            // 메뉴 항목을 클릭한 경우는 제외
            if (!e.target.closest('.context-menu-item')) {
                this.hideAllContextMenus();
            }
        });

        // 브라우저 창을 벗어나는 경우 등 비정상적인 드래그 종료 처리
        const endDrag = (e) => {
            // 드래그 상태일 때만 mouseup 핸들러 호출
            if (this.dragState.isDragging || this.dragState.isResizing || this.timeIndicatorDrag.isDragging || this.selectionBox.isSelecting) {
                this.handleMouseUp(e);
            }
        };

        document.addEventListener('mouseleave', endDrag);
        window.addEventListener('blur', endDrag);

        // 클립 컨텍스트 메뉴 설정
        this.setupClipContextMenu();
        
        // 카메라 키프레임 컨텍스트 메뉴 설정
        this.setupCameraKeyframeContextMenu();
        
        // 키보드 이벤트 (Delete 키 등)
        this.setupKeyboardEvents();

        // 카메라 라벨 스크롤 동기화
        if (this.timelineScrollContainer && this.cameraLabelsContainer) {
            this.timelineScrollContainer.addEventListener('scroll', () => {
                if (this.timelineMode === 'camera') {
                    this.cameraLabelsContainer.style.transform = `translateY(-${this.timelineScrollContainer.scrollTop}px)`;
                }
            });
        }
    }

    /**
     * 타임라인 확대/축소
     */
    zoom(factor) {
        const oldPPS = this.pixelsPerSecond;
        const newPPS = Math.max(this.minZoom, Math.min(this.maxZoom, oldPPS * factor));

        if (newPPS !== oldPPS) {
            // 현재 스크롤 위치 기준으로 확대/축소
            const scrollRatio = (this.timelineBody.scrollLeft + this.timelineBody.clientWidth / 2) /
                (this.totalDuration * oldPPS);

            this.pixelsPerSecond = newPPS;
            this.updateAllClipsPosition();
            this.updateRuler();
            this.updateTracksWidth();

            // 카메라 모드일 때 키프레임도 다시 렌더링
            if (this.timelineMode === 'camera') {
                this.renderCameraKeyframes();
            }

            // 스크롤 위치 조정
            const newScrollLeft = scrollRatio * (this.totalDuration * newPPS) - this.timelineBody.clientWidth / 2;
            this.timelineBody.scrollLeft = Math.max(0, newScrollLeft);

            this.updateTimeIndicator();
        }
    }

    /**
     * 룰러 업데이트
     */
    updateRuler() {
        this.timelineRuler.innerHTML = '';
        const totalWidth = this.totalDuration * this.pixelsPerSecond;
        this.timelineRuler.style.width = totalWidth + 'px';

        // 시간 마커 간격 결정 (픽셀당 초에 따라)
        let interval = 1; // 기본 1초 간격
        if (this.pixelsPerSecond < 30) {
            interval = 5;
        } else if (this.pixelsPerSecond < 50) {
            interval = 2;
        } else if (this.pixelsPerSecond > 100) {
            interval = 0.5;
        }

        for (let t = 0; t <= this.totalDuration; t += interval) {
            const marker = document.createElement('div');
            marker.className = 'time-marker';
            marker.style.left = (t * this.pixelsPerSecond) + 'px';
            marker.textContent = t.toFixed(1) + 's';
            this.timelineRuler.appendChild(marker);
        }
    }

    /**
     * 룰러 스크롤 동기화
     */
    syncRulerScroll() {
        this.timelineRuler.scrollLeft = this.timelineBody.scrollLeft;
    }

    /**
     * 트랙 너비 업데이트
     */
    updateTracksWidth() {
        const totalWidth = this.totalDuration * this.pixelsPerSecond;
        this.tracks.forEach(track => {
            track.style.width = totalWidth + 'px';
        });
        this.tracksContainer.style.width = totalWidth + 'px';
    }

    /**
     * 모든 클립 위치 업데이트
     */
    updateAllClipsPosition() {
        Object.values(this.clips).forEach(clipData => {
            const clipEl = document.getElementById(clipData.id);
            if (clipEl) {
                clipEl.style.left = (clipData.startTime * this.pixelsPerSecond) + 'px';
                clipEl.style.width = (clipData.duration * this.pixelsPerSecond) + 'px';
            }
        });
    }

    /**
     * 시간 인디케이터 업데이트
     */
    updateTimeIndicator() {
        if (this.timeIndicator) {
            const xPos = this.currentTime * this.pixelsPerSecond - this.timelineBody.scrollLeft;
            this.timeIndicator.style.left = (this.currentTime * this.pixelsPerSecond) + 'px';

            // 트랙 높이에 맞춰 인디케이터 높이 조정
            const totalHeight = this.tracksContainer.offsetHeight;
            this.timeIndicator.style.height = Math.max(totalHeight, this.timelineBody.clientHeight) + 'px';
        }
    }

    /**
     * 현재 시간 설정
     */
    setCurrentTime(time) {
        this.currentTime = Math.max(0, Math.min(time, this.totalDuration));
        this.updateTimeIndicator();

        // 메인 앱에 알림
        if (window.app && window.app.onTimeChange) {
            window.app.onTimeChange(this.currentTime);
        }
    }

    /**
     * 지정된 인덱스에 새 트랙 삽입 (상태 저장 없음)
     */
    insertTrackAt(index) {
        const track = document.createElement('div');
        track.className = 'track';
        track.style.width = (this.totalDuration * this.pixelsPerSecond) + 'px';

        track.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showTrackContextMenu(e, track);
        });

        const referenceNode = this.tracks[index] || null;
        this.tracksContainer.insertBefore(track, referenceNode);

        this.tracks.splice(index, 0, track);

        // 삽입된 트랙보다 뒤에 있는 클립들의 trackIndex 업데이트
        Object.values(this.clips).forEach(clip => {
            if (clip.trackIndex >= index) {
                clip.trackIndex++;
            }
        });

        // 모든 트랙의 인덱스 dataset 업데이트
        this.tracks.forEach((trk, idx) => {
            trk.dataset.trackIndex = idx;
        });

        this.updateTimeIndicator();
        return track;
    }

    /**
     * 새 트랙 추가
     */
    addTrack() {
        // 카메라 모드에서는 트랙 추가 불가
        if (this.timelineMode === 'camera' && this.tracks.length >= 1) {
            return null;
        }

        const track = document.createElement('div');
        track.className = 'track';
        track.dataset.trackIndex = this.tracks.length;
        track.style.width = (this.totalDuration * this.pixelsPerSecond) + 'px';

        // 트랙 우클릭 메뉴
        track.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showTrackContextMenu(e, track);
        });

        this.tracksContainer.appendChild(track);
        this.tracks.push(track);
        this.updateTimeIndicator();

        this.saveState('트랙 추가');

        return track;
    }

    /**
     * 클립 데이터 기반으로 필요한 트랙 수 계산
     */
    calculateRequiredTrackCount(clipsData = {}) {
        const clips = Object.values(clipsData);
        if (clips.length === 0) {
            return 1;
        }

        const maxIndex = clips.reduce((max, clip) => {
            const idx = Number.isFinite(clip.trackIndex) && clip.trackIndex >= 0
                ? Math.floor(clip.trackIndex)
                : 0;
            return Math.max(max, idx);
        }, 0);

        return Math.max(1, maxIndex + 1);
    }

    /**
     * 클립 모드 트랙을 지정된 개수로 재구성
     */
    rebuildClipTracks(targetCount = 1) {
        if (!this.tracksContainer) return;
        if (this.timelineMode === 'camera') return;

        const sanitizedCount = Math.max(1, Math.floor(targetCount));
        const addTrackBtn = document.getElementById('addTrackBtn');
        const previousRestoringState = this.isRestoringState;

        this.isRestoringState = true;
        this.tracksContainer.innerHTML = '';
        this.tracks = [];

        for (let i = 0; i < sanitizedCount; i++) {
            this.addTrack();
        }

        this.isRestoringState = previousRestoringState;

        if (addTrackBtn) {
            addTrackBtn.style.visibility = 'visible';
            addTrackBtn.style.pointerEvents = 'auto';
        }
    }

    /**
     * 지정된 인덱스 위에 새 트랙 추가
     */
    addTrackAbove(trackElement) {
        const trackIndex = parseInt(trackElement.dataset.trackIndex, 10);
        if (!isNaN(trackIndex)) {
            this.insertTrackAt(trackIndex);
            this.saveState('위에 트랙 추가');
        }
    }

    /**
     * 지정된 인덱스 아래에 새 트랙 추가
     */
    addTrackBelow(trackElement) {
        const trackIndex = parseInt(trackElement.dataset.trackIndex, 10);
        if (!isNaN(trackIndex)) {
            this.insertTrackAt(trackIndex + 1);
            this.saveState('아래에 트랙 추가');
        }
    }

    /**
     * 트랙 삭제
     */
    deleteTrack(trackElement) {
        const trackIndex = parseInt(trackElement.dataset.trackIndex, 10);
        if (isNaN(trackIndex)) return;

        // 트랙에 속한 클립들 삭제 (상태 저장 없이)
        const clipsOnTrack = Object.values(this.clips).filter(c => c.trackIndex === trackIndex);
        clipsOnTrack.forEach(c => this._removeClipById(c.id));

        // 트랙 DOM 요소 및 데이터 제거
        trackElement.remove();
        this.tracks.splice(trackIndex, 1);

        // 후속 트랙들의 인덱스 업데이트
        this.tracks.forEach((track, idx) => {
            track.dataset.trackIndex = idx;
        });

        // 후속 트랙의 클립들의 trackIndex 업데이트
        Object.values(this.clips).forEach(clip => {
            if (clip.trackIndex > trackIndex) {
                clip.trackIndex--;
            }
        });

        this.updateTimeIndicator();
        this.saveState('트랙 삭제');
    }

    /**
     * 내부용: 클립 ID로 클립 데이터 및 DOM 제거 (상태 저장 없음)
     */
    _removeClipById(clipId) {
        const clipEl = document.getElementById(clipId);
        if (clipEl) {
            clipEl.remove();
        }
        delete this.clips[clipId];
        this.hiddenClips.delete(clipId);
    }

    /**
     * 클립 추가
     */
    addClip(type, options = {}) {
        const clipId = options.id || ('clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));

        const startTime = options.startTime !== undefined ? options.startTime : this.currentTime;
        const duration = options.duration || 3;

        // 적절한 트랙 찾기 또는 생성
        let trackIndex;
        if (options.trackIndex !== undefined) {
            trackIndex = options.trackIndex;
            // 트랙이 없으면 생성 (프로젝트 불러오기 시)
            while (this.tracks.length <= trackIndex) {
                this.addTrack();
            }
        } else {
            trackIndex = this.findAvailableTrack(startTime, duration);
            // 사용 가능한 트랙이 없으면 새로 생성
            if (trackIndex === -1) {
                this.addTrack();
                trackIndex = this.tracks.length - 1;
            }
        }

        // 타임라인 자동 확장
        const maxEndTime = startTime + duration;
        if (maxEndTime > this.totalDuration) {
            this.totalDuration = Math.ceil(maxEndTime / 10) * 10 + 10;
            this.updateRuler();
            this.updateTracksWidth();
            // 타임라인 확장은 자동 저장하지 않음
        }

        // 클립 데이터 생성
        const clipData = {
            id: clipId,
            type: type,
            trackIndex: trackIndex,
            startTime: startTime,
            duration: duration,
            ...this.getDefaultPropertiesForType(type),
            ...options
        };
        clipData.id = clipId; // 외부 데이터에 id가 있어도 일관성 유지

        if (clipData.type === 'image') {
            if (clipData.imageFile && clipData.imageFile.name) {
                clipData.imageFileName = clipData.imageFile.name;
            } else if (options.imageFileName) {
                clipData.imageFileName = options.imageFileName;
            } else if (!clipData.imageFileName) {
                clipData.imageFileName = '';
            }
        }

        this.clips[clipId] = clipData;

        // 클립 DOM 요소 생성 (카메라 모드에서는 타임라인에 표시하지 않음)
        if (this.timelineMode !== 'camera') {
            const clipEl = this.createClipElement(clipData);
            this.tracks[trackIndex].appendChild(clipEl);
        }

        // 자동 선택
        this.selectClip(clipId);

        // 레이어 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }

        // 미리보기 즉시 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }

        // 상태 저장 (클립 추가)
        this.saveState(`클립 추가: ${type}`);

        return clipId;
    }

    /**
     * 타입별 기본 속성
     */
    getDefaultPropertiesForType(type) {
        // 애니메이션 기본 구조
        const defaultAnimation = {
            posX: { start: 0, end: 0, easing: 'easeInOut' },
            posY: { start: 0, end: 0, easing: 'easeInOut' },
            scale: { start: 100, end: 100, easing: 'easeInOut' },
            rotation: { start: 0, end: 0, easing: 'easeInOut' },
            opacity: { start: 0, end: 0, easing: 'easeInOut' }
        };

        const defaults = {
            text: {
                content: '새 텍스트',
                fontFamily: 'Pretendard-Regular',
                fontSize: 32,
                textColor: '#ffffff',
                bgColor: '#000000',
                bgTransparent: true,
                bold: false,
                italic: false,
                underline: false,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            rectangle: {
                shapeColor: '#FF0000',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            circle: {
                shapeColor: '#00FF00',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            triangle: {
                shapeColor: '#FFFF00',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            star: {
                shapeColor: '#FFD700',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            heart: {
                shapeColor: '#FF1493',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            hexagon: {
                shapeColor: '#00CED1',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            diamond: {
                shapeColor: '#FF69B4',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            pentagon: {
                shapeColor: '#9370DB',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            arrow: {
                shapeColor: '#4682B4',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            speechBubble: {
                shapeColor: '#3CB371',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            cross: {
                shapeColor: '#6A5ACD',
                shapeSize: 100,
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            image: {
                imageFile: null,
                imageURL: null,
                imageFileName: '',
                animation: JSON.parse(JSON.stringify(defaultAnimation))
            },
            fill: {
                fillColor: '#0000FF',
                animation: { opacity: { start: 0, end: 0, easing: 'easeInOut' } }
            }
        };

        return defaults[type] || {};
    }

    /**
     * 사용 가능한 트랙 찾기
     */
    findAvailableTrack(startTime, duration) {
        const endTime = startTime + duration;

        for (let i = 0; i < this.tracks.length; i++) {
            if (this.isTrackAvailable(i, startTime, endTime)) {
                return i;
            }
        }

        return -1; // 사용 가능한 트랙 없음
    }

    /**
     * 트랙이 해당 시간에 사용 가능한지 확인
     */
    isTrackAvailable(trackIndex, startTime, endTime, excludeClipId = null) {
        return !Object.values(this.clips).some(clip => {
            if (clip.id === excludeClipId) return false;
            if (clip.trackIndex !== trackIndex) return false;

            const clipEndTime = clip.startTime + clip.duration;
            return !(endTime <= clip.startTime || startTime >= clipEndTime);
        });
    }

    /**
     * 클립 DOM 요소 생성
     */
    createClipElement(clipData) {
        const clipEl = document.createElement('div');
        clipEl.className = 'clip';
        clipEl.id = clipData.id;
        clipEl.style.left = (clipData.startTime * this.pixelsPerSecond) + 'px';
        clipEl.style.width = (clipData.duration * this.pixelsPerSecond) + 'px';

        // 클립 타입에 따른 레이블
        const labels = {
            text: '텍스트',
            rectangle: '사각형',
            circle: '원',
            triangle: '삼각형',
            star: '별',
            heart: '하트',
            hexagon: '육각형',
            diamond: '다이아',
            pentagon: '오각형',
            arrow: '화살표',
            speechBubble: '말풍선',
            cross: '십자',
            image: '이미지',
            fill: '채우기'
        };

        // 텍스트 클립인 경우 폰트명 추가
        let labelText = labels[clipData.type] || clipData.type;
        let fontStyle = '';
        if (clipData.type === 'text' && clipData.fontFamily) {
            const fontNameMap = {
                'Pretendard-Regular': '프리텐다드',
                'Paperlogy-8ExtraBold': '페이퍼로지',
                'GmarketSansMedium': 'G마켓 산스',
                'memomentKkukKkuk': '메모먼트 꾹꾹체',
                'NEXON Lv1 Gothic OTF': '넥슨 Lv.1 고딕',
                'KoPubDotumMedium': 'KoPub돋움',
                'yg-jalnan': '여기어때 잘난체',
                'SBAggroB': '어그로체',
                'S-CoreDream-3Light': '에스코어드림',
                'NanumSquare': '나눔스퀘어',
                'ZEN-SERIF-TTF-Regular': 'ZEN SERIF',
                'Noto Sans KR': '본고딕 (Noto Sans)',
                'PartialSansKR-Regular': '파셜산스',
                'Ownglyph_ParkDaHyun': '온글잎 박다현체',
                'Freesentation-9Black': '프리젠테이션',
                'SUIT-Regular': '수트',
                'Cafe24Ssurround': '카페24 써라운드',
                '양진체': '양진체',
                'ChosunGs': '조선궁서체',
                'GowunDodum-Regular': '고운돋움',
                'Nanum Gothic': '나눔고딕',
                'HakgyoansimDunggeunmisoTTF-B': '학교안심 둥근미소',
                'LeeSeoyun': '이서윤체',
                'GongGothicMedium': '공고딕',
                'Godo': '고도체',
                'GodoMaum': '고도마음체',
                'SDKukdetopokki': '산돌국대떡볶이',
                'SDKukdetopokki-Lt': '산돌국대떡볶이 Light',
                'Iropke Batang': '이롭게 바탕',
                'Binggrae': '빙그레체',
                'Binggrae-Bold': '빙그레체 Bold',
                'SejongJaeumiMoeumi-Bold': '세종재우미모음체',
                'NYJGothicEB': '남양주고딕 EB',
                'KJD2Beol': '강진달 2벌식',
                'HSJandari': '한성잔다리',
                'KNPSOdaesan-Regular': '경북산오대산체',
                'NYJDasanB': '남양주다산체 Bold',
                'NYJUnheo': '남양주운허체',
                'ClipartkoreaTTF-Bold': '클립아트코리아 Bold',
                'YeolrinMyeongjo-Medium': '열린명조',
                'KimjungchulMyungjo-Bold': '김중철명조 Bold',
                'BookkMyungjo-Bd': '북크명조 Bold',
                'Eulyoo1945-Regular': '을유1945',
                'MaruBuri': '마루 부리',
                'YESMyoungjo-Regular': '예스명조',
                'GowunBatang-Regular': '고운바탕',
                'SunBatang-Light': '선바탕 Light',
                'NoonnuBasicGothicRegular': '눈누기본고딕',
                'PyeojinGothic-Bold': '편진고딕 Bold',
                'Wanted Sans': '원티드산스',
                'TheJamsil5Bold': '더잠실체 Bold',
                'SeoulAlrimTTF-Heavy': '서울알림체',
                'TillVictoryComes': '승리체',
                'KHNPHD': '한수원 한돋움체',
                'KHNPHU': '한수원 한울림체',
                '둥근모꼴체': '둥근모꼴체'
            };
            const fontDisplayName = fontNameMap[clipData.fontFamily] || clipData.fontFamily;
            labelText = `텍스트 · ${fontDisplayName}`;
            fontStyle = `font-family: '${clipData.fontFamily}';`;
        }

        clipEl.innerHTML = `
            <div class="clip-handle-left"></div>
            <div class="clip-label" style="${fontStyle}">${labelText}</div>
            <div class="clip-handle-right"></div>
        `;

        // 초기 배경색 및 글자색 설정
        this.updateClipAppearance(clipEl, clipData);

        // 이벤트 리스너
        clipEl.addEventListener('mousedown', (e) => this.handleClipMouseDown(e, clipData.id));
        clipEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation(); // 이벤트 버블링 중단
            this.showClipContextMenu(e, clipData.id);
        });

        const leftHandle = clipEl.querySelector('.clip-handle-left');
        const rightHandle = clipEl.querySelector('.clip-handle-right');

        leftHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.startResize(e, clipData.id, 'left');
        });

        rightHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.startResize(e, clipData.id, 'right');
        });

        return clipEl;
    }

    /**
     * 클립의 배경색과 글자색을 업데이트
     */
    updateClipAppearance(clipEl, clipData) {
        let bgColor = null;

        // 도형/텍스트/채우기 타입에 따라 배경색 결정
        const shapeTypes = ['rectangle', 'circle', 'triangle', 'star', 'heart', 'hexagon', 'diamond', 'pentagon', 'arrow', 'speechBubble', 'cross'];
        if (shapeTypes.includes(clipData.type)) {
            bgColor = clipData.shapeColor;
        } else if (clipData.type === 'text') {
            bgColor = clipData.textColor;
        } else if (clipData.type === 'fill') {
            bgColor = clipData.fillColor;
        }

        if (bgColor) {
            clipEl.style.backgroundColor = bgColor;
            const label = clipEl.querySelector('.clip-label');
            if (label) {
                label.style.color = this.getContrastingTextColor(bgColor);
            }
        }
    }

    /**
     * 배경색에 대비되는 텍스트 색상(검정/흰색) 반환
     */
    getContrastingTextColor(hexColor) {
        if (!hexColor) return '#ffffff';

        // Hex to RGB
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // 밝기 계산 (Luminance)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    /**
     * 클립 선택 (다중 선택 로직으로 통합)
     */
    selectClip(clipId, multiSelect = false, rangeSelect = false) {
        if (!this.clips[clipId]) return;

        if (rangeSelect && this.selectedClipId) {
            // Shift+클릭: 범위 선택
            this.selectClipRange(this.selectedClipId, clipId);
        } else if (multiSelect) {
            // Ctrl+클릭: 다중 선택 토글
            const index = this.selectedClipIds.indexOf(clipId);
            if (index > -1) {
                // 이미 선택되어 있으면 해제
                this.selectedClipIds.splice(index, 1);
            } else {
                // 선택 추가
                this.selectedClipIds.push(clipId);
            }
        } else {
            // 일반 클릭: 단일 선택 (다중 선택 배열 사용)
            this.selectedClipIds = [clipId];
        }

        // 마지막으로 선택한 클립을 selectedClipId로 설정
        this.selectedClipId = this.selectedClipIds.length > 0
            ? this.selectedClipIds[this.selectedClipIds.length - 1]
            : null;

        // 시각적 업데이트
        this.updateClipSelection();

        // 클립 선택은 자동 저장하지 않음
    }

    /**
     * 범위 선택
     */
    selectClipRange(startClipId, endClipId) {
        const startClip = this.clips[startClipId];
        const endClip = this.clips[endClipId];
        if (!startClip || !endClip) return;

        // 같은 트랙의 클립들만 선택
        const trackClips = Object.values(this.clips)
            .filter(clip => clip.trackIndex === startClip.trackIndex)
            .sort((a, b) => a.startTime - b.startTime);

        const startIndex = trackClips.findIndex(c => c.id === startClipId);
        const endIndex = trackClips.findIndex(c => c.id === endClipId);

        if (startIndex === -1 || endIndex === -1) return;

        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        this.deselectAllClips();
        this.selectedClipIds = [];

        for (let i = minIndex; i <= maxIndex; i++) {
            const clip = trackClips[i];
            this.selectedClipIds.push(clip.id);
            const clipEl = document.getElementById(clip.id);
            if (clipEl) clipEl.classList.add('selected');
        }

        this.selectedClipId = endClipId;

        // 선택 상태 UI 및 프리뷰 동기화
        this.updateClipSelection();
    }

    /**
     * 모든 클립 선택 해제
     */
    deselectAllClips() {
        this.selectedClipId = null;
        this.selectedClipIds = [];

        // 시각적 업데이트
        this.updateClipSelection();

        // 클립 선택 해제는 자동 저장하지 않음
    }

    /**
     * 클립 삭제 (단일 또는 다중)
     */
    deleteClip(clipId) {
        // 다중 선택에 포함된 클립을 삭제하는 경우, 선택된 모든 클립을 삭제
        const clipsToDelete = (this.selectedClipIds.length > 1 && this.selectedClipIds.includes(clipId))
            ? [...this.selectedClipIds]
            : [clipId];

        clipsToDelete.forEach(id => this._removeClipById(id));

        // 선택 상태 초기화
        this.deselectAllClips();

        // 레이어 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }

        // 미리보기 즉시 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }

        // 상태 저장 (클립 삭제)
        this.saveState('클립 삭제');
    }

    /**
     * 클립 복제
     */
    duplicateClip(clipId) {
        const original = this.clips[clipId];
        if (!original) return;

        const newClipData = JSON.parse(JSON.stringify(original));
        delete newClipData.id; // 기존 ID 제거

        // 원본 클립 바로 뒤에 배치할 예정 위치
        const targetTime = original.startTime + original.duration;

        // 겹치지 않는 위치 찾기
        const nonOverlappingTime = this.findNonOverlappingTime(
            targetTime,
            newClipData.duration,
            newClipData.trackIndex
        );

        newClipData.startTime = nonOverlappingTime;

        // 상태 저장은 addClip에서 자동으로 처리됨
        // 중복 저장 방지를 위해 임시로 플래그 설정
        const shouldSaveState = !this.isRestoringState;
        this.isRestoringState = true;
        this.addClip(original.type, newClipData);
        this.isRestoringState = false;

        // 복제 작업으로 상태 저장
        if (shouldSaveState) {
            this.saveState('클립 복제');
        }
    }

    /**
     * 클립 드래그 시작
     */
    handleClipMouseDown(e, clipId) {
        if (e.target.classList.contains('clip-handle-left') ||
            e.target.classList.contains('clip-handle-right')) {
            return; // 핸들은 따로 처리
        }

        e.preventDefault();
        e.stopPropagation();

        // Ctrl 키가 눌려있으면 다중 선택
        const multiSelect = e.ctrlKey || e.metaKey;

        // 현재 클립이 이미 선택되어 있지 않으면 선택 처리
        if (!this.selectedClipIds.includes(clipId)) {
            this.selectClip(clipId, multiSelect);
        } else if (multiSelect) {
            // Ctrl+클릭으로 선택 해제
            const index = this.selectedClipIds.indexOf(clipId);
            if (index > -1) {
                this.selectedClipIds.splice(index, 1);
                const clipEl = document.getElementById(clipId);
                if (clipEl) clipEl.classList.remove('selected');

                // 마지막 선택된 클립 업데이트
                this.selectedClipId = this.selectedClipIds.length > 0
                    ? this.selectedClipIds[this.selectedClipIds.length - 1]
                    : null;

                if (window.app && window.app.leftPanel) {
                    window.app.leftPanel.updateLayers();
                }

                // 선택 상태 UI 및 프리뷰 동기화
                this.updateClipSelection();
                return; // 드래그 시작하지 않음
            }
        }

        this.dragState.isDragging = true;
        this.dragState.lastValidDeltaTime = 0; // 마지막 유효 수평 이동량 초기화
        this.dragState.clipId = clipId;
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;
        this.dragState.startTime = this.clips[clipId].startTime;
        this.dragState.originalTrackIndex = this.clips[clipId].trackIndex;

        // 다중 선택된 경우 모든 클립의 원래 위치 저장
        this.dragState.originalPositions = {};
        this.selectedClipIds.forEach(id => {
            if (this.clips[id]) {
                this.dragState.originalPositions[id] = {
                    startTime: this.clips[id].startTime,
                    trackIndex: this.clips[id].trackIndex
                };
            }
        });

        // 드래그 중 커서 변경
        document.body.style.cursor = 'grabbing';
    }

    /**
     * 크기 조절 시작
     */
    startResize(e, clipId, direction) {
        e.preventDefault();
        e.stopPropagation();

        // 다중 선택된 클립이 아니면 선택
        if (!this.selectedClipIds.includes(clipId)) {
            this.selectClip(clipId);
        }

        this.dragState.isResizing = true;
        this.dragState.resizeDirection = direction;
        this.dragState.clipId = clipId;
        this.dragState.startX = e.clientX;
        this.dragState.startTime = this.clips[clipId].startTime;
        this.dragState.startDuration = this.clips[clipId].duration;

        // 다중 선택된 경우 모든 클립의 원래 크기와 위치 저장
        this.dragState.originalPositions = {};
        this.selectedClipIds.forEach(id => {
            if (this.clips[id]) {
                this.dragState.originalPositions[id] = {
                    startTime: this.clips[id].startTime,
                    duration: this.clips[id].duration
                };
            }
        });

        document.body.style.cursor = 'ew-resize';
    }

    /**
     * 마우스 이동 처리
     */
    handleMouseMove(e) {
        // 드래그 박스/인디케이터/키프레임/클립 순
        if (this.selectionBox.isSelecting) {
            this.handleSelectionBoxDrag(e);
        } else if (this.timeIndicatorDrag.isDragging) {
            this.handleTimeIndicatorDrag(e);
        } else if (this.dragState.keyframeId) {
            this.handleKeyframeDrag(e);
        } else if (this.dragState.isDragging) {
            this.handleClipDrag(e);
        } else if (this.dragState.isResizing) {
            this.handleClipResize(e);
        }
    }

    /**
     * 타임 인디케이터 드래그
     */
    handleTimeIndicatorDrag(e) {
        const rect = this.timelineBody.getBoundingClientRect();
        const x = e.clientX - rect.left + this.timelineBody.scrollLeft;
        const newTime = Math.max(0, Math.min(x / this.pixelsPerSecond, this.totalDuration));
        this.setCurrentTime(newTime);

        // 시간 인디케이터 이동은 자동 저장하지 않음
    }

    /**
     * 드래그 박스 선택
     */
    handleSelectionBoxDrag(e) {
        const rect = this.timelineBody.getBoundingClientRect();
        const currentX = e.clientX - rect.left + this.timelineBody.scrollLeft;
        const currentY = e.clientY - rect.top + this.timelineBody.scrollTop;

        const deltaX = Math.abs(currentX - this.selectionBox.startX);
        const deltaY = Math.abs(currentY - this.selectionBox.startY);
        const dragThreshold = 3;

        if (!this.selectionBox.hasMoved) {
            if (deltaX <= dragThreshold && deltaY <= dragThreshold) {
                return; // 아직 드래그로 간주하지 않음
            }

            this.selectionBox.hasMoved = true;
            this.selectionBox.element.style.display = 'block';
        }

        // 드래그 박스 크기 및 위치 계산
        const left = Math.min(this.selectionBox.startX, currentX);
        const top = Math.min(this.selectionBox.startY, currentY);
        const width = Math.abs(currentX - this.selectionBox.startX);
        const height = Math.abs(currentY - this.selectionBox.startY);

        this.selectionBox.element.style.left = left + 'px';
        this.selectionBox.element.style.top = top + 'px';
        this.selectionBox.element.style.width = width + 'px';
        this.selectionBox.element.style.height = height + 'px';

        // 드래그 박스 내의 클립들 선택
        this.selectClipsInBox(left, top, width, height);

        // 드래그 박스 선택은 자동 저장하지 않음
    }

    /**
     * 박스 내의 클립들 선택
     */
    selectClipsInBox(boxLeft, boxTop, boxWidth, boxHeight) {
        const boxRight = boxLeft + boxWidth;
        const boxBottom = boxTop + boxHeight;

        // 임시로 선택할 클립 ID 배열
        const clipsInBox = [];

        Object.values(this.clips).forEach(clipData => {
            const clipEl = document.getElementById(clipData.id);
            if (!clipEl) return;

            // 클립의 위치와 크기
            const clipRect = clipEl.getBoundingClientRect();
            const timelineRect = this.timelineBody.getBoundingClientRect();

            const clipLeft = clipData.startTime * this.pixelsPerSecond;
            const clipRight = clipLeft + (clipData.duration * this.pixelsPerSecond);
            const clipTop = clipData.trackIndex * 80; // 트랙 높이
            const clipBottom = clipTop + 80;

            // 박스와 클립이 겹치는지 확인
            if (!(clipRight < boxLeft || clipLeft > boxRight || clipBottom < boxTop || clipTop > boxBottom)) {
                clipsInBox.push(clipData.id);
            }
        });

        // 선택 상태 업데이트
        // Ctrl 키가 눌려있지 않으면 기존 선택 해제
        if (!this.selectionBox.ctrlKey) {
            // 모든 선택 해제
            document.querySelectorAll('.clip').forEach(el => el.classList.remove('selected'));
            this.selectedClipIds = [];
        }

        // 박스 내의 클립들 선택 추가
        clipsInBox.forEach(clipId => {
            if (!this.selectedClipIds.includes(clipId)) {
                this.selectedClipIds.push(clipId);
                const clipEl = document.getElementById(clipId);
                if (clipEl) clipEl.classList.add('selected');
            }
        });

        if (this.selectedClipIds.length > 0) {
            this.selectedClipId = this.selectedClipIds[this.selectedClipIds.length - 1];
        } else {
            this.selectedClipId = null;
        }

        // 속성 패널 업데이트
        if (window.app && window.app.propertiesPanel) {
            if (this.selectedClipIds.length === 1) {
                window.app.propertiesPanel.showProperties(this.clips[this.selectedClipId]);
            } else if (this.selectedClipIds.length > 1) {
                window.app.propertiesPanel.showMultipleSelection(this.selectedClipIds.length);
            } else {
                window.app.propertiesPanel.hideProperties();
            }
        }

        // 레이어 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }

        // 미리보기(캔버스) 선택 상태 동기화
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.syncSelectionFromTimeline();
        }
    }

    /**
     * 클립 드래그 (다중 선택 지원)
     */
    handleClipDrag(e) {
        const clipId = this.dragState.clipId;
        const clipData = this.clips[clipId];
        if (!clipData) return;

        const deltaX = e.clientX - this.dragState.startX;
        const deltaY = e.clientY - this.dragState.startY;
        const deltaTime = deltaX / this.pixelsPerSecond;
        let newStartTime = Math.max(0, this.dragState.startTime + deltaTime);

        // 트랙 변경 감지 (세로 이동)
        let newTrackIndex = this.dragState.originalTrackIndex;
        if (Math.abs(deltaY) > 40) {
            const trackOffset = Math.round(deltaY / 80);
            const proposedTrackIndex = this.dragState.originalTrackIndex + trackOffset;
            // 트랙 범위 클램핑 - 범위를 벗어나면 맨 위/맨 아래로
            if (proposedTrackIndex >= this.tracks.length) {
                newTrackIndex = this.tracks.length - 1; // 맨 아래 트랙
            } else if (proposedTrackIndex < 0) {
                newTrackIndex = 0; // 맨 위 트랙
            } else {
                newTrackIndex = proposedTrackIndex;
            }
        }

        // 다중 선택된 클립들 처리
        if (this.selectedClipIds.length > 1) {
            this.handleMultiClipDrag(deltaTime, newTrackIndex);
        } else {
            // 단일 클립 드래그
            this.handleSingleClipDrag(clipId, clipData, newStartTime, newTrackIndex);
        }
    }

    /**
     * 단일 클립 드래그
     */
    handleSingleClipDrag(clipId, clipData, newStartTime, newTrackIndex) {
        const currentTrackIndex = clipData.trackIndex;
        const trackChanged = newTrackIndex !== currentTrackIndex;

        // 트랙이 변경되는 경우: 새 트랙에서 충돌 검사
        if (trackChanged) {
            const endTime = newStartTime + clipData.duration;
            let hasCollision = false;

            Object.values(this.clips).forEach(otherClip => {
                if (otherClip.id === clipId) return;
                if (otherClip.trackIndex !== newTrackIndex) return;

                const otherEndTime = otherClip.startTime + otherClip.duration;
                // 겹치는지 확인
                if (!(endTime <= otherClip.startTime || newStartTime >= otherEndTime)) {
                    hasCollision = true;
                }
            });

            // 새 트랙에서 충돌이 있으면 트랙 변경을 취소하고 원래 트랙에서만 이동
            if (hasCollision) {
                newTrackIndex = currentTrackIndex;
            }
        }

        // 충돌하는 클립 찾기 및 최대 이동 거리 계산
        const originalStartTime = this.dragState.startTime;
        const deltaTime = newStartTime - originalStartTime;
        let maxAllowedStartTime = newStartTime;

        Object.values(this.clips).forEach(otherClip => {
            if (otherClip.id === clipId) return;
            if (otherClip.trackIndex !== newTrackIndex) return;

            const otherEndTime = otherClip.startTime + otherClip.duration;
            const clipEndTime = newStartTime + clipData.duration;

            // 오른쪽으로 이동 (deltaTime > 0)
            if (deltaTime > 0 && otherClip.startTime >= originalStartTime) {
                // 충돌 검사
                if (clipEndTime > otherClip.startTime && newStartTime < otherEndTime) {
                    // 충돌 발생
                    // 옵션 1: 충돌 클립 바로 앞까지
                    const snapBefore = otherClip.startTime - clipData.duration;
                    // 옵션 2: 충돌 클립을 넘어서 뒤로
                    const snapAfter = otherEndTime;

                    // deltaTime이 충분히 크면 (중간점을 넘으면) 뒤로, 아니면 앞으로
                    const midPoint = (snapBefore - originalStartTime + snapAfter - originalStartTime) / 2 + originalStartTime;
                    if (newStartTime > midPoint) {
                        // 충돌 클립 뒤로 스냅
                        maxAllowedStartTime = Math.max(maxAllowedStartTime, snapAfter);
                    } else {
                        // 충돌 클립 앞으로 스냅
                        maxAllowedStartTime = Math.min(maxAllowedStartTime, snapBefore);
                    }
                }
            }

            // 왼쪽으로 이동 (deltaTime < 0)
            if (deltaTime < 0 && otherEndTime <= originalStartTime + clipData.duration) {
                // 충돌 검사
                if (newStartTime < otherEndTime && clipEndTime > otherClip.startTime) {
                    // 충돌 발생
                    // 옵션 1: 충돌 클립 바로 뒤까지
                    const snapAfter = otherEndTime;
                    // 옵션 2: 충돌 클립을 넘어서 앞으로
                    const snapBefore = otherClip.startTime - clipData.duration;

                    // deltaTime이 충분히 크면 (중간점을 넘으면) 앞으로, 아니면 뒤로
                    const midPoint = (snapBefore - originalStartTime + snapAfter - originalStartTime) / 2 + originalStartTime;
                    if (newStartTime < midPoint) {
                        // 충돌 클립 앞으로 스냅
                        maxAllowedStartTime = Math.min(maxAllowedStartTime, snapBefore);
                    } else {
                        // 충돌 클립 뒤로 스냅
                        maxAllowedStartTime = Math.max(maxAllowedStartTime, snapAfter);
                    }
                }
            }
        });

        // 조정된 위치로 이동
        newStartTime = Math.max(0, maxAllowedStartTime);

        // 타임라인 자동 확장
        const maxEndTime = newStartTime + clipData.duration;
        if (maxEndTime > this.totalDuration) {
            this.totalDuration = Math.ceil(maxEndTime / 10) * 10 + 10;
            this.updateRuler();
            this.updateTracksWidth();
        }

        clipData.startTime = newStartTime;

        // 트랙이 변경되었다면
        if (newTrackIndex !== clipData.trackIndex) {
            const clipEl = document.getElementById(clipId);
            if (clipEl) {
                // 이전 트랙에서 제거
                clipEl.remove();
                // 새 트랙에 추가
                clipData.trackIndex = newTrackIndex;
                this.tracks[newTrackIndex].appendChild(clipEl);
            }
        }

        const clipEl = document.getElementById(clipId);
        if (clipEl) {
            clipEl.style.left = (newStartTime * this.pixelsPerSecond) + 'px';
        }

        // 속성 패널 업데이트
        if (window.app && window.app.propertiesPanel && this.selectedClipId === clipId) {
            window.app.propertiesPanel.updateTimeInputs(clipData);
        }

        // 미리보기 실시간 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }
    }

    /**
     * 다중 클립 드래그 (재작성 v4 - 상태 기반 "벽" 효과)
     */
    handleMultiClipDrag(deltaTime, newTrackIndex) {
        const selectedClips = this.selectedClipIds.map(id => this.clips[id]).filter(clip => clip);
        if (selectedClips.length === 0) return;

        // 현재 그룹의 트랙 오프셋 확인
        const sampleClip = selectedClips[0];
        const originalSamplePos = this.dragState.originalPositions[sampleClip.id];
        const currentTrackOffset = sampleClip.trackIndex - originalSamplePos.trackIndex;

        // --- 1. 수직 이동 제안 및 검증 ---
        let proposedTrackOffset = newTrackIndex - this.dragState.originalTrackIndex;
        const attemptedTrackChange = (proposedTrackOffset !== currentTrackOffset);

        // 1a. 트랙 범위 클램핑
        const minTrack = Math.min(...selectedClips.map(c => this.dragState.originalPositions[c.id].trackIndex));
        const maxTrack = Math.max(...selectedClips.map(c => this.dragState.originalPositions[c.id].trackIndex));
        if (minTrack + proposedTrackOffset < 0) {
            proposedTrackOffset = -minTrack;
        } else if (maxTrack + proposedTrackOffset >= this.tracks.length) {
            proposedTrackOffset = this.tracks.length - 1 - maxTrack;
        }

        // 1b. 제안된 위치에서 충돌 검사
        let finalTrackOffset = proposedTrackOffset;
        let collisionDetected = false;
        if (proposedTrackOffset !== currentTrackOffset) {
            for (const clip of selectedClips) {
                const originalPos = this.dragState.originalPositions[clip.id];
                const targetTrack = originalPos.trackIndex + proposedTrackOffset;
                const proposedStart = originalPos.startTime + deltaTime;
                const proposedEnd = proposedStart + clip.duration;

                if (Object.values(this.clips).some(other =>
                    !this.selectedClipIds.includes(other.id) && other.trackIndex === targetTrack &&
                    proposedEnd > other.startTime && proposedStart < (other.startTime + other.duration)
                )) {
                    collisionDetected = true;
                    break;
                }
            }
        }

        if (collisionDetected) {
            finalTrackOffset = currentTrackOffset; // 충돌 시 현재 위치 유지
        }

        // --- 2. 수평 이동 결정 ---
        let finalDeltaTime = deltaTime;
        const groupMinStart = Math.min(...selectedClips.map(c => this.dragState.originalPositions[c.id].startTime));

        // "벽" 효과: 트랙 변경 시도가 충돌로 실패했다면, 이전 수평 위치 유지
        if (attemptedTrackChange && finalTrackOffset === currentTrackOffset && collisionDetected) {
            finalDeltaTime = this.dragState.lastValidDeltaTime;
        } else {
            // 정상적인 수평 이동 및 스냅 로직
            let isSnapping = false;
            let allSnapBefores = [], allSnapAfters = [];

            for (const clip of selectedClips) {
                const originalPos = this.dragState.originalPositions[clip.id];
                const targetTrack = originalPos.trackIndex + finalTrackOffset;
                for (const other of Object.values(this.clips)) {
                    if (this.selectedClipIds.includes(other.id) || other.trackIndex !== targetTrack) continue;
                    const proposedStart = originalPos.startTime + deltaTime;
                    const proposedEnd = proposedStart + clip.duration;
                    if (proposedEnd > other.startTime && proposedStart < other.startTime + other.duration) {
                        isSnapping = true;
                        allSnapBefores.push((other.startTime - clip.duration) - originalPos.startTime);
                        allSnapAfters.push((other.startTime + other.duration) - originalPos.startTime);
                    }
                }
            }

            if (isSnapping) {
                const finalSnapBefore = Math.min(...allSnapBefores);
                const finalSnapAfter = Math.max(...allSnapAfters);
                const midPoint = (finalSnapBefore + finalSnapAfter) / 2;
                if (deltaTime > 0) {
                    finalDeltaTime = deltaTime > midPoint ? finalSnapAfter : finalSnapBefore;
                } else {
                    finalDeltaTime = deltaTime < midPoint ? finalSnapBefore : finalSnapAfter;
                }
            }
            // 마지막 유효 이동량 저장
            this.dragState.lastValidDeltaTime = finalDeltaTime;
        }

        // --- 3. 최종 위치 적용 ---
        if (groupMinStart + finalDeltaTime < 0) {
            finalDeltaTime = -groupMinStart;
        }

        let maxEndTime = 0;
        selectedClips.forEach(clip => {
            const originalPos = this.dragState.originalPositions[clip.id];
            const newStartTime = originalPos.startTime + finalDeltaTime;
            const newTrackIndex = originalPos.trackIndex + finalTrackOffset;
            clip.startTime = newStartTime;
            maxEndTime = Math.max(maxEndTime, newStartTime + clip.duration);
            const clipEl = document.getElementById(clip.id);
            if (clip.trackIndex !== newTrackIndex) {
                clip.trackIndex = newTrackIndex;
                this.tracks[newTrackIndex].appendChild(clipEl);
            }
            clipEl.style.left = (newStartTime * this.pixelsPerSecond) + 'px';
        });

        if (maxEndTime > this.totalDuration) {
            this.totalDuration = Math.ceil(maxEndTime / 10) * 10 + 10;
            this.updateRuler();
            this.updateTracksWidth();
        }

        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }
    }

    /**
     * 클립 크기 조절 (다중 선택 지원)
     */
    handleClipResize(e) {
        const clipId = this.dragState.clipId;
        const clipData = this.clips[clipId];
        if (!clipData) return;

        const deltaX = e.clientX - this.dragState.startX;
        const deltaTime = deltaX / this.pixelsPerSecond;

        // 다중 선택된 클립들 처리
        if (this.selectedClipIds.length > 1) {
            this.handleMultiClipResize(deltaTime);
        } else {
            // 단일 클립 크기 조절
            this.handleSingleClipResize(clipId, clipData, deltaTime);
        }
    }

    /**
     * 단일 클립 크기 조절
     */
    handleSingleClipResize(clipId, clipData, deltaTime) {
        let newStartTime = clipData.startTime;
        let newDuration = clipData.duration;

        if (this.dragState.resizeDirection === 'right') {
            // 오른쪽 핸들: duration 변경
            newDuration = Math.max(0.1, this.dragState.startDuration + deltaTime);

            // 충돌 검사: 오른쪽에 있는 클립 찾기
            let maxAllowedDuration = newDuration;
            Object.values(this.clips).forEach(otherClip => {
                if (otherClip.id === clipId) return;
                if (otherClip.trackIndex !== clipData.trackIndex) return;

                // 이 클립보다 오른쪽에 있는 클립만 체크
                if (otherClip.startTime > clipData.startTime) {
                    // 충돌할 경우, 그 클립 시작점까지만 늘어남
                    if ((clipData.startTime + newDuration) > otherClip.startTime) {
                        maxAllowedDuration = otherClip.startTime - clipData.startTime;
                    }
                }
            });
            newDuration = Math.max(0.1, maxAllowedDuration);

        } else if (this.dragState.resizeDirection === 'left') {
            // 왼쪽 핸들: startTime과 duration 동시 변경
            newStartTime = Math.max(0, this.dragState.startTime + deltaTime);
            const originalEndTime = this.dragState.startTime + this.dragState.startDuration;
            newDuration = originalEndTime - newStartTime;

            // 최소 크기 제한을 먼저 적용
            if (newDuration < 0.1) {
                newDuration = 0.1;
                newStartTime = originalEndTime - 0.1;
            }

            // 충돌 검사: 왼쪽에 있는 클립 찾기
            let maxAllowedStartTime = newStartTime;
            Object.values(this.clips).forEach(otherClip => {
                if (otherClip.id === clipId) return;
                if (otherClip.trackIndex !== clipData.trackIndex) return;

                const otherEndTime = otherClip.startTime + otherClip.duration;
                // 이 클립보다 왼쪽에 있는 클립만 체크
                if (otherEndTime <= originalEndTime) {
                    // 충돌할 경우, 그 클립 끝점까지만 이동
                    if (newStartTime < otherEndTime) {
                        maxAllowedStartTime = otherEndTime;
                    }
                }
            });

            newStartTime = maxAllowedStartTime;
            // duration 재계산
            newDuration = originalEndTime - newStartTime;
            newDuration = Math.max(0.1, newDuration);
        }

        // 타임라인 자동 확장
        const maxEndTime = newStartTime + newDuration;
        if (maxEndTime > this.totalDuration) {
            this.totalDuration = Math.ceil(maxEndTime / 10) * 10 + 10;
            this.updateRuler();
            this.updateTracksWidth();
        }

        clipData.startTime = newStartTime;
        clipData.duration = newDuration;

        const clipEl = document.getElementById(clipId);
        if (clipEl) {
            clipEl.style.left = (clipData.startTime * this.pixelsPerSecond) + 'px';
            clipEl.style.width = (clipData.duration * this.pixelsPerSecond) + 'px';
        }

        // 속성 패널 업데이트
        if (window.app && window.app.propertiesPanel && this.selectedClipId === clipId) {
            window.app.propertiesPanel.updateTimeInputs(clipData);
        }

        // 미리보기 실시간 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }
    }

    /**
     * 다중 클립 크기 조절 (v3 - 앵커 클립 기준)
     */
    handleMultiClipResize(deltaTime) {
        const selectedClips = this.selectedClipIds.map(id => this.clips[id]).filter(clip => clip);
        if (selectedClips.length < 1) return;

        // 드래그를 시작한 '앵커' 클립
        const anchorClipId = this.dragState.clipId;
        const anchorClipOriginalPos = this.dragState.originalPositions[anchorClipId];
        if (!anchorClipOriginalPos || anchorClipOriginalPos.duration <= 0) return;

        // 1. 제안된 스케일 계산 (앵커 클립 기준)
        let proposedScale;
        if (this.dragState.resizeDirection === 'right') {
            const newDuration = anchorClipOriginalPos.duration + deltaTime;
            proposedScale = newDuration / anchorClipOriginalPos.duration;
        } else { // 'left'
            const newStartTime = anchorClipOriginalPos.startTime + deltaTime;
            const originalEndTime = anchorClipOriginalPos.startTime + anchorClipOriginalPos.duration;
            const newDuration = originalEndTime - newStartTime;
            proposedScale = newDuration / anchorClipOriginalPos.duration;
        }
        if (!isFinite(proposedScale) || proposedScale <= 0) proposedScale = 0.0001;

        // 2. 스케일링의 기준점(앵커 포인트) 설정
        const anchorPoint = (this.dragState.resizeDirection === 'right')
            ? anchorClipOriginalPos.startTime
            : anchorClipOriginalPos.startTime + anchorClipOriginalPos.duration;

        // 3. 모든 클립에 대한 최소/최대 스케일 계산
        let minScaleOverall = 0;
        let maxScaleOverall = Infinity;

        // 3a. 최소 크기(0.1초) 제한
        selectedClips.forEach(clip => {
            const originalPos = this.dragState.originalPositions[clip.id];
            if (originalPos && originalPos.duration > 0) {
                minScaleOverall = Math.max(minScaleOverall, 0.1 / originalPos.duration);
            }
        });

        // 3b. 충돌 제한
        for (const clip of selectedClips) {
            const originalPos = this.dragState.originalPositions[clip.id];
            if (!originalPos) continue;

            const othersOnTrack = Object.values(this.clips).filter(c =>
                c.trackIndex === clip.trackIndex && !this.selectedClipIds.includes(c.id)
            );

            // 0초 "벽"을 가장 왼쪽에 있는 이웃으로 간주하여 충돌을 계산
            const wallTerm = anchorPoint - originalPos.startTime;
            if (wallTerm > 1e-9) { // 0으로 나누기 방지 및 클립이 앵커 왼쪽에 있을때만
                const scaleToHitWall = anchorPoint / wallTerm;
                if ((this.dragState.resizeDirection === 'left' && scaleToHitWall < maxScaleOverall) ||
                    (this.dragState.resizeDirection === 'right' && proposedScale > 1 && scaleToHitWall < maxScaleOverall)) {
                    maxScaleOverall = scaleToHitWall;
                }
            }

            if (this.dragState.resizeDirection === 'right') {
                const rightNeighbor = othersOnTrack
                    .filter(o => o.startTime >= originalPos.startTime + originalPos.duration)
                    .sort((a, b) => a.startTime - b.startTime)[0];

                if (rightNeighbor) {
                    const distToNeighbor = rightNeighbor.startTime - anchorPoint;
                    const distToOrigEnd = (originalPos.startTime + originalPos.duration) - anchorPoint;
                    if (distToOrigEnd > 1e-6) { // 0으로 나누기 방지
                        maxScaleOverall = Math.min(maxScaleOverall, distToNeighbor / distToOrigEnd);
                    } else if (distToNeighbor < 0) {
                        maxScaleOverall = 0; // 이미 겹쳐있는 경우
                    }
                }
            } else { // 'left'
                // 왼쪽 이웃
                const leftNeighbor = othersOnTrack
                    .filter(o => (o.startTime + o.duration) <= originalPos.startTime)
                    .sort((a, b) => (b.startTime + b.duration) - (a.startTime + a.duration))[0];
                const neighborEnd = leftNeighbor ? (leftNeighbor.startTime + leftNeighbor.duration) : 0; // 0초 경계 포함

                const distToNeighbor = neighborEnd - anchorPoint;
                const distToOrigStart = originalPos.startTime - anchorPoint;

                if (Math.abs(distToOrigStart) > 1e-6) { // 0으로 나누기 방지
                    maxScaleOverall = Math.min(maxScaleOverall, distToNeighbor / distToOrigStart);
                } else if ((this.dragState.resizeDirection === 'left' && distToNeighbor > 0) || (this.dragState.resizeDirection === 'right' && distToNeighbor < 0)) {
                    maxScaleOverall = 0;
                }
            }
        }

        // 4. 최종 스케일 결정
        const finalScale = Math.max(minScaleOverall, Math.min(proposedScale, maxScaleOverall));
        if (!isFinite(finalScale)) return;

        // 5. 모든 클립에 최종 위치 적용
        const newPositions = [];
        for (const clip of selectedClips) {
            const originalPos = this.dragState.originalPositions[clip.id];
            if (!originalPos) continue;

            const newDuration = originalPos.duration * finalScale;
            let newStartTime;

            if (this.dragState.resizeDirection === 'right') {
                const distToOrigStart = originalPos.startTime - anchorPoint;
                newStartTime = anchorPoint + (distToOrigStart * finalScale);
            } else { // 'left'
                const distToOrigEnd = (originalPos.startTime + originalPos.duration) - anchorPoint;
                const newEndTime = anchorPoint + (distToOrigEnd * finalScale);
                newStartTime = newEndTime - newDuration;
            }

            const clampedStartTime = Math.max(0, newStartTime);
            const adjustedDuration = (newStartTime < 0) ? (newDuration + newStartTime) : newDuration;

            newPositions.push({
                clip: clip,
                newStartTime: clampedStartTime,
                newDuration: Math.max(0.1, adjustedDuration)
            });
        }

        // 타임라인 자동 확장 체크
        let maxEndTime = 0;
        newPositions.forEach(pos => maxEndTime = Math.max(maxEndTime, pos.newStartTime + pos.newDuration));

        if (maxEndTime > this.totalDuration) {
            this.totalDuration = Math.ceil(maxEndTime / 10) * 10 + 10;
            this.updateRuler();
            this.updateTracksWidth();
        }

        // 모든 클립 DOM 업데이트
        newPositions.forEach(pos => {
            pos.clip.startTime = pos.newStartTime;
            pos.clip.duration = pos.newDuration;

            const clipEl = document.getElementById(pos.clip.id);
            if (clipEl) {
                clipEl.style.left = (pos.newStartTime * this.pixelsPerSecond) + 'px';
                clipEl.style.width = (pos.newDuration * this.pixelsPerSecond) + 'px';
            }
        });

        // 미리보기 실시간 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }
    }

    /**
     * 마우스 업 처리
     */
    handleMouseUp(e) {
        const wasDragging = this.dragState.isDragging;
        const wasResizing = this.dragState.isResizing;

        if (wasDragging || wasResizing) {
            // 레이어 업데이트
            if (window.app && window.app.leftPanel) {
                window.app.leftPanel.updateLayers();
            }

            // 드래그/크기 조절 완료 후 상태 저장
            if (wasDragging) {
                this.saveState('클립 이동');
            } else if (wasResizing) {
                this.saveState('클립 크기 조절');
            }
        }

        // 드래그 박스 선택 종료
        if (this.selectionBox.isSelecting) {
            // 드래그 없이 클릭만 한 경우 별도 처리 (현재는 시간 이동 없음)
            if (this.selectionBox.hasMoved) {
                const boxWidth = parseFloat(this.selectionBox.element.style.width || '0');
                const boxHeight = parseFloat(this.selectionBox.element.style.height || '0');

                // 박스가 충분히 크지 않은 경우에는 선택 상태를 유지하지 않음
                if (boxWidth < 5 || boxHeight < 5) {
                    this.deselectAllClips();
                }
            }

            this.selectionBox.isSelecting = false;
            this.selectionBox.element.style.display = 'none';
            this.selectionBox.ctrlKey = false;
            this.selectionBox.hasMoved = false;
        }

        this.dragState.isDragging = false;
        this.dragState.isResizing = false;
        this.dragState.clipId = null;
        this.dragState.originalTrackIndex = null;
        this.dragState.originalPositions = {}; // 원래 위치 초기화
        this.timeIndicatorDrag.isDragging = false;

        // 커서 복원
        document.body.style.cursor = '';

        // 키프레임 처리
        if (this.dragState.keyframeId) {
            if (this.dragState.isDraggingKeyframe && this.dragState.keyframeHasMoved) {
                // 이동 완료
                const keyframe = this.cameraKeyframes.find(kf => kf.id === this.dragState.keyframeId);
                if (keyframe) {
                    // 시간 변경 시 정렬
                    this.cameraKeyframes.sort((a, b) => a.time - b.time);

                    // 값 변경과 시간 변경을 구분하여 상태 저장
                    if (this.dragState.isDraggingValue && this.dragState.keyframeInitialValue !== undefined) {
                        const currentValue = keyframe.values[this.dragState.keyframeProperty];
                        if (this.dragState.keyframeInitialValue !== currentValue) {
                            this.saveState('카메라 키프레임 값 변경');
                        }
                    } else {
                        this.saveState('카메라 키프레임 이동');
                    }

                    this.renderCameraKeyframes();
                }
            } else {
                // 클릭만 한 경우: 선택 및 속성 패널 열기
                const keyframe = this.cameraKeyframes.find(kf => kf.id === this.dragState.keyframeId);
                if (keyframe) this.selectKeyframe(keyframe);
            }
            this.dragState.isDraggingKeyframe = false;
            this.dragState.isDraggingValue = false;
            this.dragState.keyframeId = null;
            this.dragState.keyframeProperty = null;
            this.dragState.keyframeHasMoved = false;
            this.dragState.keyframeInitialValue = undefined;
            this.dragState.keyframeMinValue = undefined;
            this.dragState.keyframeMaxValue = undefined;
        }
    }

    /**
     * 클립 컨텍스트 메뉴 설정
     */
    setupClipContextMenu() {
        const contextMenu = document.getElementById('clipContextMenu');
        if (!contextMenu) return;

        // 메뉴 아이템 클릭
        contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item) return;

            const action = item.dataset.action;
            const clipId = contextMenu.dataset.clipId;
            const clickX = parseInt(contextMenu.dataset.clickX || '0');

            this.handleClipContextAction(action, clipId, clickX);
            this.hideAllContextMenus();
        });

        // 외부 클릭시 메뉴 숨기기 -> 전역 리스너로 대체
    }

    /**
     * 클립 컨텍스트 메뉴 표시
     */
    showClipContextMenu(e, clipId) {
        this.hideAllContextMenus();

        // 우클릭된 클립을 선택 (선택되지 않은 경우)
        if (!this.selectedClipIds.includes(clipId)) {
            this.selectClip(clipId);
        }

        const menu = document.getElementById('clipContextMenu');
        if (!menu) return;

        menu.dataset.clipId = clipId;

        // 타임라인 위의 클릭 위치 저장 (붙여넣기용)
        const rect = this.timelineBody.getBoundingClientRect();
        const clickX = e.clientX - rect.left + this.timelineBody.scrollLeft;
        menu.dataset.clickX = clickX;

        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';

        // 붙여넣기 메뉴 항목 활성화/비활성화
        const pasteItem = menu.querySelector('[data-action="paste"]');
        if (pasteItem) {
            if (this.clipboard) {
                pasteItem.style.opacity = '1';
                pasteItem.style.pointerEvents = 'auto';
            } else {
                pasteItem.style.opacity = '0.5';
                pasteItem.style.pointerEvents = 'none';
            }
        }

        // 활성화/비활성화 메뉴 항목 업데이트
        const visibilityItem = menu.querySelector('[data-action="toggleVisibility"]');
        if (visibilityItem) {
            const icon = visibilityItem.querySelector('i');
            const text = visibilityItem.querySelector('.visibility-text');
            const isHidden = this.hiddenClips.has(clipId);

            if (isHidden) {
                icon.className = 'fa-solid fa-eye-slash';
                text.textContent = '보이기';
            } else {
                icon.className = 'fa-solid fa-eye';
                text.textContent = '숨기기';
            }
        }
    }

    /**
     * 클립 컨텍스트 메뉴 숨기기
     */
    hideClipContextMenu() {
        const menu = document.getElementById('clipContextMenu');
        if (menu) {
            menu.style.display = 'none';
        }
    }

    /**
     * 모든 컨텍스트 메뉴 숨기기
     */
    hideAllContextMenus() {
        document.querySelectorAll('.context-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }

    /**
     * 클립 컨텍스트 메뉴 액션 처리
     */
    handleClipContextAction(action, clipId, clickX) {
        switch (action) {
            case 'copy':
                this.copyClip(clipId);
                break;
            case 'cut':
                this.cutClip(clipId);
                break;
            case 'paste':
                this.pasteClip(clickX);
                break;
            case 'duplicate':
                this.duplicateClip(clipId);
                break;
            case 'toggleVisibility':
                this.toggleClipVisibility(clipId);
                break;
            case 'delete':
                this.deleteClip(clipId);
                break;
        }
    }

    /**
     * 트랙 컨텍스트 메뉴 표시
     */
    showTrackContextMenu(e, trackElement) {
        this.hideAllContextMenus();

        const menu = document.getElementById('trackContextMenu');
        if (!menu) return;

        // 타임라인 위의 클릭 위치 저장 (붙여넣기용)
        const rect = this.timelineBody.getBoundingClientRect();
        const clickX = e.clientX - rect.left + this.timelineBody.scrollLeft;
        menu.dataset.clickX = clickX;
        menu.dataset.trackIndex = trackElement.dataset.trackIndex; // trackIndex 저장

        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';

        const newMenu = menu.cloneNode(true);
        menu.parentNode.replaceChild(newMenu, menu);

        // 클립 붙여넣기 메뉴 항목 활성화/비활성화
        const pasteClipItem = newMenu.querySelector('[data-action="pasteClip"]');
        if (pasteClipItem) {
            if (this.clipboard) {
                pasteClipItem.style.opacity = '1';
                pasteClipItem.style.pointerEvents = 'auto';
            } else {
                pasteClipItem.style.opacity = '0.5';
                pasteClipItem.style.pointerEvents = 'none';
            }
        }

        // 트랙 붙여넣기 메뉴 항목 활성화/비활성화
        const pasteTrackItem = newMenu.querySelector('[data-action="pasteTrack"]');
        if (pasteTrackItem) {
            if (this.trackClipboard) {
                pasteTrackItem.style.opacity = '1';
                pasteTrackItem.style.pointerEvents = 'auto';
            } else {
                pasteTrackItem.style.opacity = '0.5';
                pasteTrackItem.style.pointerEvents = 'none';
            }
        }

        const items = newMenu.querySelectorAll('.context-menu-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                const clickedTrackIndex = parseInt(newMenu.dataset.trackIndex, 10);
                const clickedTrackElement = this.tracks[clickedTrackIndex];

                if (action === 'delete') {
                    if (this.tracks.length > 1) {
                        this.deleteTrack(clickedTrackElement);
                    } else {
                        alert('최소 1개의 트랙은 필요합니다.');
                    }
                } else if (action === 'duplicate') {
                    this.duplicateTrack(clickedTrackElement);
                } else if (action === 'pasteClip') {
                    const clickX = parseInt(newMenu.dataset.clickX || '0');
                    this.pasteClip(clickX);
                } else if (action === 'addTrackAbove') {
                    this.addTrackAbove(clickedTrackElement);
                } else if (action === 'addTrackBelow') {
                    this.addTrackBelow(clickedTrackElement);
                } else if (action === 'copyTrack') {
                    this.copyTrack(clickedTrackElement);
                } else if (action === 'pasteTrack') {
                    this.pasteTrack(clickedTrackElement);
                }
                newMenu.style.display = 'none';
            });
        });

        // 외부 클릭 시 닫기 로직은 전역 리스너가 처리
    }

    /**
     * 트랙 복사
     */
    copyTrack(trackElement) {
        const trackIndex = parseInt(trackElement.dataset.trackIndex, 10);
        if (isNaN(trackIndex)) return;

        const clipsOnTrack = Object.values(this.clips)
            .filter(clip => clip.trackIndex === trackIndex)
            .map(clip => JSON.parse(JSON.stringify(clip)));

        if (clipsOnTrack.length > 0) {
            this.trackClipboard = {
                clips: clipsOnTrack
            };
            console.log(`트랙 ${trackIndex} 복사됨: ${clipsOnTrack.length}개 클립`);
        } else {
            this.trackClipboard = null;
            console.log(`트랙 ${trackIndex}에 복사할 클립이 없습니다.`);
        }
    }

    /**
     * 트랙 붙여넣기
     */
    pasteTrack(trackElement) {
        if (!this.trackClipboard || !this.trackClipboard.clips) {
            console.log('붙여넣기할 트랙 데이터가 없습니다.');
            return;
        }

        const trackIndex = parseInt(trackElement.dataset.trackIndex, 10);
        if (isNaN(trackIndex)) return;

        this.isRestoringState = true;

        const newTrackIndex = trackIndex + 1;
        this.insertTrackAt(newTrackIndex);

        this.trackClipboard.clips.forEach(clipData => {
            const newClipData = { ...clipData };
            delete newClipData.id;
            newClipData.trackIndex = newTrackIndex;
            this.addClip(newClipData.type, newClipData);
        });

        this.isRestoringState = false;
        this.saveState('트랙 붙여넣기');
    }

    /**
     * 트랙 복제
     */
    duplicateTrack(trackElement) {
        this.isRestoringState = true; // 하위 함수의 saveState 호출 방지

        const trackIndex = parseInt(trackElement.dataset.trackIndex);
        this.addTrack();

        // 해당 트랙의 모든 클립 복제
        Object.values(this.clips).forEach(clip => {
            if (clip.trackIndex === trackIndex) {
                const newClipData = JSON.parse(JSON.stringify(clip));
                delete newClipData.id; // 기존 ID 제거
                newClipData.trackIndex = this.tracks.length - 1;
                this.addClip(clip.type, newClipData);
            }
        });

        this.isRestoringState = false;
        this.saveState('트랙 복제');
    }

    /**
     * 클립 데이터 업데이트
     */
    updateClipData(clipId, updates) {
        if (!this.clips[clipId]) return false;

        const clipData = this.clips[clipId];

        // 시간 관련 업데이트 시 충돌 검사
        if ('startTime' in updates || 'duration' in updates) {
            const newStartTime = updates.startTime !== undefined ? updates.startTime : clipData.startTime;
            const newDuration = updates.duration !== undefined ? updates.duration : clipData.duration;
            const newEndTime = newStartTime + newDuration;

            // 같은 트랙의 다른 클립과 충돌 검사
            const hasCollision = Object.values(this.clips).some(otherClip => {
                if (otherClip.id === clipId) return false;
                if (otherClip.trackIndex !== clipData.trackIndex) return false;

                const otherEndTime = otherClip.startTime + otherClip.duration;
                return !(newEndTime <= otherClip.startTime || newStartTime >= otherEndTime);
            });

            // 충돌이 있으면 업데이트하지 않고 false 반환
            if (hasCollision) {
                console.warn('클립이 다른 클립과 겹칩니다. 변경이 취소되었습니다.');
                return false;
            }
        }

        Object.assign(this.clips[clipId], updates);

        // 시간 관련 업데이트는 DOM에도 반영
        if ('startTime' in updates || 'duration' in updates) {
            const clipEl = document.getElementById(clipId);
            if (clipEl) {
                clipEl.style.left = (this.clips[clipId].startTime * this.pixelsPerSecond) + 'px';
                clipEl.style.width = (this.clips[clipId].duration * this.pixelsPerSecond) + 'px';
            }
        }

        // 내용 변경 시 클립 라벨 업데이트
        if ('content' in updates) {
            const clipEl = document.getElementById(clipId);
            if (clipEl) {
                const label = clipEl.querySelector('.clip-label');
                if (label) {
                    label.textContent = updates.content || '새 텍스트';
                }
            }
        }

        // 색상 변경 시 클립 배경색 업데이트
        if ('textColor' in updates || 'shapeColor' in updates || 'fillColor' in updates) {
            const clipEl = document.getElementById(clipId);
            if (clipEl) {
                this.updateClipAppearance(clipEl, this.clips[clipId]);
            }
        }

        // 레이어 패널 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }

        // 미리보기 즉시 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }

        return true;
    }

    /**
     * 선택된 클립 가져오기
     */
    getSelectedClip() {
        return this.selectedClipId ? this.clips[this.selectedClipId] : null;
    }

    /**
     * 모든 클립 데이터 가져오기
     */
    getAllClips() {
        return this.clips;
    }

    /**
     * 클립 복사 (다중 선택 지원)
     */
    copyClip(clipId) {
        // 다중 선택된 경우 모든 선택된 클립 복사
        if (this.selectedClipIds.length > 1) {
            const clipsToCopy = this.selectedClipIds.map(id => this.clips[id]).filter(clip => clip);
            this.clipboard = {
                type: 'copy',
                data: clipsToCopy.map(clip => JSON.parse(JSON.stringify(clip)))
            };
            console.log('다중 클립 복사됨:', clipsToCopy.length + '개');
        } else {
            // 단일 클립 복사
            const clip = this.clips[clipId];
            if (!clip) return;

            this.clipboard = {
                type: 'copy',
                data: JSON.parse(JSON.stringify(clip))
            };
            console.log('클립 복사됨:', clip.type);
        }
    }

    /**
     * 클립 잘라내기 (다중 선택 지원)
     */
    cutClip(clipId) {
        // 다중 선택된 경우 모든 선택된 클립 잘라내기
        if (this.selectedClipIds.length > 1) {
            const clipsToCut = this.selectedClipIds.map(id => this.clips[id]).filter(clip => clip);
            this.clipboard = {
                type: 'cut',
                data: clipsToCut.map(clip => JSON.parse(JSON.stringify(clip))),
                originalIds: [...this.selectedClipIds]
            };

            // 모든 선택된 클립 삭제
            const clipsToDelete = [...this.selectedClipIds];
            clipsToDelete.forEach(id => {
                const clipEl = document.getElementById(id);
                if (clipEl) {
                    clipEl.remove();
                }
                delete this.clips[id];
                this.hiddenClips.delete(id);
            });
            this.deselectAllClips();

            console.log('다중 클립 잘라내기:', clipsToCut.length + '개');
        } else {
            // 단일 클립 잘라내기
            const clip = this.clips[clipId];
            if (!clip) return;

            this.clipboard = {
                type: 'cut',
                data: JSON.parse(JSON.stringify(clip)),
                originalId: clipId
            };

            // 클립 삭제 (상태 저장은 여기서 한 번만)
            const clipEl = document.getElementById(clipId);
            if (clipEl) {
                clipEl.remove();
            }
            delete this.clips[clipId];
            this.hiddenClips.delete(clipId);

            if (this.selectedClipId === clipId) {
                this.deselectAllClips();
            }

            // 레이어 업데이트
            if (window.app && window.app.leftPanel) {
                window.app.leftPanel.updateLayers();
            }

            // 미리보기 즉시 업데이트
            if (window.app && window.app.previewSystem) {
                window.app.previewSystem.update(this.currentTime);
            }

            // 상태 저장 (잘라내기)
            this.saveState('클립 잘라내기');

            console.log('클립 잘라내기:', clip.type);
        }
    }

    /**
     * 클립 붙여넣기 (다중 클립 지원)
     */
    pasteClip(clickX) {
        if (!this.clipboard || !this.clipboard.data) return;

        // 붙여넣기 위치 계산 (클릭한 위치)
        let targetTime = clickX !== undefined && clickX !== null
            ? clickX / this.pixelsPerSecond
            : this.currentTime;

        // 중복 상태 저장 방지를 위해 플래그 설정
        this.isRestoringState = true;

        const clipsToPaste = Array.isArray(this.clipboard.data)
            ? this.clipboard.data.map(d => JSON.parse(JSON.stringify(d)))
            : [JSON.parse(JSON.stringify(this.clipboard.data))];

        if (clipsToPaste.length > 0) {
            const firstClipOriginalStart = clipsToPaste[0].startTime;
            let pasteStartTime = targetTime; // 그룹의 첫 클립이 시작될 시간

            let isOverlapping = true;
            let iterations = 0;
            const maxIterations = (Object.keys(this.clips).length + clipsToPaste.length) * 2;

            while (isOverlapping && iterations < maxIterations) {
                iterations++;
                isOverlapping = false;
                let maxObstacleEndTime = -1;

                const groupTimeOffset = pasteStartTime - firstClipOriginalStart;

                for (const clipData of clipsToPaste) {
                    const proposedStart = clipData.startTime + groupTimeOffset;
                    const proposedEnd = proposedStart + clipData.duration;

                    for (const existingClip of Object.values(this.clips)) {
                        if (existingClip.trackIndex !== clipData.trackIndex) continue;

                        const existingEnd = existingClip.startTime + existingClip.duration;
                        if (proposedStart < existingEnd && proposedEnd > existingClip.startTime) {
                            isOverlapping = true;
                            maxObstacleEndTime = Math.max(maxObstacleEndTime, existingEnd);
                        }
                    }
                }

                if (isOverlapping) {
                    // 충돌 발생 시, 그룹 내에서 가장 먼저 시작하는 클립을 장애물 바로 뒤로 이동
                    let earliestProposedStart = Infinity;
                    clipsToPaste.forEach(clip => {
                        earliestProposedStart = Math.min(earliestProposedStart, clip.startTime + groupTimeOffset);
                    });

                    const shiftAmount = maxObstacleEndTime - earliestProposedStart;
                    pasteStartTime += shiftAmount + 0.00001; // 부동소수점 오차 방지를 위한 epsilon
                }
            }

            if (iterations >= maxIterations) {
                console.warn("붙여넣기 위치를 찾지 못했습니다.");
            }

            // 최종 위치로 모든 클립 추가
            const finalTimeOffset = pasteStartTime - firstClipOriginalStart;
            clipsToPaste.forEach(clipData => {
                delete clipData.id;
                clipData.startTime = Math.max(0, clipData.startTime + finalTimeOffset);
                this.addClip(clipData.type, clipData);
            });

            const logMsg = Array.isArray(this.clipboard.data)
                ? `다중 클립 붙여넣기: ${clipsToPaste.length}개`
                : `클립 붙여넣기: ${clipsToPaste[0].type}`;
            console.log(logMsg);
        }

        // 플래그 해제 및 상태 저장
        this.isRestoringState = false;
        this.saveState('클립 붙여넣기');
    }

    /**
     * 겹치지 않는 시간 찾기
     */
    findNonOverlappingTime(targetTime, duration, trackIndex) {
        // 해당 트랙의 모든 클립 가져오기
        const clipsInTrack = Object.values(this.clips)
            .filter(clip => clip.trackIndex === trackIndex)
            .sort((a, b) => a.startTime - b.startTime);

        let candidateTime = targetTime;

        // 겹침 체크 및 조정
        for (let i = 0; i < clipsInTrack.length; i++) {
            const existingClip = clipsInTrack[i];
            const existingStart = existingClip.startTime;
            const existingEnd = existingClip.startTime + existingClip.duration;
            const candidateEnd = candidateTime + duration;

            // 겹치는지 확인
            if (candidateTime < existingEnd && candidateEnd > existingStart) {
                // 겹치면 기존 클립 뒤로 이동
                candidateTime = existingEnd;
            }
        }

        return Math.max(0, candidateTime);
    }

    /**
     * 클립 표시/숨기기 토글
     */
    toggleClipVisibility(clipId) {
        if (this.hiddenClips.has(clipId)) {
            this.hiddenClips.delete(clipId);
        } else {
            this.hiddenClips.add(clipId);
        }

        // 타임라인에서 클립 시각적 표시 업데이트
        const clipEl = document.getElementById(clipId);
        if (clipEl) {
            if (this.hiddenClips.has(clipId)) {
                clipEl.style.opacity = '0.3';
                clipEl.style.filter = 'grayscale(1)';
            } else {
                clipEl.style.opacity = '1';
                clipEl.style.filter = 'none';
            }
        }

        // 레이어 패널 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }

        // 미리보기 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }

        // 상태 저장 (표시/숨기기)
        this.saveState('클립 표시/숨기기');
    }

    /**
     * 클립이 숨겨져 있는지 확인
     */
    isClipHidden(clipId) {
        return this.hiddenClips.has(clipId);
    }

    /**
     * 클립 선택 상태 시각적 업데이트
     */
    updateClipSelection() {
        // 모든 클립에서 selected 클래스 제거
        document.querySelectorAll('.clip').forEach(el => el.classList.remove('selected'));

        // 선택된 클립들에 selected 클래스 추가
        this.selectedClipIds.forEach(clipId => {
            const clipEl = document.getElementById(clipId);
            if (clipEl) {
                clipEl.classList.add('selected');
            }
        });

        // 속성 패널 업데이트
        if (window.app && window.app.propertiesPanel) {
            if (this.selectedClipIds.length === 1) {
                window.app.propertiesPanel.showProperties(this.clips[this.selectedClipId]);
            } else if (this.selectedClipIds.length > 1) {
                window.app.propertiesPanel.showMultipleSelection(this.selectedClipIds.length);
            } else {
                window.app.propertiesPanel.hideProperties();
            }
        }

        // 레이어 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }

        // 미리보기(캔버스) 선택 상태 동기화
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.syncSelectionFromTimeline();
        }
    }

    /**
     * 현재 상태 저장 (Undo/Redo용)
     */
    saveState(description = '작업') {
        // 상태 복원 중에는 저장하지 않음 (무한 루프 방지)
        if (this.isRestoringState) return;

        // 현재 상태 스냅샷 생성
        const state = {
            description: description,
            timestamp: Date.now(),
            clips: JSON.parse(JSON.stringify(this.clips)), // Deep copy
            hiddenClips: Array.from(this.hiddenClips),
            totalDuration: this.totalDuration,
            timelineMode: this.timelineMode, // 타임라인 모드 저장
            cameraKeyframes: JSON.parse(JSON.stringify(this.cameraKeyframes)), // 카메라 키프레임 저장
            selectedKeyframeId: this.selectedKeyframeId // 선택된 키프레임 ID 저장
        };

        // 이전 상태와 동일하면 저장하지 않음 (불필요한 중복 저장 방지)
        if (this.history.length > 0) {
            const lastState = this.history[this.historyIndex];
            if (lastState &&
                JSON.stringify(state.clips) === JSON.stringify(lastState.clips) &&
                JSON.stringify(state.hiddenClips) === JSON.stringify(lastState.hiddenClips) &&
                state.totalDuration === lastState.totalDuration &&
                state.timelineMode === lastState.timelineMode &&
                JSON.stringify(state.cameraKeyframes) === JSON.stringify(lastState.cameraKeyframes) &&
                state.selectedKeyframeId === lastState.selectedKeyframeId) {
                console.log(`상태 저장 생략: 이전 상태와 동일함`);
                return;
            }
        }

        // 현재 위치 이후의 히스토리 제거 (새로운 분기 생성)
        if (this.historyIndex < this.history.length - 1) {
            this.history.splice(this.historyIndex + 1);
        }

        // 새 상태 추가
        this.history.push(state);

        // 최대 크기 제한
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        // Undo/Redo 버튼 상태 업데이트
        this.updateUndoRedoButtons();

        console.log(`상태 저장: ${description} (${this.historyIndex + 1}/${this.history.length})`);
    }

    /**
     * Undo (실행 취소)
     */
    undo() {
        if (this.historyIndex <= 0) {
            console.log('더 이상 취소할 수 없습니다.');
            return;
        }

        this.historyIndex--;
        const state = this.history[this.historyIndex];
        this.restoreState(state);
        this.updateUndoRedoButtons();

        console.log(`Undo: ${state.description} (${this.historyIndex + 1}/${this.history.length})`);
    }

    /**
     * Redo (다시 실행)
     */
    redo() {
        if (this.historyIndex >= this.history.length - 1) {
            console.log('더 이상 다시 실행할 수 없습니다.');
            return;
        }

        this.historyIndex++;
        const state = this.history[this.historyIndex];
        this.restoreState(state);
        this.updateUndoRedoButtons();

        console.log(`Redo: ${state.description} (${this.historyIndex + 1}/${this.history.length})`);
    }

    /**
     * 저장된 상태 복원
     */
    restoreState(state) {
        // 상태 복원 중임을 표시 (saveState 호출 방지)
        this.isRestoringState = true;

        // 이전 클립 ID 저장 (변경 감지용)
        const previousClipIds = new Set(Object.keys(this.clips));
        const previousClipsData = JSON.parse(JSON.stringify(this.clips));

        // 타임라인 모드 복원
        if (state.timelineMode && state.timelineMode !== this.timelineMode) {
            // 모드 전환 UI 업데이트
            const modeBtns = document.querySelectorAll('.timeline-mode-switch .mode-btn');
            modeBtns.forEach(btn => {
                if (btn.dataset.mode === state.timelineMode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            this.timelineMode = state.timelineMode;
        }

        // 모든 클립 DOM 제거
        this.tracks.forEach(track => {
            track.querySelectorAll('.clip').forEach(clipEl => clipEl.remove());
        });

        // 클립 데이터 복원
        this.clips = JSON.parse(JSON.stringify(state.clips));
        this.hiddenClips = new Set(state.hiddenClips);

        // 카메라 키프레임 복원
        this.cameraKeyframes = state.cameraKeyframes ? JSON.parse(JSON.stringify(state.cameraKeyframes)) : [];

        // 총 시간 복원
        this.totalDuration = state.totalDuration;
        this.updateRuler();
        this.updateTracksWidth();

        // 트랙 재구성 (모드에 따라)
        const tracksContainer = document.getElementById('tracksContainer');
        tracksContainer.innerHTML = '';
        this.tracks = [];
        const addTrackBtn = document.getElementById('addTrackBtn');
        const cameraLabelsContainer = document.getElementById('cameraLabelsContainer');
        cameraLabelsContainer.innerHTML = '';

        if (this.timelineMode === 'camera') {
            cameraLabelsContainer.style.display = 'flex';
            // 카메라 모드 트랙 생성 (4개)
            const cameraProperties = [
                { name: 'X', icon: 'fa-solid fa-arrows-left-right', color: '#ff4444' },
                { name: 'Y', icon: 'fa-solid fa-arrows-up-down', color: '#44ff44' },
                { name: '크기', icon: 'fa-solid fa-expand', color: '#4444ff' },
                { name: '방향', icon: 'fa-solid fa-rotate', color: '#ffaa00' }
            ];

            cameraProperties.forEach((prop, index) => {
                const track = document.createElement('div');
                track.className = 'track camera-timeline-track';
                track.dataset.cameraProperty = prop.name.toLowerCase();
                track.style.width = (this.totalDuration * this.pixelsPerSecond) + 'px';

                // 카메라 트랙 우클릭 이벤트 (빈 곳 클릭 시 키프레임 추가 메뉴)
                track.addEventListener('contextmenu', (e) => {
                    // 키프레임 마커나 그래프 캔버스가 아닌 빈 곳 클릭일 때만
                    if (!e.target.closest('.camera-keyframe-marker') && !e.target.closest('.camera-graph-canvas')) {
                        e.preventDefault();
                        this.showCameraTrackContextMenu(e, track);
                    }
                });

                // 레이블 생성
                const label = document.createElement('div');
                label.className = 'camera-label-item';
                label.style.borderLeft = `3px solid ${prop.color}`;
                label.style.height = '100px'; // 트랙 높이와 일치
                label.style.minHeight = '100px'; // 최소 높이도 설정
                label.style.boxSizing = 'border-box'; // 패딩이 높이에 포함되도록
                label.innerHTML = `<i class="${prop.icon}" style="color: ${prop.color};"></i> ${prop.name}`;
                cameraLabelsContainer.appendChild(label);

                tracksContainer.appendChild(track);
                this.tracks.push(track);
            });

            // 트랙 추가 버튼 숨기기
            if (addTrackBtn) {
                addTrackBtn.style.visibility = 'hidden';
                addTrackBtn.style.pointerEvents = 'none';
            }
        } else {
            cameraLabelsContainer.style.display = 'none';
            const requiredTrackCount = this.calculateRequiredTrackCount(this.clips);
            this.rebuildClipTracks(requiredTrackCount);
        }

        // 클립 DOM 재생성 (카메라 모드에서는 생략)
        if (this.timelineMode !== 'camera') {
            Object.values(this.clips).forEach(clipData => {
                if (clipData.trackIndex < this.tracks.length) {
                    const clipEl = this.createClipElement(clipData);
                    this.tracks[clipData.trackIndex].appendChild(clipEl);

                    // 숨김 상태 적용
                    if (this.hiddenClips.has(clipData.id)) {
                        clipEl.style.opacity = '0.3';
                        clipEl.style.filter = 'grayscale(1)';
                    }
                }
            });
        }

        // 카메라 키프레임 렌더링
        this.renderCameraKeyframes();

        // 선택된 카메라 키프레임 복원 (카메라 모드일 때)
        if (this.timelineMode === 'camera' && state.selectedKeyframeId) {
            const keyframe = this.cameraKeyframes.find(kf => kf.id === state.selectedKeyframeId);
            if (keyframe) {
                this.selectKeyframe(keyframe);
            } else {
                // 키프레임이 삭제되었으면 선택 해제
                this.selectKeyframe(null);
            }
        } else if (this.timelineMode === 'camera') {
            // 카메라 모드인데 선택된 키프레임이 없으면 속성 패널 숨기기
            this.selectKeyframe(null);
        }

        // 변경된 클립 찾기 및 자동 선택 (클립 모드일 때만)
        if (this.timelineMode === 'clip') {
            const changedClipIds = this.findChangedClips(previousClipsData, this.clips, previousClipIds);

            if (changedClipIds.length > 0) {
                // 변경된 클립들을 자동 선택
                this.selectedClipIds = changedClipIds;
                this.selectedClipId = changedClipIds[changedClipIds.length - 1];

                // 시각적 선택 표시
                changedClipIds.forEach(clipId => {
                    const clipEl = document.getElementById(clipId);
                    if (clipEl) {
                        clipEl.classList.add('selected');
                    }
                });

                // 속성 패널 업데이트
                if (window.app && window.app.propertiesPanel) {
                    if (this.selectedClipIds.length === 1) {
                        window.app.propertiesPanel.showProperties(this.clips[this.selectedClipId]);
                    } else {
                        window.app.propertiesPanel.showMultipleSelection(this.selectedClipIds.length);
                    }
                }
            } else {
                // 변경된 클립이 없으면 선택 해제
                this.deselectAllClips();
            }
        }

        // 레이어 패널 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }

        // PropertiesPanel 업데이트 (카메라 모드일 때)
        if (this.timelineMode === 'camera' && window.app && window.app.propertiesPanel) {
            window.app.propertiesPanel.updateCameraProperties(this.currentTime);
        }

        // 미리보기 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }

        // 상태 복원 완료
        this.isRestoringState = false;
    }

    /**
     * 변경된 클립 찾기 (Undo/Redo 후 자동 선택용)
     */
    findChangedClips(previousClips, currentClips, previousClipIds) {
        const changedClipIds = [];
        const currentClipIds = new Set(Object.keys(currentClips));

        // 새로 추가된 클립
        for (const clipId of currentClipIds) {
            if (!previousClipIds.has(clipId)) {
                changedClipIds.push(clipId);
            }
        }

        // 삭제된 클립은 선택할 수 없으므로 무시

        // 수정된 클립 (속성이나 위치가 변경된 클립)
        for (const clipId of currentClipIds) {
            if (previousClipIds.has(clipId)) {
                const prevClip = previousClips[clipId];
                const currClip = currentClips[clipId];

                // 주요 속성 비교 (위치, 크기, 트랙 등)
                if (prevClip && currClip) {
                    const hasChanged =
                        prevClip.startTime !== currClip.startTime ||
                        prevClip.duration !== currClip.duration ||
                        prevClip.trackIndex !== currClip.trackIndex ||
                        JSON.stringify(prevClip.animation) !== JSON.stringify(currClip.animation) ||
                        prevClip.content !== currClip.content ||
                        prevClip.textColor !== currClip.textColor ||
                        prevClip.shapeColor !== currClip.shapeColor ||
                        prevClip.fillColor !== currClip.fillColor;

                    if (hasChanged && !changedClipIds.includes(clipId)) {
                        changedClipIds.push(clipId);
                    }
                }
            }
        }

        return changedClipIds;
    }

    /**
     * 카메라 키프레임 컨텍스트 메뉴 설정
     */
    setupCameraKeyframeContextMenu() {
        // 카메라 트랙 메뉴
        const trackMenu = document.getElementById('cameraTrackContextMenu');
        if (trackMenu) {
            trackMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.context-menu-item');
                if (!item) return;
                
                const action = item.dataset.action;
                const track = trackMenu.dataset.track;
                const clickX = parseFloat(trackMenu.dataset.clickX || '0');
                
                this.handleCameraTrackContextAction(action, track, clickX);
                this.hideAllContextMenus();
            });
        }
        
        // 카메라 키프레임 메뉴
        const keyframeMenu = document.getElementById('cameraKeyframeContextMenu');
        if (keyframeMenu) {
            keyframeMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.context-menu-item');
                if (!item) return;
                
                const action = item.dataset.action;
                const keyframeId = keyframeMenu.dataset.keyframeId;
                
                this.handleCameraKeyframeContextAction(action, keyframeId);
                this.hideAllContextMenus();
            });
        }
    }

    /**
     * 카메라 트랙 컨텍스트 메뉴 표시
     */
    showCameraTrackContextMenu(e, track) {
        this.hideAllContextMenus();
        
        const menu = document.getElementById('cameraTrackContextMenu');
        if (!menu) return;
        
        // 트랙 위치에서 시간 계산
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left + this.timelineBody.scrollLeft;
        const clickTime = clickX / this.pixelsPerSecond;
        
        menu.dataset.track = track.dataset.cameraProperty || '';
        menu.dataset.clickX = clickTime;
        
        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
        
        // 붙여넣기 메뉴 항목 활성화/비활성화
        const pasteItem = menu.querySelector('[data-action="pasteKeyframe"]');
        if (pasteItem) {
            if (this.keyframeClipboard) {
                pasteItem.style.opacity = '1';
                pasteItem.style.pointerEvents = 'auto';
            } else {
                pasteItem.style.opacity = '0.5';
                pasteItem.style.pointerEvents = 'none';
            }
        }
    }

    /**
     * 카메라 키프레임 컨텍스트 메뉴 표시
     */
    showCameraKeyframeContextMenu(e, keyframe) {
        this.hideAllContextMenus();
        
        // 키프레임 선택
        if (this.selectedKeyframeId !== keyframe.id) {
            this.selectKeyframe(keyframe);
        }
        
        const menu = document.getElementById('cameraKeyframeContextMenu');
        if (!menu) return;
        
        menu.dataset.keyframeId = keyframe.id;
        
        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
    }

    /**
     * 카메라 트랙 컨텍스트 메뉴 액션 처리
     */
    handleCameraTrackContextAction(action, trackProperty, clickTime) {
        switch (action) {
            case 'addKeyframeLinear':
                this.addCameraKeyframe('linear', clickTime);
                break;
            case 'addKeyframeEaseIn':
                this.addCameraKeyframe('easeIn', clickTime);
                break;
            case 'addKeyframeEaseOut':
                this.addCameraKeyframe('easeOut', clickTime);
                break;
            case 'addKeyframeEaseInOut':
                this.addCameraKeyframe('easeInOut', clickTime);
                break;
            case 'pasteKeyframe':
                this.pasteCameraKeyframe(clickTime);
                break;
        }
    }

    /**
     * 카메라 키프레임 컨텍스트 메뉴 액션 처리
     */
    handleCameraKeyframeContextAction(action, keyframeId) {
        switch (action) {
            case 'copyKeyframe':
                this.copyCameraKeyframe(keyframeId);
                break;
            case 'deleteKeyframe':
                this.deleteCameraKeyframe(keyframeId);
                break;
        }
    }

    /**
     * 카메라 키프레임 복사
     */
    copyCameraKeyframe(keyframeId) {
        const keyframe = this.cameraKeyframes.find(kf => kf.id === keyframeId);
        if (!keyframe) return;
        
        this.keyframeClipboard = JSON.parse(JSON.stringify(keyframe));
        console.log('카메라 키프레임 복사됨');
    }

    /**
     * 카메라 키프레임 붙여넣기
     */
    pasteCameraKeyframe(pasteTime) {
        if (!this.keyframeClipboard) return;
        
        const newKeyframe = JSON.parse(JSON.stringify(this.keyframeClipboard));
        newKeyframe.id = 'kf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        newKeyframe.time = Math.max(0, Math.min(this.totalDuration, pasteTime));
        
        this.cameraKeyframes.push(newKeyframe);
        this.cameraKeyframes.sort((a, b) => a.time - b.time);
        
        this.saveState('카메라 키프레임 붙여넣기');
        this.renderCameraKeyframes();
        
        // 레이어 목록 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }
        
        // PropertiesPanel 업데이트
        if (window.app && window.app.propertiesPanel) {
            window.app.propertiesPanel.updateCameraProperties(this.currentTime);
        }
        
        // 프리뷰 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }
    }

    /**
     * 카메라 키프레임 삭제
     */
    deleteCameraKeyframe(keyframeId) {
        const index = this.cameraKeyframes.findIndex(kf => kf.id === keyframeId);
        if (index === -1) return;
        
        this.cameraKeyframes.splice(index, 1);
        
        // 선택 해제
        if (this.selectedKeyframeId === keyframeId) {
            this.selectKeyframe(null);
        }
        
        this.saveState('카메라 키프레임 삭제');
        this.renderCameraKeyframes();
        
        // 레이어 목록 업데이트
        if (window.app && window.app.leftPanel) {
            window.app.leftPanel.updateLayers();
        }
        
        // PropertiesPanel 업데이트
        if (window.app && window.app.propertiesPanel) {
            window.app.propertiesPanel.updateCameraProperties(this.currentTime);
        }
        
        // 프리뷰 업데이트
        if (window.app && window.app.previewSystem) {
            window.app.previewSystem.update(this.currentTime);
        }
    }

    /**
     * 키보드 이벤트 설정
     */
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // Delete 키로 선택된 키프레임 삭제 (카메라 모드일 때)
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.timelineMode === 'camera' && this.selectedKeyframeId) {
                    e.preventDefault();
                    this.deleteCameraKeyframe(this.selectedKeyframeId);
                }
            }
        });
    }

    /**
     * Undo/Redo 버튼 상태 업데이트
     */
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        if (undoBtn) {
            undoBtn.disabled = this.historyIndex <= 0;
            undoBtn.style.opacity = this.historyIndex <= 0 ? '0.5' : '1';
        }

        if (redoBtn) {
            redoBtn.disabled = this.historyIndex >= this.history.length - 1;
            redoBtn.style.opacity = this.historyIndex >= this.history.length - 1 ? '0.5' : '1';
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Timeline;
}
