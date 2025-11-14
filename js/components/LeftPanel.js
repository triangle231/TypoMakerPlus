/**
 * Left Panel Component
 * 에셋 & 레이어 관리
 */

class LeftPanel {
    constructor() {
        this.uploadedImages = []; // 업로드된 이미지들
        this.viewSwitchingSetup = false; // 뷰 전환 이벤트 리스너 설정 여부
        this.defineAssets();
        this.init();
    }

    defineAssets() {
        this.shapeAssets = [
            { type: 'rectangle', title: '사각형', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" fill="#888" /></svg>' },
            { type: 'circle', title: '원', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#888" /></svg>' },
            { type: 'triangle', title: '삼각형', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="50,15 85,85 15,85" fill="#888" /></svg>' },
            { type: 'star', title: '별', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="50,10 61,35 88,35 67,52 74,77 50,60 26,77 33,52 12,35 39,35" fill="#888" /></svg>' },
            { type: 'heart', title: '하트', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><path d="M50,85 C50,85 15,60 15,40 C15,25 25,15 35,15 C42,15 48,20 50,25 C52,20 58,15 65,15 C75,15 85,25 85,40 C85,60 50,85 50,85 Z" fill="#888" /></svg>' },
            { type: 'hexagon', title: '육각형', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="50,5 93.3,25 93.3,75 50,95 6.7,75 6.7,25" fill="#888" /></svg>' },
            { type: 'diamond', title: '다이아몬드', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="50,10 85,50 50,90 15,50" fill="#888" /></svg>' },
            { type: 'pentagon', title: '오각형', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="50,10 90,40 75,85 25,85 10,40" fill="#888" /></svg>' },
            { type: 'arrow', title: '화살표', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="50,10 70,40 55,40 55,90 45,90 45,40 30,40" fill="#888" /></svg>' },
            { type: 'speechBubble', title: '말풍선', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><path d="M10 10 H 90 V 70 H 55 L 50 80 L 45 70 H 10 Z" fill="#888" /></svg>' },
            { type: 'cross', title: '십자', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><polygon points="20,10 10,20 40,50 10,80 20,90 50,60 80,90 90,80 60,50 90,20 80,10 50,40" fill="#888" /></svg>' },
            { type: 'fill', title: '채우기', svg: '<svg width="40" height="40" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#888" /></svg>' }
        ];

        this.textAssets = [
            { font: 'Pretendard-Regular', family: "'Pretendard-Regular', sans-serif" },
            { font: 'Paperlogy-8ExtraBold', family: "'Paperlogy-8ExtraBold', sans-serif" },
            { font: 'GmarketSansMedium', family: "'GmarketSansMedium', sans-serif" },
            { font: 'memomentKkukKkuk', family: "'memomentKkukKkuk', sans-serif" },
            { font: 'NEXON Lv1 Gothic OTF', family: "'NEXON Lv1 Gothic OTF', sans-serif" },
            { font: 'KoPubDotumMedium', family: "'KoPubDotumMedium', sans-serif" },
            { font: 'yg-jalnan', family: "'yg-jalnan', sans-serif" },
            { font: 'SBAggroB', family: "'SBAggroB', sans-serif" },
            { font: 'S-CoreDream-3Light', family: "'S-CoreDream-3Light', sans-serif" },
            { font: 'NanumSquare', family: "'NanumSquare', sans-serif" },
            { font: 'ZEN-SERIF-TTF-Regular', family: "'ZEN-SERIF-TTF-Regular', serif" },
            { font: 'Noto Sans KR', family: "'Noto Sans KR', sans-serif" },
            { font: 'PartialSansKR-Regular', family: "'PartialSansKR-Regular', sans-serif" },
            { font: 'Ownglyph_ParkDaHyun', family: "'Ownglyph_ParkDaHyun', sans-serif" },
            { font: 'Freesentation-9Black', family: "'Freesentation-9Black', sans-serif" },
            { font: 'SUIT-Regular', family: "'SUIT-Regular', sans-serif" },
            { font: 'Cafe24Ssurround', family: "'Cafe24Ssurround', sans-serif" },
            { font: '양진체', family: "'양진체', sans-serif" },
            { font: 'ChosunGs', family: "'ChosunGs', serif" },
            { font: 'GowunDodum-Regular', family: "'GowunDodum-Regular', sans-serif" },
            { font: 'Nanum Gothic', family: "'Nanum Gothic', sans-serif" },
            { font: 'HakgyoansimDunggeunmisoTTF-B', family: "'HakgyoansimDunggeunmisoTTF-B', sans-serif" },
            { font: 'LeeSeoyun', family: "'LeeSeoyun', sans-serif" },
            { font: 'GongGothicMedium', family: "'GongGothicMedium', sans-serif" },
            { font: 'Godo', family: "'Godo', sans-serif" },
            { font: 'GodoMaum', family: "'GodoMaum', sans-serif" },
            { font: 'SDKukdetopokki', family: "'SDKukdetopokki', sans-serif" },
            { font: 'SDKukdetopokki-Lt', family: "'SDKukdetopokki-Lt', sans-serif" },
            { font: 'Iropke Batang', family: "'Iropke Batang', serif" },
            { font: 'Binggrae', family: "'Binggrae', sans-serif" },
            { font: 'Binggrae-Bold', family: "'Binggrae-Bold', sans-serif" },
            { font: 'SejongJaeumiMoeumi-Bold', family: "'SejongJaeumiMoeumi-Bold', sans-serif" },
            { font: 'NYJGothicEB', family: "'NYJGothicEB', sans-serif" },
            { font: 'KJD2Beol', family: "'KJD2Beol', sans-serif" },
            { font: 'HSJandari', family: "'HSJandari', sans-serif" },
            { font: 'KNPSOdaesan-Regular', family: "'KNPSOdaesan-Regular', sans-serif" },
            { font: 'NYJDasanB', family: "'NYJDasanB', sans-serif" },
            { font: 'NYJUnheo', family: "'NYJUnheo', sans-serif" },
            { font: 'ClipartkoreaTTF-Bold', family: "'ClipartkoreaTTF-Bold', sans-serif" },
            { font: 'YeolrinMyeongjo-Medium', family: "'YeolrinMyeongjo-Medium', serif" },
            { font: 'KimjungchulMyungjo-Bold', family: "'KimjungchulMyungjo-Bold', serif" },
            { font: 'BookkMyungjo-Bd', family: "'BookkMyungjo-Bd', serif" },
            { font: 'Eulyoo1945-Regular', family: "'Eulyoo1945-Regular', serif" },
            { font: 'MaruBuri', family: "'MaruBuri', serif" },
            { font: 'YESMyoungjo-Regular', family: "'YESMyoungjo-Regular', serif" },
            { font: 'GowunBatang-Regular', family: "'GowunBatang-Regular', serif" },
            { font: 'SunBatang-Light', family: "'SunBatang-Light', serif" },
            { font: 'NoonnuBasicGothicRegular', family: "'NoonnuBasicGothicRegular', sans-serif" },
            { font: 'PyeojinGothic-Bold', family: "'PyeojinGothic-Bold', sans-serif" },
            { font: 'Wanted Sans', family: "'Wanted Sans', sans-serif" },
            { font: 'TheJamsil5Bold', family: "'TheJamsil5Bold', sans-serif" },
            { font: 'SeoulAlrimTTF-Heavy', family: "'SeoulAlrimTTF-Heavy', sans-serif" },
            { font: 'TillVictoryComes', family: "'TillVictoryComes', sans-serif" },
            { font: 'KHNPHD', family: "'KHNPHD', sans-serif" },
            { font: 'KHNPHU', family: "'KHNPHU', sans-serif" },
            { font: '둥근모꼴체', family: "'둥근모꼴체', sans-serif" }
        ];
    }

    init() {
        this.setupTabs();
        this.populateAssets();
        this.renderImageAssets(); // 초기 이미지 에셋 렌더링
        this.setupAssetHandlers();
        this.setupViewSwitching();
        this.setupLayerContextMenu();
        this.setupTimelineModeListener();
    }
    
    /**
     * 타임라인 모드 변경 감지
     */
    setupTimelineModeListener() {
        // 타임라인 모드 전환 버튼 이벤트 감지
        const modeBtns = document.querySelectorAll('.timeline-mode-switch .mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 약간의 딜레이 후 에셋 다시 렌더링
                setTimeout(() => {
                    this.updateAssetsForMode();
                }, 50);
            });
        });
    }
    
    /**
     * 모드에 따라 에셋 업데이트
     */
    updateAssetsForMode() {
        if (!window.app || !window.app.timeline) return;
        
        const isCamera = window.app.timeline.timelineMode === 'camera';
        const assetMainView = document.getElementById('asset-main-view');
        const detailView = document.getElementById('asset-detail-view');
        
        // 뷰 상태 초기화 (상세 뷰가 열려있으면 메인 뷰로 돌아가기)
        if (detailView && assetMainView) {
            assetMainView.style.display = 'block';
            detailView.style.display = 'none';
        }
        
        if (isCamera) {
            // 카메라 모드: 키프레임만 표시
            const easingKeyframes = [
                { type: 'linear', title: 'Linear', icon: 'fa-solid fa-minus' },
                { type: 'easeIn', title: 'Ease In', icon: 'fa-solid fa-arrow-right' },
                { type: 'easeOut', title: 'Ease Out', icon: 'fa-solid fa-arrow-left' },
                { type: 'easeInOut', title: 'Ease In-Out', icon: 'fa-solid fa-arrows-left-right' }
            ];
            
            assetMainView.innerHTML = `
                <div class="asset-section">
                    <div class="asset-section-header">
                        <h3><i class="fa-solid fa-bezier-curve"></i> 카메라 키프레임</h3>
                    </div>
                    <div class="asset-grid" id="cameraKeyframesGrid">
                        <!-- 키프레임들이 여기 렌더링됨 -->
                    </div>
                </div>
            `;
            
            const grid = document.getElementById('cameraKeyframesGrid');
            this.renderCameraKeyframeItems(grid, easingKeyframes);
            
        } else {
            // 클립 모드: 원래 에셋 구조 복원
            assetMainView.innerHTML = `
                <!-- 도형 섹션 -->
                <div class="asset-section">
                    <div class="asset-section-header">
                        <h3><i class="fa-solid fa-shapes"></i> 도형</h3>
                        <button class="more-btn" data-target="shapes-detail-view">더보기 <i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                    <div class="asset-grid" id="shapeAssetsPreview">
                        <!-- JS에서 동적 생성 -->
                    </div>
                </div>

                <!-- 텍스트 섹션 -->
                <div class="asset-section">
                    <div class="asset-section-header">
                        <h3><i class="fa-solid fa-font"></i> 텍스트</h3>
                        <button class="more-btn" data-target="text-detail-view">더보기 <i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                    <div class="asset-grid text-asset-grid" id="textAssetsPreview">
                        <!-- JS에서 동적 생성 -->
                    </div>
                </div>

                <!-- 이미지 섹션 -->
                <div class="asset-section">
                    <div class="asset-section-header">
                        <h3>
                            <i class="fa-solid fa-image"></i>
                            이미지
                        </h3>
                        <button class="more-btn" data-target="images-detail-view">더보기 <i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                    <div class="image-assets" id="imageAssetsPreview">
                        <!-- JS에서 동적 생성 -->
                    </div>
                </div>
            `;
            
            // 에셋 다시 렌더링
            this.populateAssets();
            this.renderImageAssets();
            
            // HTML을 재생성했으므로 뷰 전환 이벤트 리스너도 다시 설정
            this.setupViewSwitching();
        }
    }
    
    /**
     * 카메라 키프레임 아이템 렌더링
     */
    renderCameraKeyframeItems(container, keyframes) {
        if (!container) return;
        container.innerHTML = '';
        keyframes.forEach(keyframe => {
            const item = document.createElement('div');
            item.className = 'asset-item camera-keyframe-item';
            item.dataset.easing = keyframe.type;
            item.title = keyframe.title;
            
            item.innerHTML = `
                <i class="${keyframe.icon}" style="font-size: 24px;"></i>
                <span>${keyframe.title}</span>
            `;
            
            container.appendChild(item);
        });
    }

    /**
     * 탭 전환 설정
     */
    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;

                // 모든 탭 비활성화
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                // 선택한 탭 활성화
                btn.classList.add('active');
                document.getElementById(tabName + 'Tab').classList.add('active');
            });
        });
    }

    /**
     * 에셋 목록 동적 생성
     */
    populateAssets() {
        const shapePreviewContainer = document.getElementById('shapeAssetsPreview');
        const shapeFullContainer = document.getElementById('shapeAssetsFull');
        this.renderAssetItems(shapePreviewContainer, this.shapeAssets.slice(0, 4));
        this.renderAssetItems(shapeFullContainer, this.shapeAssets);

        const textPreviewContainer = document.getElementById('textAssetsPreview');
        const textFullContainer = document.getElementById('textAssetsFull');
        this.renderAssetItems(textPreviewContainer, this.textAssets.slice(0, 4));
        this.renderAssetItems(textFullContainer, this.textAssets);
    }
    
    renderAssetItems(container, assets) {
        if (!container) return;
        container.innerHTML = '';
        assets.forEach(asset => {
            const item = document.createElement('div');
            item.className = 'asset-item';
            item.dataset.type = asset.type || 'text';

            if (asset.type) { // Shape
                item.title = asset.title;
                item.innerHTML = asset.svg ? asset.svg : `<i class="${asset.icon}"></i>`;
                item.innerHTML += `<span>${asset.title}</span>`;
            } else { // Text
                item.className += ' text-asset-item';
                item.dataset.font = asset.font;
                item.style.fontFamily = asset.family;
                // 폰트명을 한글 이름으로 표시
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
                    'Noto Sans KR': '본고딕',
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
                const fontDisplayName = fontNameMap[asset.font] || asset.font;
                item.innerHTML = `<span class="font-preview-text">${fontDisplayName}</span>`;
            }
            container.appendChild(item);
        });
    }

    /**
     * 에셋 핸들러 설정
     */
    setupAssetHandlers() {
        // 이벤트 위임을 사용하여 에셋 탭의 모든 클릭 처리
        document.getElementById('assetsTab').addEventListener('click', (e) => {
            const target = e.target;
            const keyframeItem = target.closest('.camera-keyframe-item');
            const assetItem = target.closest('.asset-item:not(.camera-keyframe-item)');
            const imageAsset = target.closest('.image-asset-item');

            // '이미지 추가' 버튼 제외
            if (target.closest('.image-asset-item--add')) {
                return;
            }

            if (window.app && window.app.timeline) {
                const timeline = window.app.timeline;

                if (timeline.timelineMode === 'camera') {
                    if (keyframeItem) {
                        const easing = keyframeItem.dataset.easing;
                        timeline.addCameraKeyframe(easing);
                    }
                    return; // 카메라 모드에서는 아래 로직 실행 안 함
                }

                // 클립 모드 로직
                if (assetItem) {
                    const type = assetItem.dataset.type;
                    const font = assetItem.dataset.font;

                    if (type === 'text' && font) {
                        timeline.addClip(type, { fontFamily: font });
                    } else {
                        timeline.addClip(type);
                    }
                    return;
                }
                
                if (imageAsset && !target.closest('.delete-btn')) {
                    const imageId = imageAsset.dataset.imageId;
                    const imgData = this.uploadedImages.find(img => img.id === imageId);
                    if (imgData) {
                        timeline.addClip('image', {
                            imageFile: imgData.file,
                            imageURL: imgData.url,
                            imageFileName: imgData.name
                        });
                    }
                }
            }
        });

        // 파일 입력을 통한 이미지 추가 핸들링
        const fileInput = document.getElementById('imageInput');
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.handleImageFiles(e.target.files);
                fileInput.value = ''; // 동일 파일 다시 선택 가능하도록 초기화
            }
        });
    }
    
