/**
 * Animation Graph Component
 * 애니메이션 그래프 시각화 및 드래그 편집
 */

class AnimationGraph {
    constructor(canvasId, property, propertiesPanel) {
        this.canvas = document.getElementById(canvasId);
        this.property = property;
        this.propertiesPanel = propertiesPanel;
        this.ctx = null;
        this.isDragging = false;
        this.dragTarget = null; // 'start' or 'end'
        this.hasSavedBeforeState = false; // 드래그 전 상태 저장 여부

        // 렌더링 최적화
        this.pendingDraw = false;
        this.drawAnimData = null;

        // Easing 함수들
        this.easingFunctions = {
            linear: (t) => t,
            easeIn: (t) => t * t,
            easeOut: (t) => t * (2 - t),
            easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        };

        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));

        // Document-level 이벤트로 캔버스 밖에서도 드래그 유지
        this.boundMouseMove = (e) => this.handleMouseMove(e);
        this.boundMouseUp = (e) => this.handleMouseUp(e);

        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
    }

    handleMouseDown(e) {
        const clip = this.propertiesPanel.currentClip;
        if (!clip || !clip.animation || !clip.animation[this.property]) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;

        // 클릭 위치가 왼쪽 절반이면 시작점, 오른쪽 절반이면 끝점
        const midX = this.canvas.width / 2;

        if (x < midX) {
            this.isDragging = true;
            this.dragTarget = 'start';
        } else {
            this.isDragging = true;
            this.dragTarget = 'end';
        }

        // 현재 값을 초기값으로 저장 (드래그 전 값)
        const anim = clip.animation[this.property];
        this.initialValue = this.dragTarget === 'start' ? anim.start : anim.end; // 초기값 저장
        this.currentValue = this.initialValue;
        this.lastMouseY = e.clientY;
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.dragTarget) return;

        const clip = this.propertiesPanel.currentClip;
        if (!clip || !clip.animation || !clip.animation[this.property]) return;

        // 이전 마우스 위치와의 차이 계산
        const deltaY = this.lastMouseY - e.clientY; // 위로 = 양수
        this.lastMouseY = e.clientY;

        // 값 업데이트 (1픽셀 = 1 단위)
        this.currentValue += deltaY;
        let roundedValue = Math.round(this.currentValue);

        // 크기(scale)와 투명도(opacity)는 음수 불가
        if (this.property === 'scale' || this.property === 'opacity') {
            roundedValue = Math.max(0, roundedValue);
            this.currentValue = roundedValue; // 음수로 가지 않도록 currentValue도 업데이트
        }

        // 투명도는 100 이하로 제한
        if (this.property === 'opacity') {
            roundedValue = Math.min(100, roundedValue);
            this.currentValue = roundedValue; // 100 넘지 않도록 currentValue도 업데이트
        }

        const anim = clip.animation[this.property];

        // 애니메이션 데이터 업데이트
        if (this.dragTarget === 'start') {
            anim.start = roundedValue;
            document.getElementById(`${this.property}Start`).value = roundedValue;
        } else {
            anim.end = roundedValue;
            document.getElementById(`${this.property}End`).value = roundedValue;
        }

        // Timeline 업데이트 (참조를 통해 직접 수정하므로 실제로는 이미 반영됨)
        if (window.app && window.app.timeline) {
            window.app.timeline.updateClipData(clip.id, { animation: clip.animation });
        }

        // 그래프 다시 그리기 (requestAnimationFrame으로 최적화)
        this.scheduleDraw(clip.animation[this.property]);
    }

    handleMouseUp(e) {
        if (!this.isDragging) return;

        const clip = this.propertiesPanel.currentClip;
        let valueChanged = false;

        // 클릭만 했고 드래그 안 했으면 - 클릭한 위치로 값 설정
        if (clip && clip.animation && clip.animation[this.property]) {
            // 클릭한 위치 계산
            const rect = this.canvas.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const padding = 10;
            const height = this.canvas.height - padding * 2;
            const minValue = this.getMinValue();
            const maxValue = this.getMaxValue();
            const valueRange = maxValue - minValue;

            const normalizedY = (height - (y - padding)) / height;
            let clickValue = minValue + normalizedY * valueRange;
            let roundedValue = Math.round(clickValue);

            if (this.property === 'scale' || this.property === 'opacity') {
                roundedValue = Math.max(0, roundedValue);
            }
            if (this.property === 'opacity') {
                roundedValue = Math.min(100, roundedValue);
            }

            // 값 설정
            const anim = clip.animation[this.property];

            if (this.dragTarget === 'start') {
                anim.start = roundedValue;
                document.getElementById(`${this.property}Start`).value = roundedValue;
            } else {
                anim.end = roundedValue;
                document.getElementById(`${this.property}End`).value = roundedValue;
            }

            // 값이 변경되었는지 확인
            if (this.initialValue !== undefined && this.initialValue !== roundedValue) {
                valueChanged = true;
            }

            window.app.timeline.updateClipData(clip.id, { animation: clip.animation });
            this.scheduleDraw(clip.animation[this.property]);
        }

        // 값이 변경되었으면 상태 저장
        if (valueChanged && window.app && window.app.timeline) {
            window.app.timeline.saveState('그래프 애니메이션 변경');
        }

        this.isDragging = false;
        this.dragTarget = null;
        this.lastMouseY = null;
        this.currentValue = null;
        this.initialValue = null;
    }

    getMinValue() {
        const clip = this.propertiesPanel.currentClip;
        if (!clip || !clip.animation || !clip.animation[this.property]) {
            return 0;
        }

        const anim = clip.animation[this.property];
        const { start, end } = anim;

        // 시작값과 끝값 중 최소값을 기준으로 범위 설정
        const minVal = Math.min(start, end);
        const maxVal = Math.max(start, end);
        const range = Math.max(Math.abs(maxVal - minVal), 100);

        // 최소값을 약간 아래로 여유 확보 (범위의 20%)
        const padding = range * 0.2;
        let calculatedMin = Math.floor(minVal - padding);

        // 크기와 투명도는 0 미만으로 내려갈 수 없음
        if (this.property === 'scale' || this.property === 'opacity') {
            calculatedMin = Math.max(0, calculatedMin);
        }

        return calculatedMin;
    }

    getMaxValue() {
        const clip = this.propertiesPanel.currentClip;
        if (!clip || !clip.animation || !clip.animation[this.property]) {
            return 100;
        }

        const anim = clip.animation[this.property];
        const { start, end } = anim;

        // 시작값과 끝값 중 최대값을 기준으로 범위 설정
        const minVal = Math.min(start, end);
        const maxVal = Math.max(start, end);
        const range = Math.max(Math.abs(maxVal - minVal), 100);

        // 최대값을 약간 위로 여유 확보 (범위의 20%)
        const padding = range * 0.2;
        let calculatedMax = Math.ceil(maxVal + padding);

        // 투명도는 100 이하로 제한
        if (this.property === 'opacity') {
            calculatedMax = Math.min(100, calculatedMax);
        }

        return calculatedMax;
    }

    /**
     * requestAnimationFrame을 사용한 draw 스케줄링
     */
    scheduleDraw(animData) {
        if (!animData) return;

        this.drawAnimData = animData;

        if (!this.pendingDraw) {
            this.pendingDraw = true;
            requestAnimationFrame(() => {
                this.draw(this.drawAnimData);
                this.pendingDraw = false;
            });
        }
    }

    draw(animData) {
        if (!this.ctx || !animData) return;

        const { start, end, easing } = animData;
        const padding = 10;
        const width = this.canvas.width - padding * 2;
        const height = this.canvas.height - padding * 2;

        // 캔버스 초기화
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 동적 범위 계산
        const minValue = this.getMinValue();
        const maxValue = this.getMaxValue();
        const valueRange = maxValue - minValue;

        // 배경 그리드 및 범위 레이블
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);
        this.ctx.fillStyle = '#555';
        this.ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        this.ctx.textAlign = 'left';

        // 가로선과 범위 값
        for (let i = 0; i <= 4; i++) {
            const y = padding + (height / 4) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(padding + width, y);
            this.ctx.stroke();

            // 범위 값 표시 (위에서 아래로)
            const rangeValue = Math.round(maxValue - (valueRange / 4) * i);
            this.ctx.fillText(rangeValue.toString(), 2, y + 3);
        }

        this.ctx.setLineDash([]);

        // Easing 곡선 그리기
        this.ctx.strokeStyle = '#4a9eff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        const easingFunc = this.easingFunctions[easing] || this.easingFunctions.linear;

        for (let i = 0; i <= 50; i++) {
            const t = i / 50;
            const easedT = easingFunc(t);

            const value = start + (end - start) * easedT;
            const normalizedValue = (value - minValue) / valueRange;

            const x = padding + t * width;
            const y = height - normalizedValue * height + padding;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();

        // 시작점과 끝점 표시
        const startNormalized = (start - minValue) / valueRange;
        const endNormalized = (end - minValue) / valueRange;

        const startY = height - startNormalized * height + padding;
        const endY = height - endNormalized * height + padding;

        // 시작점
        this.ctx.fillStyle = '#4a9eff';
        this.ctx.beginPath();
        this.ctx.arc(padding, startY, 5, 0, Math.PI * 2);
        this.ctx.fill();

        // 끝점
        this.ctx.beginPath();
        this.ctx.arc(padding + width, endY, 5, 0, Math.PI * 2);
        this.ctx.fill();

        // 값 표시
        this.ctx.fillStyle = '#888';
        this.ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(start.toString(), padding + 8, startY - 8);
        this.ctx.textAlign = 'right';
        this.ctx.fillText(end.toString(), padding + width - 8, endY - 8);
    }

    update(animData) {
        this.scheduleDraw(animData);
    }
}
