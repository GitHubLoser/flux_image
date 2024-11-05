// 配置对象
const config = {
    maxHistory: 10,
    maxGalleryImages: 12,
    retryAttempts: 3,
    retryDelay: 1000,
};

// 存储生成的图片和提示词历史
let generatedImages = [];
let promptHistory = [];
let isGenerating = false;

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    loadFromLocalStorage();
    setupEventListeners();
});

// 初始化UI组件
function initializeUI() {
    // 添加设置面板到提示词区域
    const promptSection = document.querySelector('.prompt-section');
    promptSection.insertAdjacentHTML('beforeend', `
        <div class="settings-panel">
            <div class="settings-group">
                <label>图片尺寸</label>
                <select id="imageSize">
                    <option value="512x512">512x512</option>
                    <option value="1024x1024">1024x1024</option>
                </select>
            </div>
            <div class="settings-group">
                <label>生成数量</label>
                <input type="number" id="imageCount" min="1" max="4" value="1">
            </div>
        </div>
        <div class="prompt-history"></div>
        <div class="error-message"></div>
    `);

    // 添加图片预览模态框
    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal">
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <img src="" alt="预览图片">
            </div>
        </div>
    `);
}

// 设置事件监听器
function setupEventListeners() {
    const generateBtn = document.querySelector('.generate-btn');
    const promptInput = document.querySelector('.prompt-input');
    const modal = document.querySelector('.modal');
    const closeModal = document.querySelector('.close-modal');

    generateBtn.addEventListener('click', handleGenerate);
    promptInput.addEventListener('input', handlePromptInput);
    closeModal.addEventListener('click', () => modal.classList.remove('active'));
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') modal.classList.remove('active');
    });
}

// 处理提示词输入
function handlePromptInput(e) {
    const promptHistory = document.querySelector('.prompt-history');
    const value = e.target.value.trim();
    
    if (value && promptHistory.children.length > 0) {
        promptHistory.classList.add('active');
    } else {
        promptHistory.classList.remove('active');
    }
}

// 处理图片生成
async function handleGenerate() {
    const promptInput = document.querySelector('.prompt-input');
    const prompt = promptInput.value.trim();
    const imageSize = document.querySelector('#imageSize').value;
    const imageCount = document.querySelector('#imageCount').value;

    if (!prompt) {
        showError('请输入提示词');
        return;
    }

    if (isGenerating) {
        showError('正在生成中，请稍候...');
        return;
    }

    try {
        await generateImage(prompt, imageSize, imageCount);
        addToPromptHistory(prompt);
    } catch (error) {
        showError(error.message);
    }
}

// 生成图片
async function generateImage(prompt, size, count) {
    isGenerating = true;
    updateUIForGeneration(true);

    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
        try {
            const response = await fetch('YOUR_API_ENDPOINT', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_API_KEY'
                },
                body: JSON.stringify({ 
                    prompt,
                    size,
                    n: parseInt(count)
                })
            });

            if (!response.ok) throw new Error('API 请求失败');

            const data = await response.json();
            data.images.forEach(imageUrl => addImageToGallery(imageUrl, prompt));
            break;
        } catch (error) {
            if (attempt === config.retryAttempts) throw error;
            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
    }

    updateUIForGeneration(false);
}

// 更新UI生成状态
function updateUIForGeneration(isGenerating) {
    const generateBtn = document.querySelector('.generate-btn');
    const generatingSection = document.querySelector('.generating-section');
    
    generateBtn.disabled = isGenerating;
    generateBtn.textContent = isGenerating ? '生成中...' : '开始生成';
    generatingSection.style.display = isGenerating ? 'block' : 'none';
}

// 添加图片到画廊
function addImageToGallery(imageUrl, prompt) {
    const galleryGrid = document.querySelector('.gallery-grid');
    const galleryItem = document.createElement('div');
    galleryItem.className = 'gallery-item';
    
    galleryItem.innerHTML = `
        <img src="${imageUrl}" alt="${prompt}">
        <div class="gallery-item-actions">
            <button class="action-btn preview-btn">预览</button>
            <button class="action-btn download-btn">下载</button>
            <button class="action-btn copy-btn">复制</button>
        </div>
    `;

    setupGalleryItemActions(galleryItem, imageUrl, prompt);
    galleryGrid.insertBefore(galleryItem, galleryGrid.firstChild);
    
    generatedImages.unshift({ url: imageUrl, prompt });
    saveToLocalStorage();
    
    if (galleryGrid.children.length > config.maxGalleryImages) {
        galleryGrid.removeChild(galleryGrid.lastChild);
    }
}

// 设置画廊项目的操作按钮
function setupGalleryItemActions(galleryItem, imageUrl, prompt) {
    const previewBtn = galleryItem.querySelector('.preview-btn');
    const downloadBtn = galleryItem.querySelector('.download-btn');
    const copyBtn = galleryItem.querySelector('.copy-btn');

    previewBtn.addEventListener('click', () => showPreview(imageUrl));
    downloadBtn.addEventListener('click', () => downloadImage(imageUrl));
    copyBtn.addEventListener('click', () => copyImageToClipboard(imageUrl));
}

// 显示预览
function showPreview(imageUrl) {
    const modal = document.querySelector('.modal');
    const modalImg = modal.querySelector('img');
    modalImg.src = imageUrl;
    modal.classList.add('active');
}

// 下载图片
async function downloadImage(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        showError('下载失败');
    }
}

// 复制图片到剪贴板
async function copyImageToClipboard(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
            new ClipboardItem({
                [blob.type]: blob
            })
        ]);
        showMessage('图片已复制到剪贴板');
    } catch (error) {
        showError('复制失败');
    }
}

// 添加到提示词历史
function addToPromptHistory(prompt) {
    promptHistory.unshift(prompt);
    if (promptHistory.length > config.maxHistory) {
        promptHistory.pop();
    }
    updatePromptHistoryUI();
    saveToLocalStorage();
}

// 更新提示词历史UI
function updatePromptHistoryUI() {
    const historyContainer = document.querySelector('.prompt-history');
    historyContainer.innerHTML = promptHistory
        .map(prompt => `<div class="history-item">${prompt}</div>`)
        .join('');
        
    historyContainer.querySelectorAll('.history-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            document.querySelector('.prompt-input').value = promptHistory[index];
        });
    });
}

// 显示错误信息
function showError(message) {
    const errorElement = document.querySelector('.error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 3000);
}

// 显示提示信息
function showMessage(message) {
    // 可以实现一个轻提示组件
    alert(message);
}

// 保存到本地存储
function saveToLocalStorage() {
    localStorage.setItem('generatedImages', JSON.stringify(generatedImages));
    localStorage.setItem('promptHistory', JSON.stringify(promptHistory));
}

// 从本地存储加载
function loadFromLocalStorage() {
    try {
        const savedImages = localStorage.getItem('generatedImages');
        const savedHistory = localStorage.getItem('promptHistory');
        
        if (savedImages) {
            generatedImages = JSON.parse(savedImages);
            generatedImages.forEach(({url, prompt}) => addImageToGallery(url, prompt));
        }
        
        if (savedHistory) {
            promptHistory = JSON.parse(savedHistory);
            updatePromptHistoryUI();
        }
    } catch (error) {
        console.error('加载本地存储失败:', error);
    }
} 