    /**
     * 이미지 파일 처리
     */
    handleImageFiles(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.addImage(file, e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    /**
     * 에셋 뷰 전환 설정
     */
    setupViewSwitching() {
        // 이미 설정되었으면 리스너를 다시 제거하고 재설정
        const mainView = document.getElementById('asset-main-view');
        const detailView = document.getElementById('asset-detail-view');
        const moreBtns = document.querySelectorAll('.more-btn');
        const backBtn = document.querySelector('.back-btn');

        // 기존 리스너 제거를 위해 새로운 버튼으로 교체 (클론)
        moreBtns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });

        // 새로 쿼리한 버튼들에 이벤트 리스너 추가
        const newMoreBtns = document.querySelectorAll('.more-btn');
        newMoreBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                mainView.style.display = 'none';
                detailView.style.display = 'block';

                document.querySelectorAll('.asset-detail-content').forEach(content => {
                    content.style.display = 'none';
                });
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.style.display = 'block';
                }
            });
        });

        if (backBtn) {
            const newBackBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBackBtn, backBtn);
            
            const finalBackBtn = document.querySelector('.back-btn');
            if (finalBackBtn) {
                finalBackBtn.addEventListener('click', () => {
                    mainView.style.display = 'block';
                    detailView.style.display = 'none';
                });
            }
        }

        this.viewSwitchingSetup = true;
    }

    /**
     * 이미지 추가
     */
    addImage(file, imageURL) {
        const imageData = {
            id: 'img_' + Date.now(),
            file: file,
            url: imageURL,
            name: file.name
        };

        this.uploadedImages.push(imageData);
        this.renderImageAssets();
        
                // 자동 저장 트리거
                if (window.app && window.app.timeline) {
                    window.app.timeline.triggerAutoSave('이미지 에셋 추가');
                }
    }

    /**
     * 이미지 에셋 렌더링
     */
    renderImageAssets() {
        const imageAssetsPreviewContainer = document.getElementById('imageAssetsPreview');
        const imageAssetsFullContainer = document.getElementById('imageAssetsFull');
        const containers = [imageAssetsPreviewContainer, imageAssetsFullContainer];

        containers.forEach(container => {
            if (!container) return;
            container.innerHTML = '';

            // '이미지 추가' 버튼 생성 및 추가
            const addBtn = this.createImageAddButton();
            container.appendChild(addBtn);

            const imagesToRender = (container === imageAssetsPreviewContainer)
                ? this.uploadedImages.slice(0, 3) // 미리보기는 3개 + 추가 버튼
                : this.uploadedImages;

            imagesToRender.forEach(img => {
                const item = document.createElement('div');
                item.className = 'image-asset-item';
                item.dataset.imageId = img.id;

                item.innerHTML = `
                    <img src="${img.url}" alt="${img.name}">
                    <button class="delete-btn" title="삭제">
                        <i class="fa-solid fa-times"></i>
                    </button>
                `;

                // 클릭 이벤트는 상위에서 위임하여 처리
                
                // 삭제 버튼 이벤트
                const deleteBtn = item.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeImage(img.id);
                });

                container.appendChild(item);
            });
        });
    }

    /**
     * '이미지 추가' 버튼 생성 및 이벤트 핸들러 설정
     */
    createImageAddButton() {
        const addBtn = document.createElement('div');
        addBtn.className = 'image-asset-item--add';
        addBtn.innerHTML = `
            <i class="fa-solid fa-upload"></i>
            <span>이미지 추가</span>
        `;
        
        const fileInput = document.getElementById('imageInput');
        addBtn.addEventListener('click', () => fileInput.click());

        // 드래그 앤 드롭 이벤트 리스너
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            addBtn.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            addBtn.addEventListener(eventName, () => addBtn.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            addBtn.addEventListener(eventName, () => addBtn.classList.remove('dragover'), false);
        });

        addBtn.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length) {
                this.handleImageFiles(files);
            }
        }, false);

        return addBtn;
    }

    /**
     * 이미지 제거
     */
    removeImage(imageId) {
        const index = this.uploadedImages.findIndex(img => img.id === imageId);
        if (index > -1) {
            this.uploadedImages.splice(index, 1);
            this.renderImageAssets();
            
            // 자동 저장 트리거
            if (window.app && window.app.timeline) {
                window.app.timeline.triggerAutoSave('이미지 에셋 삭제');
            }
        }
    }

    /**
     * 레이어 목록 업데이트
     */
    updateLayers() {
        const layersList = document.getElementById('layersList');
        if (!layersList) return;

        if (!window.app || !window.app.timeline) return;

        const timeline = window.app.timeline;
        const isCamera = timeline.timelineMode === 'camera';

        // 카메라 모드: 키프레임 목록 렌더링
        if (isCamera) {
            const keyframes = timeline.cameraKeyframes || [];
            if (keyframes.length === 0) {
                layersList.innerHTML = '<p class="empty-message">카메라 키프레임이 없습니다</p>';
                return;
            }

            layersList.innerHTML = '';
            keyframes.forEach(kf => {
                const item = document.createElement('div');
                item.className = 'layer-item';
                item.dataset.keyframeId = kf.id;

                const easingLabelMap = {
                    linear: 'Linear', easeIn: 'Ease In', easeOut: 'Ease Out', easeInOut: 'Ease In-Out'
                };
                const label = `${easingLabelMap[kf.easing] || kf.easing}`;

                item.innerHTML = `
                    <i class="fa-solid fa-location-dot"></i>
                    <div class="layer-info">
                        <div class="layer-name">${label}</div>
                        <div class="layer-time">${kf.time.toFixed(2)}s • X:${kf.values?.x ?? 0} Y:${kf.values?.y ?? 0} S:${kf.values?.scale ?? 100}% R:${kf.values?.rotation ?? 0}°</div>
                    </div>
                `;

                // 클릭 시 해당 키프레임으로 이동 및 선택
                item.addEventListener('click', () => {
                    if (!window.app || !window.app.timeline) return;
                    timeline.setCurrentTime(kf.time);
                    timeline.selectKeyframe?.(kf);
                });

                // 우클릭 메뉴 (카메라 키프레임 컨텍스트 메뉴 표시)
                item.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (window.app && window.app.timeline) {
                        // 타임라인의 키프레임 컨텍스트 메뉴 표시 함수 호출
                        const keyframe = timeline.cameraKeyframes.find(k => k.id === kf.id);
                        if (keyframe) {
                            timeline.showCameraKeyframeContextMenu(e, keyframe);
                        }
                    }
                });

                layersList.appendChild(item);
            });
            return;
        }

        // 클립 모드: 기존 클립 목록 렌더링
        const clips = timeline.getAllClips();
        const selectedClipId = timeline.selectedClipId;
        const selectedClipIds = timeline.selectedClipIds || [];

        if (Object.keys(clips).length === 0) {
            layersList.innerHTML = '<p class="empty-message">클립이 없습니다</p>';
            return;
        }

        // 트랙 순서와 시간 순서로 정렬
        const sortedClips = Object.values(clips).sort((a, b) => {
            if (a.trackIndex !== b.trackIndex) {
                return b.trackIndex - a.trackIndex; // 위쪽 트랙이 먼저
            }
            return a.startTime - b.startTime;
        });

        layersList.innerHTML = '';
        sortedClips.forEach(clip => {
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.dataset.clipId = clip.id;

            // 다중 선택 지원
            if (selectedClipIds.includes(clip.id)) {
                item.classList.add('selected');
            }

            const icon = this.getClipIcon(clip.type);
            const label = this.getClipLabel(clip);

            // 숨겨진 클립 확인
            const isHidden = timeline.isClipHidden(clip.id);

            item.innerHTML = `
                <i class="${icon}"></i>
                <div class="layer-info">
                    <div class="layer-name">${label}</div>
                    <div class="layer-time">${clip.startTime.toFixed(1)}s - ${(clip.startTime + clip.duration).toFixed(1)}s</div>
                </div>
            `;

            // 숨겨진 클립 스타일 적용
            if (isHidden) {
                item.style.opacity = '0.5';
                item.style.textDecoration = 'line-through';
            }

            // 클릭시 클립 선택 (Ctrl/Shift 지원)
            item.addEventListener('click', (e) => {
                if (window.app && window.app.timeline) {
                    const multiSelect = e.ctrlKey || e.metaKey;
                    const rangeSelect = e.shiftKey;
                    timeline.selectClip(clip.id, multiSelect, rangeSelect);
                }
            });

            // 우클릭 메뉴
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showLayerContextMenu(e, clip.id);
            });

            layersList.appendChild(item);
        });
    }

    /**
     * 클립 타입별 아이콘
     */
    getClipIcon(type) {
        const icons = {
            text: 'fa-solid fa-font',
            rectangle: 'fa-solid fa-square',
            circle: 'fa-solid fa-circle',
            image: 'fa-solid fa-image',
            fill: 'fa-solid fa-fill-drip'
        };
        return icons[type] || 'fa-solid fa-question';
    }

    /**
     * 클립 레이블
     */
    getClipLabel(clip) {
        const labels = {
            text: clip.content || '텍스트',
            rectangle: '사각형',
            circle: '원',
            triangle: '삼각형',
            star: '별',
            heart: '하트',
            hexagon: '육각형',
            diamond: '다이아몬드',
            pentagon: '오각형',
            arrow: '화살표',
            speechBubble: '말풍선',
            cross: '십자',
            image: clip.imageFile?.name || clip.imageFileName || '이미지',
            fill: '채우기'
        };
        return labels[clip.type] || clip.type;
    }

    /**
     * 레이어 컨텍스트 메뉴 설정
     */
    setupLayerContextMenu() {
        const contextMenu = document.getElementById('layerContextMenu');
        if (!contextMenu) return;

        // 메뉴 아이템 클릭
        contextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item) return;

            const action = item.dataset.action;
            const clipId = contextMenu.dataset.clipId;

            this.handleLayerContextAction(action, clipId);

            // 메뉴 숨기기
            if (window.app && window.app.timeline && window.app.timeline.hideAllContextMenus) {
                window.app.timeline.hideAllContextMenus();
            } else {
                this.hideLayerContextMenu();
            }
        });

        // 외부 클릭시 메뉴 숨기기 -> Timeline의 전역 리스너로 대체
    }

    /**
     * 레이어 컨텍스트 메뉴 표시
     */
    showLayerContextMenu(event, clipId) {
        // 다른 모든 컨텍스트 메뉴 숨기기
        if (window.app && window.app.timeline && window.app.timeline.hideAllContextMenus) {
            window.app.timeline.hideAllContextMenus();
        }

        const contextMenu = document.getElementById('layerContextMenu');
        if (!contextMenu) return;

        contextMenu.dataset.clipId = clipId;
        contextMenu.style.display = 'block';
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';

        // 활성화/비활성화 메뉴 항목 업데이트
        const visibilityItem = contextMenu.querySelector('[data-action="toggleVisibility"]');
        if (visibilityItem && window.app && window.app.timeline) {
            const icon = visibilityItem.querySelector('i');
            const text = visibilityItem.querySelector('.visibility-text');
            const isHidden = window.app.timeline.isClipHidden(clipId);

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
     * 레이어 컨텍스트 메뉴 숨기기
     */
    hideLayerContextMenu() {
        const contextMenu = document.getElementById('layerContextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    }

    /**
     * 레이어 컨텍스트 메뉴 액션 처리
     */
    handleLayerContextAction(action, clipId) {
        if (!window.app || !window.app.timeline) return;

        switch (action) {
            case 'copy':
                window.app.timeline.copyClip(clipId);
                break;
            case 'cut':
                window.app.timeline.cutClip(clipId);
                break;
            case 'toggleVisibility':
                window.app.timeline.toggleClipVisibility(clipId);
                break;
            case 'delete':
                window.app.timeline.deleteClip(clipId);
                break;
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeftPanel;
}
