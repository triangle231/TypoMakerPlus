/**
 * Properties Panel Component
 * 속성 패널 관리 및 클립 속성 편집
 */

class PropertiesPanel {
    constructor() {
        this.currentClip = null;
        this.isUpdating = false; // 업데이트 중복 방지
        this.animationGraphs = {};
        this.currentCameraKeyframeId = null; // 카메라 키프레임 편집용

        this.init();
    }

    init() {
        this.noSelectionMessage = document.getElementById('noSelectionMessage');
        this.propertiesFields = document.getElementById('propertiesFields');

        // 속성 섹션들
        this.textProperties = document.querySelector('.text-properties');
        this.shapeProperties = document.querySelector('.shape-properties');
        this.imageProperties = document.querySelector('.image-properties');
        this.fillProperties = document.querySelector('.fill-properties');
        this.transformProperties = document.querySelector('.transform-properties');

        // 애니메이션 그래프 생성
        this.animationGraphs = {
            posX: new AnimationGraph('posXGraph', 'posX', this),
            posY: new AnimationGraph('posYGraph', 'posY', this),
            scale: new AnimationGraph('scaleGraph', 'scale', this),
            rotation: new AnimationGraph('rotationGraph', 'rotation', this),
            opacity: new AnimationGraph('opacityGraph', 'opacity', this)
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // 공통 속성
        this.addInputListener('startTime', (value, shouldSave) => this.updateClip({ startTime: parseFloat(value) }, shouldSave));
        this.addInputListener('endTime', (value, shouldSave) => {
            const duration = parseFloat(value) - this.currentClip.startTime;
            this.updateClip({ duration: Math.max(0.1, duration) }, shouldSave);
        });

        // 텍스트 속성
        this.addInputListener('textContent', (value, shouldSave) => this.updateClip({ content: value }, shouldSave));
        this.addInputListener('fontFamily', (value, shouldSave) => this.updateClip({ fontFamily: value }, shouldSave));
        this.addInputListener('fontSize', (value, shouldSave) => this.updateClip({ fontSize: parseInt(value) }, shouldSave));
        this.addInputListener('textColor', (value, shouldSave) => this.updateClip({ textColor: value }, shouldSave));
        this.addInputListener('bgColor', (value, shouldSave) => this.updateClip({ bgColor: value }, shouldSave));
        this.addInputListener('bgTransparent', (value, shouldSave) => {
            this.updateClip({ bgTransparent: value }, shouldSave);
            const bgColorInput = document.getElementById('bgColor');
            if (bgColorInput) {
                bgColorInput.disabled = value;
            }
        }, 'checked');

        // 텍스트 스타일 버튼
        ['bold', 'italic', 'underline'].forEach(style => {
            const btn = document.getElementById(style + 'Btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    if (this.currentClip) {
                        const newValue = !this.currentClip[style];
                        this.updateClip({ [style]: newValue }, true); // 즉시 저장
                        btn.classList.toggle('active', newValue);
                    }
                });
            }
        });

        // 도형 속성
        this.addInputListener('shapeColor', (value, shouldSave) => this.updateClip({ shapeColor: value }, shouldSave));
        this.addInputListener('shapeSize', (value, shouldSave) => this.updateClip({ shapeSize: parseInt(value) }, shouldSave));

        // 이미지 속성 (파일명은 읽기 전용)

        // 채우기 속성
        this.addInputListener('fillColor', (value, shouldSave) => this.updateClip({ fillColor: value }, shouldSave));

        // 애니메이션 속성
        const animProps = ['posX', 'posY', 'scale', 'rotation', 'opacity'];
        animProps.forEach(prop => {
            this.addInputListener(`${prop}Start`, (value, shouldSave) => {
                if (!this.currentClip.animation) this.currentClip.animation = {};
                if (!this.currentClip.animation[prop]) this.currentClip.animation[prop] = {};
                this.updateClip({
                    animation: {
                        ...this.currentClip.animation,
                        [prop]: { ...this.currentClip.animation[prop], start: parseFloat(value) || 0 }
                    }
                }, shouldSave);
                // 그래프 업데이트
                if (this.animationGraphs[prop] && this.currentClip.animation[prop]) {
                    this.animationGraphs[prop].update(this.currentClip.animation[prop]);
                }
            });

            this.addInputListener(`${prop}End`, (value, shouldSave) => {
                if (!this.currentClip.animation) this.currentClip.animation = {};
                if (!this.currentClip.animation[prop]) this.currentClip.animation[prop] = {};
                this.updateClip({
                    animation: {
                        ...this.currentClip.animation,
                        [prop]: { ...this.currentClip.animation[prop], end: parseFloat(value) || 0 }
                    }
                }, shouldSave);
                // 그래프 업데이트
                if (this.animationGraphs[prop] && this.currentClip.animation[prop]) {
                    this.animationGraphs[prop].update(this.currentClip.animation[prop]);
                }
            });

            this.addInputListener(`${prop}Easing`, (value, shouldSave) => {
                if (!this.currentClip.animation) this.currentClip.animation = {};
                if (!this.currentClip.animation[prop]) this.currentClip.animation[prop] = {};
                this.updateClip({
                    animation: {
                        ...this.currentClip.animation,
                        [prop]: { ...this.currentClip.animation[prop], easing: value }
                    }
                }, shouldSave);
                // 그래프 업데이트
                if (this.animationGraphs[prop] && this.currentClip.animation[prop]) {
                    this.animationGraphs[prop].update(this.currentClip.animation[prop]);
                }
            });
        });
    }

    /**
     * 입력 리스너 추가 헬퍼
     */
    addInputListener(id, callback, property = 'value') {
        const element = document.getElementById(id);
        if (element) {
            // 색상 입력은 input과 change 둘 다 처리
            if (element.type === 'color') {
                element.addEventListener('input', (e) => {
                    if (!this.isUpdating && this.currentClip) {
                        callback(e.target[property], false); // 실시간 업데이트, 저장 안 함
                    }
                });
                element.addEventListener('change', (e) => {
                    if (!this.isUpdating && this.currentClip) {
                        callback(e.target[property], true); // 변경 완료 시 저장
                    }
                });
            } else if (element.type === 'checkbox') {
                // 체크박스는 change 이벤트만
                element.addEventListener('change', (e) => {
                    if (!this.isUpdating && this.currentClip) {
                        callback(e.target[property], true); // 즉시 저장
                    }
                });
            } else {
                // 텍스트/숫자 입력은 input과 change 둘 다
                element.addEventListener('input', (e) => {
                    if (!this.isUpdating && this.currentClip) {
                        callback(e.target[property], false); // 실시간 업데이트, 저장 안 함
                    }
                });
                element.addEventListener('change', (e) => {
                    if (!this.isUpdating && this.currentClip) {
                        callback(e.target[property], true); // 변경 완료 시 저장
                    }
                });
            }
        }
    }

    /**
     * 클립 속성 업데이트
     */
    updateClip(updates, shouldSave = false) {
        if (!this.currentClip || !window.app || !window.app.timeline) return;

        // 업데이트 시도 (충돌 시 false 반환)
        const success = window.app.timeline.updateClipData(this.currentClip.id, updates);

        // 업데이트 실패 시 (충돌 발생)
        if (!success) {
            // 입력값을 원래대로 되돌림
            this.isUpdating = true;
            if ('startTime' in updates || 'duration' in updates) {
                this.setInputValue('startTime', this.currentClip.startTime.toFixed(2));
                this.setInputValue('endTime', (this.currentClip.startTime + this.currentClip.duration).toFixed(2));
            }
            this.isUpdating = false;
            return;
        }

        // 현재 클립 데이터 갱신
        Object.assign(this.currentClip, updates);

        // 변경 완료 시에만 상태 저장
        if (shouldSave) {
            window.app.timeline.saveState('속성 변경');
        }

        // 미리보기 업데이트
        if (window.app.previewSystem) {
            window.app.previewSystem.update(window.app.timeline.currentTime);
        }
    }

    /**
     * 속성 표시
     */
    showProperties(clip) {
        if (!clip) {
            this.hideProperties();
            return;
        }

        // 카메라 키프레임 전용 섹션 숨김
        const camContainer = document.getElementById('cameraKeyframeProperties');
        if (camContainer) camContainer.remove();
        // 타이밍 섹션 복원
        const startTimeEl = document.getElementById('startTime');
        const endTimeEl = document.getElementById('endTime');
        const timingSection = startTimeEl?.closest('.property-section') || endTimeEl?.closest('.property-section');
        if (timingSection) timingSection.style.display = 'block';

        this.currentClip = clip;
        this.isUpdating = true;

        // 속성 탭으로 자동 전환
        const propertiesTabBtn = document.querySelector('.tab-btn[data-tab="properties"]');
        if (propertiesTabBtn && !propertiesTabBtn.classList.contains('active')) {
            propertiesTabBtn.click();
        }

        // 메시지 숨기고 필드 표시
        if (this.noSelectionMessage) this.noSelectionMessage.style.display = 'none';
        if (this.propertiesFields) this.propertiesFields.style.display = 'block';

        // 모든 타입별 속성 숨기기
        if (this.textProperties) this.textProperties.style.display = 'none';
        if (this.shapeProperties) this.shapeProperties.style.display = 'none';
        if (this.imageProperties) this.imageProperties.style.display = 'none';
        if (this.fillProperties) this.fillProperties.style.display = 'none';

        // 공통 속성 업데이트
        this.setInputValue('startTime', clip.startTime.toFixed(2));
        this.setInputValue('endTime', (clip.startTime + clip.duration).toFixed(2));

        // 타입별 속성 표시 및 업데이트
        switch (clip.type) {
            case 'text':
                if (this.textProperties) this.textProperties.style.display = 'block';
                this.updateTextProperties(clip);
                break;
            case 'rectangle':
            case 'circle':
            case 'triangle':
            case 'star':
            case 'heart':
            case 'hexagon':
            case 'diamond':
            case 'pentagon':
            case 'arrow':
            case 'speechBubble':
            case 'cross':
                if (this.shapeProperties) this.shapeProperties.style.display = 'block';
                this.updateShapeProperties(clip);
                break;
            case 'image':
                if (this.imageProperties) this.imageProperties.style.display = 'block';
                this.updateImageProperties(clip);
                break;
            case 'fill':
                if (this.fillProperties) this.fillProperties.style.display = 'block';
                this.updateFillProperties(clip);
                break;
        }

        // 변형 속성은 fill 제외 모두 표시
        if (this.transformProperties) {
            this.transformProperties.style.display = clip.type === 'fill' ? 'none' : 'block';
            if (clip.type !== 'fill') {
                this.updateTransformProperties(clip);
            }
        }

        // 투명도는 텍스트 타입에서 숨김
        const opacityGroup = document.getElementById('opacity')?.closest('.setting-group');
        if (opacityGroup) {
            opacityGroup.style.display = clip.type === 'text' ? 'none' : 'block';
        }

        this.isUpdating = false;
    }

    /**
     * 텍스트 속성 업데이트
     */
    updateTextProperties(clip) {
        this.setInputValue('textContent', clip.content || '');
        this.setInputValue('fontFamily', clip.fontFamily || '나눔고딕');
        this.setInputValue('fontSize', clip.fontSize || 32);
        this.setInputValue('textColor', clip.textColor || '#ffffff');
        this.setInputValue('bgColor', clip.bgColor || '#000000');
        this.setInputValue('bgTransparent', clip.bgTransparent, 'checked');

        const bgColorInput = document.getElementById('bgColor');
        if (bgColorInput) {
            bgColorInput.disabled = clip.bgTransparent;
        }

        // 스타일 버튼
        ['bold', 'italic', 'underline'].forEach(style => {
            const btn = document.getElementById(style + 'Btn');
            if (btn) {
                btn.classList.toggle('active', clip[style] || false);
            }
        });
    }

    /**
     * 도형 속성 업데이트
     */
    updateShapeProperties(clip) {
        this.setInputValue('shapeColor', clip.shapeColor || '#FF0000');
        this.setInputValue('shapeSize', clip.shapeSize || 100);
    }

    /**
     * 이미지 속성 업데이트
     */
    updateImageProperties(clip) {
        const fileName = (clip.imageFile && clip.imageFile.name) || clip.imageFileName || '';
        this.setInputValue('imageName', fileName);
    }

    /**
     * 채우기 속성 업데이트
     */
    updateFillProperties(clip) {
        this.setInputValue('fillColor', clip.fillColor || '#0000FF');
    }

    /**
     * 변형 속성 업데이트
     */
    updateTransformProperties(clip) {
        if (!clip.animation) return;

        // 각 애니메이션 속성 업데이트
        const props = ['posX', 'posY', 'scale', 'rotation', 'opacity'];
        props.forEach(prop => {
            if (clip.animation[prop]) {
                this.setInputValue(`${prop}Start`, clip.animation[prop].start);
                this.setInputValue(`${prop}End`, clip.animation[prop].end);
                this.setInputValue(`${prop}Easing`, clip.animation[prop].easing);

                // 그래프 업데이트
                if (this.animationGraphs[prop]) {
                    this.animationGraphs[prop].update(clip.animation[prop]);
                }
            }
        });
    }

    /**
     * 입력 값 설정 헬퍼
     */
    setInputValue(id, value, property = 'value') {
        const element = document.getElementById(id);
        if (element) {
            element[property] = value;
        }
    }

    /**
     * 속성 숨기기
     */
    hideProperties() {
        this.currentClip = null;

        if (this.noSelectionMessage) {
            this.noSelectionMessage.style.display = 'block';
            // 원래 내용으로 복원
            const currentBgColor = document.getElementById('previewBgColor')?.value || '#000000';
            const currentVolume = document.getElementById('bgVolumeControl')?.value || '0.5';
            const volumePercent = Math.round(parseFloat(currentVolume) * 100);
            const musicFileName = document.getElementById('bgMusicFileName')?.textContent || '파일 선택';

            this.noSelectionMessage.innerHTML = `
                <div class="property-section">
                    <h3>기본 속성</h3>
                    <div class="setting-group">
                        <label>
                            <i class="fa-solid fa-fill-drip"></i>
                            배경색
                        </label>
                        <input type="color" id="previewBgColor" value="${currentBgColor}">
                    </div>
                    <div class="setting-group">
                        <label>
                            <i class="fa-solid fa-music"></i>
                            배경음악
                        </label>
                        <button class="file-select-btn" id="bgMusicAdd">
                            <i class="fa-solid fa-folder-open"></i>
                            <span id="bgMusicFileName">${musicFileName}</span>
                        </button>
                    </div>
                    <div class="setting-group">
                        <label>
                            <i class="fa-solid fa-volume-up"></i>
                            볼륨
                        </label>
                        <div class="volume-control-container">
                            <input type="range" id="bgVolumeControl" min="0" max="1" step="0.01" value="${currentVolume}">
                            <span class="volume-value">${volumePercent}%</span>
                        </div>
                    </div>
                </div>
            `;
            // 이벤트 리스너 재등록 필요
            if (window.app && window.app.previewSystem) {
                window.app.previewSystem.setupEventListeners();
            }
        }
        if (this.propertiesFields) this.propertiesFields.style.display = 'none';
    }

    /**
     * 다중 선택 표시
     */
    showMultipleSelection(count) {
        this.currentClip = null;

        if (this.noSelectionMessage) {
            this.noSelectionMessage.style.display = 'block';
            this.noSelectionMessage.innerHTML = `
                <div class="property-section" style="text-align: center; padding: 40px 0;">
                    <i class="fa-solid fa-check-double" style="font-size: 2.5rem; color: #555; margin-bottom: 12px; display: block;"></i>
                    <p style="color: #888; margin-bottom: 8px;">${count}개의 클립이 선택됨</p>
                    <p style="font-size: 0.85rem; color: #666;">단일 클립을 선택하면 속성을 편집할 수 있습니다</p>
                </div>
            `;
        }
        if (this.propertiesFields) this.propertiesFields.style.display = 'none';
    }

    /**
     * 시간 입력 업데이트 (타임라인에서 드래그할 때 호출)
     */
    updateTimeInputs(clip) {
        if (!this.currentClip || this.currentClip.id !== clip.id) return;

        this.isUpdating = true;
        this.setInputValue('startTime', clip.startTime.toFixed(2));
        this.setInputValue('endTime', (clip.startTime + clip.duration).toFixed(2));
        this.isUpdating = false;
    }

    /**
     * 카메라 키프레임 속성 숨기기
     */
    hideCameraKeyframeProperties() {
        this.currentCameraKeyframeId = null;
        
        // 카메라 키프레임 전용 섹션 제거
        const camContainer = document.getElementById('cameraKeyframeProperties');
        if (camContainer) camContainer.remove();
        
        // 타이밍 섹션 복원
        const startTimeEl = document.getElementById('startTime');
        const endTimeEl = document.getElementById('endTime');
        const timingSection = startTimeEl?.closest('.property-section') || endTimeEl?.closest('.property-section');
        if (timingSection) timingSection.style.display = 'block';
        
        // 속성 패널 숨기기
        this.hideProperties();
    }

    /**
     * 카메라 속성 업데이트 (시간에 따른 카메라 상태 반영)
     */
    updateCameraProperties(time) {
        // 현재 선택된 카메라 키프레임이 있으면 해당 키프레임의 속성을 업데이트
        if (this.currentCameraKeyframeId && window.app && window.app.timeline) {
            const timeline = window.app.timeline;
            const keyframe = timeline.cameraKeyframes.find(kf => kf.id === this.currentCameraKeyframeId);
            
            if (keyframe) {
                // 키프레임이 여전히 존재하면 속성 패널 업데이트
                this.showCameraKeyframeProperties(keyframe);
            } else {
                // 키프레임이 삭제되었으면 속성 패널 숨김
                this.hideCameraKeyframeProperties();
            }
        } else if (window.app && window.app.timeline && window.app.timeline.timelineMode === 'camera') {
            // 선택된 키프레임이 없는 카메라 모드면 속성 패널 숨김
            this.hideCameraKeyframeProperties();
        }
    }

    // 카메라 키프레임 속성 표시/편집
    showCameraKeyframeProperties(keyframe) {
        if (!keyframe) return;
        this.currentClip = null; // 클립 편집 상태 해제
        this.currentCameraKeyframeId = keyframe.id;
        this.isUpdating = true;

        // 속성 탭으로 전환
        const propertiesTabBtn = document.querySelector('.tab-btn[data-tab="properties"]');
        if (propertiesTabBtn && !propertiesTabBtn.classList.contains('active')) {
            propertiesTabBtn.click();
        }

        // 공용 타이밍 섹션 숨김 (startTime/endTime 포함 섹션)
        const startTimeEl = document.getElementById('startTime');
        const endTimeEl = document.getElementById('endTime');
        const timingSection = startTimeEl?.closest('.property-section') || endTimeEl?.closest('.property-section');
        if (timingSection) timingSection.style.display = 'none';

        // 패널 영역 표시 준비
        if (this.noSelectionMessage) this.noSelectionMessage.style.display = 'none';
        if (this.propertiesFields) this.propertiesFields.style.display = 'block';

        // 모든 타입별 섹션 숨김
        if (this.textProperties) this.textProperties.style.display = 'none';
        if (this.shapeProperties) this.shapeProperties.style.display = 'none';
        if (this.imageProperties) this.imageProperties.style.display = 'none';
        if (this.fillProperties) this.fillProperties.style.display = 'none';
        if (this.transformProperties) this.transformProperties.style.display = 'none';

        // 카메라 키프레임 전용 섹션 렌더링 (동적)
        const containerId = 'cameraKeyframeProperties';
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'camera-keyframe-properties';
            this.propertiesFields.prepend(container);
        }

        container.innerHTML = `
            <div class="property-section">
                <h3>카메라 키프레임</h3>
                <div class="setting-group">
                    <label><i class="fa-solid fa-clock"></i> 시간</label>
                    <input type="number" id="camKfTime" step="0.01" min="0" value="${keyframe.time.toFixed(2)}">
                </div>
                <div class="setting-group">
                    <label><i class="fa-solid fa-wave-square"></i> Easing</label>
                    <select id="camKfEasing">
                        <option value="linear" ${keyframe.easing==='linear'?'selected':''}>Linear</option>
                        <option value="easeIn" ${keyframe.easing==='easeIn'?'selected':''}>Ease In</option>
                        <option value="easeOut" ${keyframe.easing==='easeOut'?'selected':''}>Ease Out</option>
                        <option value="easeInOut" ${keyframe.easing==='easeInOut'?'selected':''}>Ease In-Out</option>
                    </select>
                </div>
                <div class="setting-row" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
                    <div class="setting-group">
                        <label><i class="fa-solid fa-x"></i></label>
                        <input type="number" id="camKfX" step="1" value="${keyframe.values?.x ?? 0}">
                    </div>
                    <div class="setting-group">
                        <label><i class="fa-solid fa-y"></i></label>
                        <input type="number" id="camKfY" step="1" value="${keyframe.values?.y ?? 0}">
                    </div>
                    <div class="setting-group">
                        <label><i class="fa-solid fa-up-right-and-down-left-from-center"></i> 크기(%)</label>
                        <input type="number" id="camKfScale" step="1" min="0" value="${keyframe.values?.scale ?? 100}">
                    </div>
                    <div class="setting-group">
                        <label><i class="fa-solid fa-rotate"></i> 방향(도)</label>
                        <input type="number" id="camKfRotation" step="1" value="${keyframe.values?.rotation ?? 0}">
                    </div>
                </div>
            </div>
        `;

        // 리스너 바인딩
        const tl = window.app?.timeline;
        const kfId = keyframe.id;
        const bind = (selector, handler, event='input') => {
            const el = document.getElementById(selector);
            if (!el) return;
            el.addEventListener(event, (e) => {
                if (!tl) return;
                handler(e);
            });
        };

        bind('camKfTime', (e) => {
            tl.updateCameraKeyframe(kfId, { time: parseFloat(e.target.value) }, false);
        });
        bind('camKfTime', (e) => {
            tl.updateCameraKeyframe(kfId, { time: parseFloat(e.target.value) }, true);
        }, 'change');

        bind('camKfEasing', (e) => {
            tl.updateCameraKeyframe(kfId, { easing: e.target.value }, true);
        }, 'change');

        bind('camKfX', (e) => {
            const v = parseFloat(e.target.value) || 0;
            tl.updateCameraKeyframe(kfId, { values: { ...keyframe.values, x: v } }, false);
        });
        bind('camKfX', (e) => {
            const v = parseFloat(e.target.value) || 0;
            tl.updateCameraKeyframe(kfId, { values: { ...keyframe.values, x: v } }, true);
        }, 'change');

        bind('camKfY', (e) => {
            const v = parseFloat(e.target.value) || 0;
            tl.updateCameraKeyframe(kfId, { values: { ...keyframe.values, y: v } }, false);
        });
        bind('camKfY', (e) => {
            const v = parseFloat(e.target.value) || 0;
            tl.updateCameraKeyframe(kfId, { values: { ...keyframe.values, y: v } }, true);
        }, 'change');

        bind('camKfScale', (e) => {
            const v = Math.max(0, parseFloat(e.target.value) || 0);
            tl.updateCameraKeyframe(kfId, { values: { ...keyframe.values, scale: v } }, false);
        });
        bind('camKfScale', (e) => {
            const v = Math.max(0, parseFloat(e.target.value) || 0);
            tl.updateCameraKeyframe(kfId, { values: { ...keyframe.values, scale: v } }, true);
        }, 'change');

        bind('camKfRotation', (e) => {
            const v = parseFloat(e.target.value) || 0;
            tl.updateCameraKeyframe(kfId, { values: { ...keyframe.values, rotation: v } }, false);
        });
        bind('camKfRotation', (e) => {
            const v = parseFloat(e.target.value) || 0;
            tl.updateCameraKeyframe(kfId, { values: { ...keyframe.values, rotation: v } }, true);
        }, 'change');

        this.isUpdating = false;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PropertiesPanel;
}
