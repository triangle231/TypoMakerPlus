/**
 * Typography Maker - Main Application
 * 메인 애플리케이션 진입점
 */

(function () {
    'use strict';

    // 전역 앱 객체
    window.app = {
        timeline: null,
        previewSystem: null,
        propertiesPanel: null,
        leftPanel: null,
        isPlaying: false,
        bgAudio: null,
        animationFrameId: null,
        lastFrameTime: 0,
        previewIdleIntervalId: null
    };

    /**
     * 앱 초기화
     */
    function initApp() {
        // 컴포넌트 초기화
        app.timeline = new Timeline();
        app.previewSystem = new PreviewSystem();
        app.propertiesPanel = new PropertiesPanel();
        app.leftPanel = new LeftPanel();

        // 이벤트 리스너 설정
        setupEventListeners();

        // 초기 렌더링
        app.previewSystem.update(0);
        startIdlePreviewLoop();
        updateTimeDisplay();
        app.leftPanel.updateLayers();
    }

    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 플레이어 컨트롤
        document.getElementById('playPauseBtn')?.addEventListener('click', togglePlayPause);
        document.getElementById('stopBtn')?.addEventListener('click', stop);

        // 타임라인 버튼
        document.getElementById('addTrackBtn')?.addEventListener('click', () => {
            app.timeline.addTrack();
        });

        // Undo/Redo 버튼
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            if (app.timeline) {
                app.timeline.undo();
            }
        });
        document.getElementById('redoBtn')?.addEventListener('click', () => {
            if (app.timeline) {
                app.timeline.redo();
            }
        });

        // 줌 버튼
        document.getElementById('zoomInBtn')?.addEventListener('click', () => {
            if (app.timeline) {
                app.timeline.zoom(1.2);
                updateZoomLevel();
            }
        });
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
            if (app.timeline) {
                app.timeline.zoom(0.8);
                updateZoomLevel();
            }
        });

        // 이미지 업로드
        document.getElementById('imageInput')?.addEventListener('change', handleImageUpload);

        // 배경 음악 (이벤트 위임 사용 - 동적으로 생성되는 요소 대응)
        document.addEventListener('click', (e) => {
            if (e.target.closest('#bgMusicAdd')) {
                document.getElementById('bgMusicInput')?.click();
            }
        });
        document.getElementById('bgMusicInput')?.addEventListener('change', handleBgMusicUpload);

        // 볼륨 컨트롤 (이벤트 위임)
        document.addEventListener('input', (e) => {
            if (e.target.id === 'bgVolumeControl') {
                if (app.bgAudio) {
                    app.bgAudio.volume = parseFloat(e.target.value);
                }
                // 볼륨 표시 업데이트
                const volumeValue = document.querySelector('.volume-value');
                if (volumeValue) {
                    const percent = Math.round(parseFloat(e.target.value) * 100);
                    volumeValue.textContent = percent + '%';
                }
            }
        });

        // 내보내기/불러오기
        document.getElementById('exportEntry')?.addEventListener('click', showExportModal);
        document.getElementById('importEntry')?.addEventListener('click', showImportModal);
        document.getElementById('downloadProjectBtn')?.addEventListener('click', downloadProject);
        document.getElementById('downloadEntBtn')?.addEventListener('click', downloadEntFile);
        document.getElementById('selectFileBtn')?.addEventListener('click', () => {
            document.getElementById('importFileInput')?.click();
        });
        document.getElementById('importFileInput')?.addEventListener('change', handleImportFile);

        // 모달 닫기
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // 모달 외부 클릭
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // 키보드 단축키
        document.addEventListener('keydown', handleKeyboard);

        // 패널 리사이저
        setupPanelResizer();
    }

    /**
     * 편집 모드에서 일정 주기로 프리뷰 업데이트
     */
    function startIdlePreviewLoop() {
        stopIdlePreviewLoop();

        if (!app.previewSystem) return;

        app.previewIdleIntervalId = setInterval(() => {
            if (app.isPlaying) return;
            if (!app.timeline || !app.previewSystem) return;
            app.previewSystem.update(app.timeline.currentTime);
        }, 200);
    }

    function stopIdlePreviewLoop() {
        if (app.previewIdleIntervalId) {
            clearInterval(app.previewIdleIntervalId);
            app.previewIdleIntervalId = null;
        }
    }

    /**
     * 이미지 업로드 처리
     */
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            if (app.leftPanel) {
                app.leftPanel.addImage(file, event.target.result);
            }
        };
        reader.readAsDataURL(file);

        // 입력 초기화
        e.target.value = '';
    }

    /**
     * 줌 레벨 업데이트
     */
    function updateZoomLevel() {
        if (!app.timeline) return;

        const zoomLevel = document.querySelector('.zoom-level');
        if (zoomLevel) {
            const percentage = Math.round((app.timeline.pixelsPerSecond / 50) * 100);
            zoomLevel.textContent = percentage + '%';
        }
    }

    /**
     * 배경 음악 업로드 처리
     */
    function handleBgMusicUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const fileNameElements = document.querySelectorAll('#bgMusicFileName');
        fileNameElements.forEach(element => {
            element.textContent = file.name;
        });

        if (app.bgAudio) {
            app.bgAudio.pause();
            URL.revokeObjectURL(app.bgAudio.src);
        }

        app.bgAudio = new Audio();
        app.bgAudio.src = URL.createObjectURL(file);
        app.bgAudio.loop = false;

        const volumeControl = document.getElementById('bgVolumeControl');
        if (volumeControl) {
            app.bgAudio.volume = parseFloat(volumeControl.value);
        }

        // 입력 초기화
        e.target.value = '';
    }

    /**
     * 재생/일시정지 토글
     */
    function togglePlayPause() {
        if (app.isPlaying) {
            pause();
        } else {
            play();
        }
    }

    /**
     * 재생
     */
    function play() {
        if (!app.isPlaying) {
            app.isPlaying = true;
            app.lastFrameTime = performance.now();
            stopIdlePreviewLoop();

            // 버튼 아이콘 변경
            const btn = document.getElementById('playPauseBtn');
            if (btn) {
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = 'fa-solid fa-pause';
                }
            }

            if (app.bgAudio && app.timeline) {
                app.bgAudio.currentTime = app.timeline.currentTime;
                app.bgAudio.play().catch(e => console.warn('Audio play failed:', e));
            }

            requestAnimationFrame(playbackLoop);
        }
    }

    /**
     * 일시정지
     */
    function pause() {
        app.isPlaying = false;

        // 버튼 아이콘 변경
        const btn = document.getElementById('playPauseBtn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = 'fa-solid fa-play';
            }
        }

        if (app.bgAudio) {
            app.bgAudio.pause();
        }

        startIdlePreviewLoop();
    }

    /**
     * 정지
     */
    function stop() {
        app.isPlaying = false;

        // 버튼 아이콘 변경
        const btn = document.getElementById('playPauseBtn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = 'fa-solid fa-play';
            }
        }

        if (app.timeline) {
            app.timeline.setCurrentTime(0);
        }
        if (app.bgAudio) {
            app.bgAudio.pause();
            app.bgAudio.currentTime = 0;
        }
        if (app.previewSystem) {
            app.previewSystem.update(0);
        }
        startIdlePreviewLoop();
        updateTimeDisplay();
    }

    /**
     * 재생 루프
     */
    function playbackLoop(timestamp) {
        if (!app.isPlaying) return;

        const deltaTime = (timestamp - app.lastFrameTime) / 1000;
        app.lastFrameTime = timestamp;

        if (app.timeline) {
            const newTime = app.timeline.currentTime + deltaTime;

            if (newTime >= app.timeline.totalDuration) {
                // 끝에 도달
                app.timeline.setCurrentTime(app.timeline.totalDuration);
                pause();
            } else {
                app.timeline.setCurrentTime(newTime);
            }

            if (app.previewSystem) {
                app.previewSystem.update(app.timeline.currentTime);
            }

            updateTimeDisplay();
        }

        if (app.isPlaying) {
            requestAnimationFrame(playbackLoop);
        }
    }

    /**
     * 시간 표시 업데이트
     */
    function updateTimeDisplay() {
        const currentTimeLabel = document.getElementById('currentTimeLabel');
        const totalDurationLabel = document.getElementById('totalDurationLabel');

        if (currentTimeLabel && app.timeline) {
            currentTimeLabel.textContent = app.timeline.currentTime.toFixed(2) + 's';
        }

        if (totalDurationLabel && app.timeline) {
            totalDurationLabel.textContent = app.timeline.totalDuration.toFixed(2) + 's';
        }
    }

    /**
     * 시간 변경 콜백 (타임라인에서 호출)
     */
    app.onTimeChange = function (time) {
        if (app.previewSystem) {
            app.previewSystem.update(time);
        }
        updateTimeDisplay();

        if (app.bgAudio && app.isPlaying) {
            const audioDiff = Math.abs(app.bgAudio.currentTime - time);
            if (audioDiff > 0.1) {
                app.bgAudio.currentTime = time;
            }
        }
    };

    /**
     * 키보드 단축키
     */
    function handleKeyboard(e) {
        // 입력 필드에서는 단축키 무시
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Space: 재생/일시정지
        if (e.code === 'Space') {
            e.preventDefault();
            if (app.isPlaying) {
                pause();
            } else {
                play();
            }
        }

        // Delete: 선택된 클립 삭제 (다중 선택 지원)
        if (e.code === 'Delete' && app.timeline) {
            if (app.timeline.selectedClipIds.length > 0) {
                // 다중 선택된 클립이 있으면 첫 번째 클립 ID 전달
                // deleteClip 함수가 내부적으로 selectedClipIds를 확인하여 모두 삭제
                app.timeline.deleteClip(app.timeline.selectedClipIds[0]);
            }
        }

        // Ctrl+Z: Undo
        if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey && app.timeline) {
            e.preventDefault();
            app.timeline.undo();
        }

        // Ctrl+Y 또는 Ctrl+Shift+Z: Redo
        if ((e.ctrlKey && e.code === 'KeyY') || (e.ctrlKey && e.shiftKey && e.code === 'KeyZ')) {
            e.preventDefault();
            if (app.timeline) {
                app.timeline.redo();
            }
        }

        // Ctrl+C: 복사
        if (e.ctrlKey && e.code === 'KeyC' && app.timeline) {
            e.preventDefault();
            if (app.timeline.selectedClipIds.length > 0) {
                app.timeline.copyClip(app.timeline.selectedClipIds[0]);
            }
        }

        // Ctrl+V: 붙여넣기
        if (e.ctrlKey && e.code === 'KeyV' && app.timeline) {
            e.preventDefault();
            app.timeline.pasteClip();
        }
    }

    /**
     * 패널 리사이저 설정
     */
    function setupPanelResizer() {
        const leftPanel = document.querySelector('.left-panel');
        const resizerY = document.getElementById('resizer-y');

        const centerArea = document.querySelector('.center-area');
        const timelineArea = document.querySelector('.timeline-area');
        const resizerX = document.getElementById('resizer-x');

        if (!resizerY || !resizerX || !leftPanel || !centerArea || !timelineArea) return;

        const resizerHeight = resizerX.offsetHeight || 2;
        const minTimelineHeight = 200;
        const minPreviewHeight = 200;

        const clampTimelineHeight = () => {
            const centerAreaRect = centerArea.getBoundingClientRect();
            const currentTimelineHeight = parseFloat(getComputedStyle(centerArea).getPropertyValue('--timeline-height')) || timelineArea.getBoundingClientRect().height;
            const maxTimelineHeight = Math.max(minTimelineHeight, centerAreaRect.height - resizerHeight - minPreviewHeight);
            if (currentTimelineHeight > maxTimelineHeight) {
                centerArea.style.setProperty('--timeline-height', `${maxTimelineHeight}px`);
            }
        };

        window.addEventListener('resize', clampTimelineHeight);
        clampTimelineHeight();

        // 세로 리사이저 (Left Panel)
        resizerY.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.body.style.cursor = 'col-resize';

            const mouseMoveHandler = (e) => {
                const leftPanelWidth = e.clientX;
                if (leftPanelWidth > 250 && leftPanelWidth < 500) { // 최소/최대 너비 제한
                    leftPanel.style.width = `${leftPanelWidth}px`;
                }
            };

            const mouseUpHandler = () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                document.body.style.cursor = '';
            };

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });

        // 가로 리사이저 (Timeline)
        resizerX.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.body.style.cursor = 'row-resize';

            const mouseMoveHandler = (e) => {
                const centerAreaRect = centerArea.getBoundingClientRect();
                let timelineHeight = centerAreaRect.bottom - e.clientY;
                const maxTimelineHeight = Math.max(minTimelineHeight, centerAreaRect.height - resizerHeight - minPreviewHeight);

                timelineHeight = Math.max(minTimelineHeight, Math.min(timelineHeight, maxTimelineHeight));

                centerArea.style.setProperty('--timeline-height', `${timelineHeight}px`);
            };

            const mouseUpHandler = () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                document.body.style.cursor = '';
            };

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
    }

    /**
     * 내보내기 모달 표시
     */
    function showExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 불러오기 모달 표시
     */
    function showImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 프로젝트 다운로드
     */
    function downloadProject() {
        if (!app.timeline) return;

        const allClips = app.timeline.getAllClips();

        // 숨겨진 클립 제외
        const visibleClips = {};
        Object.keys(allClips).forEach(clipId => {
            if (!app.timeline.isClipHidden(clipId)) {
                visibleClips[clipId] = allClips[clipId];
            }
        });

        const projectData = {
            version: '1.0',
            totalDuration: app.timeline.totalDuration,
            clips: visibleClips,
            bgMusic: app.bgAudio ? {
                fileName: document.getElementById('bgMusicFileName')?.textContent || '',
                volume: app.bgAudio.volume
            } : null,
            // 타임라인 모드 및 카메라 키프레임 저장
            timelineMode: app.timeline.timelineMode,
            cameraKeyframes: Array.isArray(app.timeline.cameraKeyframes) ? JSON.parse(JSON.stringify(app.timeline.cameraKeyframes)) : []
        };

        // 이미지 파일은 base64로 인코딩
        const clipsWithImages = Object.values(projectData.clips).filter(clip => clip.type === 'image');
        const promises = clipsWithImages.map(clip => {
            return new Promise((resolve) => {
                const file = clip.imageFile;
                if (file instanceof Blob) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        clip.imageData = e.target.result;
                        delete clip.imageFile;
                        resolve();
                    };
                    reader.onerror = () => resolve();
                    reader.readAsDataURL(file);
                } else if (typeof file === 'string' && file.startsWith('data:')) {
                    clip.imageData = file;
                    delete clip.imageFile;
                    resolve();
                } else {
                    resolve();
                }
            });
        });

        Promise.all(promises).then(() => {
            const json = JSON.stringify(projectData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'typography-project.json';
            a.click();
            URL.revokeObjectURL(url);

            const modal = document.getElementById('exportModal');
            if (modal) modal.style.display = 'none';
        });
    }

    /**
     * 엔트리 프로젝트 내보내기 (클립 데이터를 project.json 리스트 형식으로 변환)
     * 텍스트와 도형은 모두 이미지로 처리
     * @param {Object} clipImageFileNameMap - 클립 ID와 이미지 파일명 매핑
     * @returns {Object} 리스트 배열들을 포함한 객체
     */
    function exportEntryProject(clipImageFileNameMap = {}) {
        if (!app.timeline) {
            return {
                e_type: [],
                e_sTime: [],
                e_eTime: [],
                e_fileName: [],
                e_x_ease: [],
                e_x_start: [],
                e_x_end: [],
                e_y_ease: [],
                e_y_start: [],
                e_y_end: [],
                e_sc_ease: [],
                e_sc_start: [],
                e_sc_end: [],
                e_dr_ease: [],
                e_dr_start: [],
                e_dr_end: [],
                e_tr_ease: [],
                e_tr_start: [],
                e_tr_end: []
            };
        }

        const lists = {
            e_type: [],
            e_sTime: [],
            e_eTime: [],
            e_fileName: [],
            e_x_ease: [],
            e_x_start: [],
            e_x_end: [],
            e_y_ease: [],
            e_y_start: [],
            e_y_end: [],
            e_sc_ease: [],
            e_sc_start: [],
            e_sc_end: [],
            e_dr_ease: [],
            e_dr_start: [],
            e_dr_end: [],
            e_tr_ease: [],
            e_tr_start: [],
            e_tr_end: []
        };

        const allClips = app.timeline.getAllClips();
        const clipsArray = Object.values(allClips)
            .filter(clip => !app.timeline.isClipHidden(clip.id))
            .sort((a, b) => {
                // 먼저 트랙 순서로 정렬 (trackIndex가 큰 것부터 = 아래 트랙부터)
                if (b.trackIndex !== a.trackIndex) {
                    return b.trackIndex - a.trackIndex;
                }
                // 같은 트랙 내에서는 시작 시간 순서로 정렬
                return a.startTime - b.startTime;
            });

        clipsArray.forEach(clip => {
            const endTime = clip.startTime + clip.duration;

            // 애니메이션 데이터 변환
            const getEasing = (anim) => {
                if (!anim) return 'linear';
                const easing = anim.easing || 'linear';
                // easing 값을 엔트리 형식으로 변환 (linear만 소문자, 나머지는 첫 글자 대문자)
                if (easing === 'easeInOut') return 'InOut';
                if (easing === 'easeIn') return 'In';
                if (easing === 'easeOut') return 'Out';
                if (easing === 'linear') return 'linear';
                // 기타: OutIn 등 (필요시 추가)
                return 'linear';
            };
            const getStartValue = (anim) => anim?.start !== undefined ? anim.start : 0;
            const getEndValue = (anim) => anim?.end !== undefined ? anim.end : 0;

            if (clip.type === 'fill') {
                // 채우기 클립
                lists.e_type.push('fill');
                lists.e_sTime.push(Math.round(clip.startTime * 100000) / 100000);
                lists.e_eTime.push(Math.round(endTime * 100000) / 100000);
                lists.e_fileName.push(clip.fillColor || '#ffffff');
                // 나머지는 더미 값 0
                lists.e_x_ease.push('linear');
                lists.e_x_start.push(0);
                lists.e_x_end.push(0);
                lists.e_y_ease.push('linear');
                lists.e_y_start.push(0);
                lists.e_y_end.push(0);
                lists.e_sc_ease.push('linear');
                lists.e_sc_start.push(0);
                lists.e_sc_end.push(0);
                lists.e_dr_ease.push('linear');
                lists.e_dr_start.push(0);
                lists.e_dr_end.push(0);
                lists.e_tr_ease.push('linear');
                lists.e_tr_start.push(0);
                lists.e_tr_end.push(0);
            } else if (clip.type === 'image' || clip.type === 'text' ||
                       ['rectangle', 'circle', 'triangle', 'star', 'heart', 'hexagon', 'diamond', 'pentagon', 'arrow', 'speechBubble', 'cross'].includes(clip.type)) {
                // 모든 다른 클립은 이미지로 렌더링
                const anim = clip.animation || {};

                // 이미지 파일명 가져오기
                let imageFileName = '';
                if (clipImageFileNameMap[clip.id]) {
                    imageFileName = clipImageFileNameMap[clip.id];
                } else if (clip.type === 'image') {
                    imageFileName = (clip.imageFile && clip.imageFile.name) || clip.imageFileName || 'image.png';
                } else {
                    imageFileName = `${clip.type}_${clip.id}.png`;
                }

                lists.e_type.push('normal');
                lists.e_sTime.push(Math.round(clip.startTime * 100000) / 100000);
                lists.e_eTime.push(Math.round(endTime * 100000) / 100000);
                lists.e_fileName.push(imageFileName);

                // X 위치
                lists.e_x_ease.push(getEasing(anim.posX));
                lists.e_x_start.push(getStartValue(anim.posX));
                lists.e_x_end.push(getEndValue(anim.posX));

                // Y 위치
                lists.e_y_ease.push(getEasing(anim.posY));
                lists.e_y_start.push(getStartValue(anim.posY));
                lists.e_y_end.push(getEndValue(anim.posY));

                // 크기 - 100 그대로 저장
                lists.e_sc_ease.push(getEasing(anim.scale));
                lists.e_sc_start.push(getStartValue(anim.scale));
                lists.e_sc_end.push(getEndValue(anim.scale));

                // 회전
                lists.e_dr_ease.push(getEasing(anim.rotation));
                lists.e_dr_start.push(getStartValue(anim.rotation));
                lists.e_dr_end.push(getEndValue(anim.rotation));

                // 투명도 (기본값)
                lists.e_tr_ease.push(getEasing(anim.opacity) || 'linear');
                lists.e_tr_start.push(getStartValue(anim.opacity) !== undefined ? getStartValue(anim.opacity) : 100);
                lists.e_tr_end.push(getEndValue(anim.opacity) !== undefined ? getEndValue(anim.opacity) : 100);
            }
        });

        return lists;
    }

    /**
     * 카메라 키프레임 데이터 내보내기 (project.json 리스트 형식으로)
     * @returns {Object} 카메라 키프레임 리스트 배열들을 포함한 객체
     */
    function exportCameraKeyframes() {
        const lists = {
            c_time: [],
            c_ease: [],
            c_x: [],
            c_y: [],
            c_scale: [],
            c_dir: []
        };

        // easing 값 변환 함수 (linear만 소문자, 나머지는 첫 글자 대문자)
        const convertEasing = (easing) => {
            if (!easing || easing === 'linear') return 'linear';
            if (easing === 'easeInOut') return 'InOut';
            if (easing === 'easeIn') return 'In';
            if (easing === 'easeOut') return 'Out';
            // 이미 변환된 형식인 경우 그대로 반환
            if (easing === 'InOut' || easing === 'In' || easing === 'Out') return easing;
            return 'linear';
        };

        if (!app.timeline || !Array.isArray(app.timeline.cameraKeyframes)) {
            // 기본 키프레임 (0초)
            lists.c_time.push(0);
            lists.c_ease.push('linear');
            lists.c_x.push(0);
            lists.c_y.push(0);
            lists.c_scale.push(100);
            lists.c_dir.push(0);
            return lists;
        }

        const sortedKeyframes = app.timeline.cameraKeyframes.slice().sort((a, b) => a.time - b.time);

        if (sortedKeyframes.length === 0) {
            // 기본 키프레임 (0초)
            lists.c_time.push(0);
            lists.c_ease.push('linear');
            lists.c_x.push(0);
            lists.c_y.push(0);
            lists.c_scale.push(100);
            lists.c_dir.push(0);
        } else {
            // 0초 키프레임이 없으면 기본값으로 0초 추가
            if (sortedKeyframes[0].time !== 0) {
                lists.c_time.push(0);
                lists.c_ease.push('linear');
                lists.c_x.push(0);
                lists.c_y.push(0);
                lists.c_scale.push(100);
                lists.c_dir.push(0);
            }

            // 모든 키프레임 추가 (0초 키프레임 있으면 그것도 포함)
            sortedKeyframes.forEach(kf => {
                lists.c_time.push(kf.time ?? 0);
                lists.c_ease.push(convertEasing(kf.easing));
                lists.c_x.push(kf.values?.x ?? 0);
                lists.c_y.push(kf.values?.y ?? 0);
                lists.c_scale.push(kf.values?.scale ?? 100);
                lists.c_dir.push(kf.values?.rotation ?? 0);
            });
        }

        return lists;
    }

    /**
     * .ent 파일 다운로드
     */
    async function downloadEntFile() {
        if (!app.timeline) return;
        
        // 로딩 오버레이 생성
        let overlay = document.createElement('div');
        overlay.id = 'exportLoading';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.8)';
        overlay.style.zIndex = '10000';
        overlay.style.color = '#fff';
        overlay.style.fontSize = '24px';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        let loadingTextEl = document.createElement('div');
        loadingTextEl.id = 'exportLoadingText';
        loadingTextEl.textContent = '내보내는 중... 0%';
        overlay.appendChild(loadingTextEl);
        document.body.appendChild(overlay);
        
        function updateProgress(percent) {
            loadingTextEl.textContent = `내보내는 중... ${percent}%`;
        }
        
        try {
            updateProgress(0);
            
            // 클립 ID와 이미지 파일명 매핑 저장
            const clipImageFileNameMap = {};
            
            // 먼저 모든 클립을 이미지로 렌더링하고 파일명 매핑 생성
            const allClips = app.timeline.getAllClips();
            const clipsToProcess = Object.values(allClips).filter(clip => 
                !app.timeline.isClipHidden(clip.id) &&
                (clip.type === 'image' || 
                 clip.type === 'text' || 
                 ['rectangle', 'circle', 'triangle', 'star', 'heart', 'hexagon', 'diamond', 'pentagon', 'arrow', 'speechBubble', 'cross'].includes(clip.type))
            );
            
            // 각 클립에 대해 이미지 파일명 생성 (모두 랜덤 32자리)
            clipsToProcess.forEach(clip => {
                let imageFileName = Array.from({ length: 32 }, () =>
                    'abcdefghijklmnopqrstuvwxyz0123456789'[
                        Math.floor(Math.random() * 'abcdefghijklmnopqrstuvwxyz0123456789'.length)
                    ]
                ).join('');
                
                clipImageFileNameMap[clip.id] = imageFileName;
            });
            
            // 클립 데이터 및 카메라 키프레임 데이터 생성 (파일명 매핑 사용)
            const clipLists = exportEntryProject(clipImageFileNameMap);
            const cameraLists = exportCameraKeyframes();

            updateProgress(5);

            // project.json 불러오기
            const projectJSON = await fetch('project.json').then(res => res.json());

            // 배경색 설정
            const bgColor = document.getElementById('previewBgColor')?.value || '#000000';
            // bg_color 변수 찾기 (id: "hkpj")
            const bgColorVar = projectJSON.variables.find(v => v.id === 'hkpj');
            if (bgColorVar) {
                bgColorVar.value = bgColor;
            }

            // 오디오 파일 이름(랜덤 32자리) 생성
            let audioFileName = Array.from(
                { length: 32 },
                () => 'abcdefghijklmnopqrstuvwxyz0123456789'[
                    Math.floor(Math.random() * 'abcdefghijklmnopqrstuvwxyz0123456789'.length)
                ]
            ).join('');

            // projectJSON의 리스트 변수들 업데이트
            // 클립 관련 리스트 (e로 시작)
            const updateList = (id, data) => {
                const variable = projectJSON.variables.find(v => v.id === id);
                if (variable) {
                    variable.array = data.map(d => ({ data: d }));
                }
            };

            updateList('qmnv', clipLists.e_type);      // e_type
            updateList('2rth', clipLists.e_sTime);     // e_sTime
            updateList('j6f2', clipLists.e_eTime);     // e_eTime
            updateList('sz90', clipLists.e_fileName);  // e_fileName
            updateList('jr1s', clipLists.e_x_ease);    // e_x_ease
            updateList('wlne', clipLists.e_x_start);   // e_x_start
            updateList('sfxm', clipLists.e_x_end);     // e_x_end
            updateList('qq17', clipLists.e_y_ease);    // e_y_ease
            updateList('1280', clipLists.e_y_start);   // e_y_start
            updateList('k6sp', clipLists.e_y_end);     // e_y_end
            updateList('llca', clipLists.e_sc_ease);   // e_sc_ease
            updateList('81rb', clipLists.e_sc_start);  // e_sc_start
            updateList('idrx', clipLists.e_sc_end);    // e_sc_end
            updateList('bpe5', clipLists.e_dr_ease);   // e_dr_ease
            updateList('cwaa', clipLists.e_dr_start);  // e_dr_start
            updateList('vx09', clipLists.e_dr_end);    // e_dr_end
            updateList('th6s', clipLists.e_tr_ease);   // e_tr_ease
            updateList('6ryw', clipLists.e_tr_start);  // e_tr_start
            updateList('tvm1', clipLists.e_tr_end);    // e_tr_end

            // 카메라 키프레임 관련 리스트 (c로 시작)
            updateList('sh3n', cameraLists.c_time);    // c_time
            updateList('gepj', cameraLists.c_ease);    // c_ease
            updateList('r375', cameraLists.c_x);       // c_x
            updateList('bjy4', cameraLists.c_y);       // c_y
            updateList('03l9', cameraLists.c_scale);   // c_scale
            updateList('xx6m', cameraLists.c_dir);     // c_dir

            // objects 배열에서 name으로 객체 찾기
            const backgroundObj = projectJSON.objects.find(obj => obj.name === 'background');
            const elementObj = projectJSON.objects.find(obj => obj.name === 'element');

            if (!backgroundObj || !elementObj) {
                console.error('background 또는 element 오브젝트를 찾을 수 없습니다.');
                throw new Error('projectJSON 구조가 올바르지 않습니다.');
            }

            // 배경 음악 처리 - background 오브젝트의 sounds 배열 초기화
            if (!backgroundObj.sprite) {
                backgroundObj.sprite = { pictures: [], sounds: [] };
            }
            if (!backgroundObj.sprite.sounds) {
                backgroundObj.sprite.sounds = [];
            }
            if (!backgroundObj.sprite.sounds[0]) {
                backgroundObj.sprite.sounds[0] = {
                    duration: 0,
                    filename: '',
                    fileurl: '',
                    name: 'background',
                    id: Math.random().toString(36).substr(2, 9),
                    ext: 'mp3'
                };
            }

            let bgAudioBlob = null;
            if (app.bgAudio && app.bgAudio.src) {
                // Audio 객체에서 Blob 가져오기
                try {
                    const response = await fetch(app.bgAudio.src);
                    bgAudioBlob = await response.blob();
                    backgroundObj.sprite.sounds[0].duration = app.bgAudio.duration;
                } catch (e) {
                    console.warn('배경 음악 파일을 가져올 수 없습니다:', e);
                }
            }

            backgroundObj.sprite.sounds[0].filename = audioFileName;
            backgroundObj.sprite.sounds[0].fileurl = `temp/${audioFileName.slice(0, 2)}/${audioFileName.slice(2, 4)}/sound/${audioFileName}.mp3`;

            // sound% 변수에 배경음악 크기(볼륨) 저장
            const soundVolumeVar = projectJSON.variables.find(v => v.id === 'zb13');
            if (soundVolumeVar) {
                if (app.bgAudio) {
                    // 볼륨을 퍼센트로 저장 (0-1 범위를 0-100으로 변환)
                    soundVolumeVar.value = (app.bgAudio.volume || 1) * 100;
                } else {
                    // 배경음악이 없으면 기본값 50
                    soundVolumeVar.value = 50;
                }
            }

            // TarWriter 생성
            let tar = new tarball.TarWriter();
            
            updateProgress(10);
            
            // 오디오 파일 추가
            if (bgAudioBlob) {
                tar.addFile(
                    `temp/${audioFileName.slice(0, 2)}/${audioFileName.slice(2, 4)}/sound/${audioFileName}.mp3`,
                    new File(
                        [bgAudioBlob],
                        `temp/${audioFileName.slice(0, 2)}/${audioFileName.slice(2, 4)}/sound/${audioFileName}.mp3`
                    )
                );
            }
            updateProgress(20);
            await new Promise(r => setTimeout(r, 50));

            // projectJSON 내 picture 배열 초기화
            if (!elementObj.sprite) {
                elementObj.sprite = { pictures: [], sounds: [] };
            }
            if (!elementObj.sprite.pictures) {
                elementObj.sprite.pictures = [];
            }
            
            // 텍스트/도형을 이미지로 렌더링하는 함수
            function renderClipToImage(clip) {
                return new Promise((resolve) => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 이미지 화질 배율 (4배)
                    const qualityScale = 8;
                    
                    // 실제 콘텐츠 크기 계산
                    let contentWidth = 0;
                    let contentHeight = 0;
                    let actualWidth = 0;
                    let actualHeight = 0;
                    
                    if (clip.type === 'text') {
                        // 텍스트 크기 계산
                        const fontSize = clip.fontSize || 32;
                        const fontFamily = clip.fontFamily || '나눔고딕';
                        ctx.font = `${clip.bold ? 'bold ' : ''}${clip.italic ? 'italic ' : ''}${fontSize}px ${fontFamily}`;
                        const metrics = ctx.measureText(clip.content || '');
                        contentWidth = metrics.width;
                        contentHeight = fontSize;
                        const padding = 10;
                        actualWidth = contentWidth + padding * 2;
                        actualHeight = contentHeight + padding * 2;
                    } else {
                        // 도형 크기
                        const size = clip.shapeSize || 100;
                        actualWidth = size;
                        actualHeight = size;
                        // 말풍선은 높이가 다름
                        if (clip.type === 'speechBubble') {
                            actualHeight = size * 0.7 + size * 0.3; // 본체 + 꼬리
                        }
                    }
                    
                    // 캔버스 크기를 실제 콘텐츠 크기에 맞게 설정 (최소 크기 보장)
                    const minSize = 100;
                    const padding = 20; // 여백 추가
                    // 화질 향상을 위해 캔버스 크기를 2배로 설정
                    canvas.width = Math.max(actualWidth + padding * 2, minSize) * qualityScale;
                    canvas.height = Math.max(actualHeight + padding * 2, minSize) * qualityScale;
                    
                    // 배경 투명
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // 캔버스에 2배 스케일 적용
                    ctx.scale(qualityScale, qualityScale);
                    
                    // 폰트 다시 설정 (캔버스 크기 변경 후)
                    if (clip.type === 'text') {
                        const fontSize = clip.fontSize || 32;
                        const fontFamily = clip.fontFamily || '나눔고딕';
                        ctx.font = `${clip.bold ? 'bold ' : ''}${clip.italic ? 'italic ' : ''}${fontSize}px ${fontFamily}`;
                    }
                    
                    if (clip.type === 'text') {
                        // 텍스트 렌더링
                        const fontSize = clip.fontSize || 32;
                        const fontFamily = clip.fontFamily || '나눔고딕';
                        const textColor = clip.textColor || '#ffffff';
                        const bgColor = clip.bgTransparent ? 'transparent' : (clip.bgColor || '#000000');
                        const content = clip.content || '';
                        
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        
                        // 배경색 그리기
                        if (bgColor !== 'transparent') {
                            const metrics = ctx.measureText(content);
                            const textWidth = metrics.width;
                            const textHeight = fontSize;
                            const padding = 10;
                            ctx.fillStyle = bgColor;
                            ctx.fillRect(
                                (canvas.width / qualityScale - textWidth) / 2 - padding,
                                (canvas.height / qualityScale - textHeight) / 2 - padding,
                                textWidth + padding * 2,
                                textHeight + padding * 2
                            );
                        }
                        
                        // 텍스트 그리기
                        ctx.fillStyle = textColor;
                        ctx.fillText(content, canvas.width / qualityScale / 2, canvas.height / qualityScale / 2);
                        
                        if (clip.underline) {
                            const metrics = ctx.measureText(content);
                            ctx.strokeStyle = textColor;
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.moveTo((canvas.width / qualityScale - metrics.width) / 2, canvas.height / qualityScale / 2 + fontSize / 2 + 5);
                            ctx.lineTo((canvas.width / qualityScale + metrics.width) / 2, canvas.height / qualityScale / 2 + fontSize / 2 + 5);
                            ctx.stroke();
                        }
                        
                    } else if (clip.type === 'rectangle') {
                        // 사각형 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#FF0000';
                        ctx.fillStyle = color;
                        ctx.fillRect(
                            (canvas.width / qualityScale - size) / 2,
                            (canvas.height / qualityScale - size) / 2,
                            size,
                            size
                        );
                        
                    } else if (clip.type === 'circle') {
                        // 원 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#00FF00';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(canvas.width / qualityScale / 2, canvas.height / qualityScale / 2, size / 2, 0, Math.PI * 2);
                        ctx.fill();
                        
                    } else if (clip.type === 'triangle') {
                        // 삼각형 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#FFFF00';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.moveTo(canvas.width / qualityScale / 2, (canvas.height / qualityScale - size) / 2);
                        ctx.lineTo((canvas.width / qualityScale - size) / 2, (canvas.height / qualityScale + size) / 2);
                        ctx.lineTo((canvas.width / qualityScale + size) / 2, (canvas.height / qualityScale + size) / 2);
                        ctx.closePath();
                        ctx.fill();
                        
                    } else if (clip.type === 'star') {
                        // 별 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#FFD700';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        const centerX = canvas.width / qualityScale / 2;
                        const centerY = canvas.height / qualityScale / 2;
                        const outerRadius = size / 2;
                        const innerRadius = outerRadius / 2;
                        for (let i = 0; i < 10; i++) {
                            const angle = (Math.PI / 5) * i - Math.PI / 2;
                            const radius = i % 2 === 0 ? outerRadius : innerRadius;
                            const x = centerX + Math.cos(angle) * radius;
                            const y = centerY + Math.sin(angle) * radius;
                            if (i === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        }
                        ctx.closePath();
                        ctx.fill();
                        
                    } else if (clip.type === 'heart') {
                        // 하트 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#FF1493';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        const centerX = canvas.width / qualityScale / 2;
                        const centerY = canvas.height / qualityScale / 2;
                        ctx.moveTo(centerX, centerY + size / 4);
                        ctx.bezierCurveTo(centerX, centerY, centerX - size / 2, centerY - size / 4, centerX - size / 2, centerY);
                        ctx.bezierCurveTo(centerX - size / 2, centerY + size / 4, centerX, centerY + size / 2, centerX, centerY + size / 2);
                        ctx.bezierCurveTo(centerX, centerY + size / 2, centerX + size / 2, centerY + size / 4, centerX + size / 2, centerY);
                        ctx.bezierCurveTo(centerX + size / 2, centerY - size / 4, centerX, centerY, centerX, centerY + size / 4);
                        ctx.fill();
                        
                    } else if (clip.type === 'hexagon') {
                        // 육각형 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#00CED1';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        const centerX = canvas.width / qualityScale / 2;
                        const centerY = canvas.height / qualityScale / 2;
                        const radius = size / 2;
                        for (let i = 0; i < 6; i++) {
                            const angle = (Math.PI / 3) * i;
                            const x = centerX + Math.cos(angle) * radius;
                            const y = centerY + Math.sin(angle) * radius;
                            if (i === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        }
                        ctx.closePath();
                        ctx.fill();
                        
                    } else if (clip.type === 'diamond') {
                        // 다이아몬드 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#FF00FF';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.moveTo(canvas.width / qualityScale / 2, (canvas.height / qualityScale - size) / 2);
                        ctx.lineTo((canvas.width / qualityScale + size) / 2, canvas.height / qualityScale / 2);
                        ctx.lineTo(canvas.width / qualityScale / 2, (canvas.height / qualityScale + size) / 2);
                        ctx.lineTo((canvas.width / qualityScale - size) / 2, canvas.height / qualityScale / 2);
                        ctx.closePath();
                        ctx.fill();
                        
                    } else if (clip.type === 'pentagon') {
                        // 오각형 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#FFA500';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        const centerX = canvas.width / qualityScale / 2;
                        const centerY = canvas.height / qualityScale / 2;
                        const radius = size / 2;
                        for (let i = 0; i < 5; i++) {
                            const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                            const x = centerX + Math.cos(angle) * radius;
                            const y = centerY + Math.sin(angle) * radius;
                            if (i === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        }
                        ctx.closePath();
                        ctx.fill();
                        
                    } else if (clip.type === 'arrow') {
                        // 화살표 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#0000FF';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        const centerX = canvas.width / qualityScale / 2;
                        const centerY = canvas.height / qualityScale / 2;
                        ctx.moveTo(centerX - size / 2, centerY);
                        ctx.lineTo(centerX + size / 4, centerY - size / 3);
                        ctx.lineTo(centerX + size / 4, centerY - size / 6);
                        ctx.lineTo(centerX + size / 2, centerY - size / 6);
                        ctx.lineTo(centerX + size / 2, centerY + size / 6);
                        ctx.lineTo(centerX + size / 4, centerY + size / 6);
                        ctx.lineTo(centerX + size / 4, centerY + size / 3);
                        ctx.closePath();
                        ctx.fill();
                        
                    } else if (clip.type === 'speechBubble') {
                        // 말풍선 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#CCCCCC';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        const centerX = canvas.width / qualityScale / 2;
                        const centerY = canvas.height / qualityScale / 2;
                        ctx.rect(centerX - size / 2, centerY - size / 2, size, size * 0.7);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.moveTo(centerX - size / 4, centerY + size * 0.2);
                        ctx.lineTo(centerX - size / 2, centerY + size / 2);
                        ctx.lineTo(centerX, centerY + size * 0.2);
                        ctx.closePath();
                        ctx.fill();
                        
                    } else if (clip.type === 'cross') {
                        // 십자 렌더링
                        const size = clip.shapeSize || 100;
                        const color = clip.shapeColor || '#888888';
                        ctx.fillStyle = color;
                        const barWidth = size / 5;
                        ctx.fillRect(canvas.width / qualityScale / 2 - size / 2, canvas.height / qualityScale / 2 - barWidth / 2, size, barWidth);
                        ctx.fillRect(canvas.width / qualityScale / 2 - barWidth / 2, canvas.height / qualityScale / 2 - size / 2, barWidth, size);
                    }
                    
                    // Canvas를 Blob으로 변환
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve({
                                blob: blob,
                                width: canvas.width,
                                height: canvas.height,
                                fileName: `${clip.type}_${clip.id}.png`
                            });
                        } else {
                            resolve(null);
                        }
                    }, 'image/png');
                });
            }
            
            // 이미지 클립들 처리 (진행률 업데이트: 20% ~ 50%)
            let imagePromises = [];
            
            for (let idx = 0; idx < clipsToProcess.length; idx++) {
                let clip = clipsToProcess[idx];
                // 매핑에서 파일명 가져오기
                let imageFileName = clipImageFileNameMap[clip.id];
                if (!imageFileName) {
                    // 매핑에 없으면 생성 (원본 이미지의 경우)
                    if (clip.type === 'image') {
                        imageFileName = (clip.imageFile && clip.imageFile.name) || clip.imageFileName;
                    }
                    if (!imageFileName) {
                        imageFileName = Array.from({ length: 32 }, () =>
                            'abcdefghijklmnopqrstuvwxyz0123456789'[
                                Math.floor(Math.random() * 'abcdefghijklmnopqrstuvwxyz0123456789'.length)
                            ]
                        ).join('');
                    }
                }
                
                let promise;
                
                if (clip.type === 'image') {
                    // 기존 이미지 클립 처리
                    promise = new Promise((resolve) => {
                        if (!clip.imageFile && !clip.imageURL) {
                            console.warn('이미지 파일이 없습니다:', clip.id);
                            resolve();
                            return;
                        }

                        let img = new Image();
                        img.onload = function () {
                            let width = img.naturalWidth;
                            let height = img.naturalHeight;

                            elementObj.sprite.pictures.push({
                                'fileurl': '',
                                'dimension': {
                                    'width': width,
                                    'height': height,
                                    'scaleX': 1,
                                    'scaleY': 1
                                },
                                'filename': imageFileName,
                                'name': imageFileName, // 파일명과 동일하게 설정
                                'imageType': 'png',
                            });

                            // 이미지 파일을 tar에 추가
                            if (clip.imageFile) {
                                tar.addFile(
                                    `temp/${imageFileName.slice(0, 2)}/${imageFileName.slice(2, 4)}/image/${imageFileName}.png`,
                                    new File(
                                        [clip.imageFile],
                                        `temp/${imageFileName.slice(0, 2)}/${imageFileName.slice(2, 4)}/image/${imageFileName}.png`
                                    )
                                );
                            } else if (clip.imageURL) {
                                // imageURL에서 blob 가져오기
                                fetch(clip.imageURL)
                                    .then(res => res.blob())
                                    .then(blob => {
                                        tar.addFile(
                                            `temp/${imageFileName.slice(0, 2)}/${imageFileName.slice(2, 4)}/image/${imageFileName}.png`,
                                            new File(
                                                [blob],
                                                `temp/${imageFileName.slice(0, 2)}/${imageFileName.slice(2, 4)}/image/${imageFileName}.png`
                                            )
                                        );
                                    })
                                    .catch(err => {
                                        console.warn('이미지 blob 가져오기 실패:', err);
                                    });
                            }
                            resolve();
                        };
                        img.onerror = () => {
                            console.warn('이미지 로드 실패:', (clip.imageFile && clip.imageFile.name) || clip.imageFileName || '이미지');
                            resolve();
                        };

                        if (clip.imageURL) {
                            img.src = clip.imageURL;
                        } else if (clip.imageFile) {
                            img.src = URL.createObjectURL(clip.imageFile);
                        }
                    });
                } else {
                    // 텍스트/도형을 이미지로 렌더링
                    promise = renderClipToImage(clip).then((imageData) => {
                        if (imageData && imageData.blob) {
                            // 캔버스의 실제 크기를 사용 (이미 qualityScale이 적용된 크기)
                            const width = imageData.width;
                            const height = imageData.height;

                            elementObj.sprite.pictures.push({
                                'fileurl': '',
                                'dimension': {
                                    'width': width,
                                    'height': height,
                                    'scaleX': 1,
                                    'scaleY': 1
                                },
                                'filename': imageFileName,
                                'name': imageFileName,
                                'imageType': 'png',
                            });

                            // Blob을 File로 변환
                            tar.addFile(
                                `temp/${imageFileName.slice(0, 2)}/${imageFileName.slice(2, 4)}/image/${imageFileName}.png`,
                                new File(
                                    [imageData.blob],
                                    `temp/${imageFileName.slice(0, 2)}/${imageFileName.slice(2, 4)}/image/${imageFileName}.png`
                                )
                            );
                        }
                    });
                }
                
                imagePromises.push(promise.then(() => {
                    // 진행률 업데이트
                    let progressVal = 20 + Math.round(((idx + 1) / clipsToProcess.length) * 30);
                    updateProgress(progressVal);
                }));
            }
            
            await Promise.all(imagePromises);
            
            updateProgress(55);
            
            // project.json 추가
            tar.addFile(
                'temp/project.json',
                new File([new Blob([JSON.stringify(projectJSON)])], 'temp/project.json')
            );
            updateProgress(65);
            await new Promise(r => setTimeout(r, 50));
            
            // img.zip 불러와서 tar에 추가 (진행률 업데이트: 65% ~ 90%)
            const imgData = await fetch('img.zip').then(res => res.blob());
            const zipData = await new JSZip().loadAsync(imgData);
            let zipFiles = Object.entries(zipData.files).filter(([name, file]) => !file.dir);
            let totalZipFiles = zipFiles.length;
            let processedZipFiles = 0;
            for (const [fileName, zipFile] of zipFiles) {
                const fileBlob = await zipFile.async('blob');
                let fileObj = new File([fileBlob], fileName);
                tar.addFile('temp' + '\\' + fileName, fileObj);
                processedZipFiles++;
                let progressVal = 65 + Math.round((processedZipFiles / totalZipFiles) * 25);
                updateProgress(progressVal);
                await new Promise(r => setTimeout(r, 50)); // 딜레이
            }
            
            updateProgress(95);
            // tar 다운로드 (완료 전까지 진행률 95%로 유지)
            tar.download('project.ent');
            updateProgress(100);
            await new Promise(r => setTimeout(r, 300));
            
            // 모달 닫기
            const modal = document.getElementById('exportModal');
            if (modal) modal.style.display = 'none';
        } catch (error) {
            console.error('내보내기 중 오류 발생:', error);
            alert('내보내기 중 오류가 발생했습니다: ' + error.message);
        } finally {
            // 로딩 오버레이 삭제
            overlay.remove();
        }
    }

    /**
     * 프로젝트 파일 불러오기
     */
    function handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const projectData = JSON.parse(event.target.result);
                loadProject(projectData);

                const modal = document.getElementById('importModal');
                if (modal) modal.style.display = 'none';

                alert('프로젝트를 성공적으로 불러왔습니다!');
            } catch (error) {
                console.error('Error loading project:', error);
                alert('프로젝트 파일을 불러오는데 실패했습니다.');
            }
        };
        reader.readAsText(file);
    }

    /**
     * 프로젝트 로드
     */
    function loadProject(projectData) {
        if (!app.timeline) return;

        const timeline = app.timeline;
        const originalMode = timeline.timelineMode;
        let switchedForImport = false;

        if (timeline.timelineMode !== 'clip') {
            timeline.switchTimelineMode('clip');
            switchedForImport = true;
        }

        // 기존 클립 모두 제거
        const existingClips = timeline.getAllClips();
        Object.keys(existingClips).forEach(clipId => {
            timeline.deleteClip(clipId);
        });

        // 총 시간 설정
        if (projectData.totalDuration) {
            timeline.totalDuration = projectData.totalDuration;
            timeline.updateRuler();
            timeline.updateTracksWidth();
        }

        const clipsMap = projectData.clips || {};
        const requiredTrackCount = timeline.calculateRequiredTrackCount(clipsMap);
        if (timeline.timelineMode !== 'camera') {
            timeline.rebuildClipTracks(requiredTrackCount);
        }

        // 클립 복원
        Object.values(clipsMap).forEach(clipData => {
            // 이미지 복원
            if (clipData.type === 'image' && clipData.imageData) {
                clipData.imageURL = clipData.imageData;
                delete clipData.imageData;
            }

            timeline.addClip(clipData.type, clipData);
        });

        // 타임라인 모드 및 카메라 키프레임 복원
        if (projectData.timelineMode && timeline.timelineMode !== projectData.timelineMode) {
            // 버튼 UI 상태도 반영
            const modeBtns = document.querySelectorAll('.timeline-mode-switch .mode-btn');
            modeBtns.forEach(btn => {
                if (btn.dataset.mode === projectData.timelineMode) btn.classList.add('active');
                else btn.classList.remove('active');
            });
            timeline.switchTimelineMode(projectData.timelineMode);
        } else if (!projectData.timelineMode && switchedForImport && originalMode !== 'clip') {
            timeline.switchTimelineMode(originalMode);
        }
        
        if (Array.isArray(projectData.cameraKeyframes)) {
            timeline.cameraKeyframes = JSON.parse(JSON.stringify(projectData.cameraKeyframes));
            timeline.renderCameraKeyframes();
        }

        // 미리보기/레이어 업데이트
        if (app.previewSystem) {
            app.previewSystem.update(0);
        }
        if (app.leftPanel) {
            app.leftPanel.updateLayers();
        }
    }

    // 앱 시작
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();
