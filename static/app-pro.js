class YouTubeDownloader {
    constructor() {
        // Configure API endpoint
        this.API_URL = window.CONFIG?.API_URL || 'http://localhost:5000';
        
        this.activeDownloads = new Map();
        this.downloadHistory = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
        this.initializeElements();
        this.bindEvents();
        this.updateHistoryUI();
    }

    initializeElements() {
        // Single download elements
        this.urlInput = document.getElementById('urlInput');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.qualitySelect = document.getElementById('qualitySelect');
        this.downloadsList = document.getElementById('downloadsList');
        this.activeDownloadsCard = document.getElementById('activeDownloadsCard');
        
        // Batch download elements
        this.batchUrls = document.getElementById('batchUrls');
        this.batchFormat = document.getElementById('batchFormat');
        this.batchQuality = document.getElementById('batchQuality');
        this.batchDownloadBtn = document.getElementById('batchDownloadBtn');
        
        // History elements
        this.historyList = document.getElementById('historyList');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        
        // Common
        this.toastContainer = document.getElementById('toastContainer');
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab));
        });

        // Format buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectFormat(btn));
        });

        // Single download
        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', () => this.startSingleDownload());
        }
        
        if (this.urlInput) {
            this.urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.startSingleDownload();
            });
        }

        // Batch download
        if (this.batchDownloadBtn) {
            this.batchDownloadBtn.addEventListener('click', () => this.startBatchDownload());
        }

        // Clear history
        if (this.clearHistoryBtn) {
            this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        }
    }

    switchTab(clickedTab) {
        // Update tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        clickedTab.classList.add('active');

        // Update content
        const tabName = clickedTab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const content = document.getElementById(`${tabName}Tab`);
        if (content) content.classList.add('active');
    }

    selectFormat(clickedBtn) {
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        clickedBtn.classList.add('active');

        // Disable quality for MP3
        const format = clickedBtn.dataset.format;
        if (this.qualitySelect) {
            this.qualitySelect.disabled = (format === 'mp3');
            this.qualitySelect.style.opacity = format === 'mp3' ? '0.5' : '1';
        }
    }

    async startSingleDownload() {
        const url = this.urlInput?.value.trim();
        if (!url) {
            this.showToast('Please enter a YouTube URL', 'error');
            return;
        }

        const format = document.querySelector('.format-btn.active')?.dataset.format || 'mp4';
        const quality = this.qualitySelect?.value || '720p';

        this.downloadBtn.disabled = true;
        this.downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';

        try {
            const response = await fetch(`${this.API_URL}/api/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, format, quality })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            if (data.download_id) {
                this.addActiveDownload(data.download_id, { url, format, quality });
                this.startPolling(data.download_id);
                this.showToast('Download started successfully!', 'success');
                this.urlInput.value = '';
            }
        } catch (error) {
            this.showToast(error.message || 'Failed to start download', 'error');
        } finally {
            this.downloadBtn.disabled = false;
            this.downloadBtn.innerHTML = '<i class="fas fa-download"></i> Start Download';
        }
    }

    async startBatchDownload() {
        const urls = this.batchUrls?.value.trim().split('\n').filter(url => url.trim());
        if (!urls.length) {
            this.showToast('Please enter at least one URL', 'error');
            return;
        }

        const format = this.batchFormat?.value || 'mp4';
        const quality = this.batchQuality?.value || '720p';

        this.batchDownloadBtn.disabled = true;
        this.batchDownloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';

        try {
            for (const url of urls) {
                const response = await fetch(`${this.API_URL}/api/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: url.trim(), format, quality })
                });

                const data = await response.json();
                if (data.download_id) {
                    this.addActiveDownload(data.download_id, { url, format, quality });
                    this.startPolling(data.download_id);
                }
            }
            
            this.showToast(`Started downloading ${urls.length} videos`, 'success');
            this.batchUrls.value = '';
        } catch (error) {
            this.showToast('Failed to start batch download', 'error');
        } finally {
            this.batchDownloadBtn.disabled = false;
            this.batchDownloadBtn.innerHTML = '<i class="fas fa-download"></i> Download All';
        }
    }

    addActiveDownload(downloadId, options) {
        const download = {
            id: downloadId,
            url: options.url,
            format: options.format,
            quality: options.quality,
            startTime: Date.now(),
            status: 'Initializing...',
            progress: 0,
            title: 'Fetching video info...'
        };

        this.activeDownloads.set(downloadId, download);
        this.activeDownloadsCard.style.display = 'block';
        this.renderActiveDownload(download);
    }

    renderActiveDownload(download) {
        let element = document.getElementById(`download-${download.id}`);
        
        if (!element) {
            element = document.createElement('div');
            element.id = `download-${download.id}`;
            element.className = 'download-item';
            this.downloadsList.appendChild(element);
        }

        element.innerHTML = `
            <div class="download-header">
                <div class="download-info">
                    <h4>${download.title}</h4>
                    <p>${download.format.toUpperCase()} • ${download.quality} • ${download.status}</p>
                </div>
                <button onclick="app.cancelDownload('${download.id}')" class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${download.progress}%"></div>
            </div>
            <div class="progress-text">
                <span>${download.progress}%</span>
                <span>${download.speed || ''}</span>
            </div>
        `;
    }

    async startPolling(downloadId) {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`${this.API_URL}/api/status/${downloadId}`);
                const data = await response.json();
                
                const download = this.activeDownloads.get(downloadId);
                if (!download) {
                    clearInterval(interval);
                    return;
                }

                // Update download info
                download.status = data.status || 'Processing...';
                download.title = data.title || download.title;
                download.progress = parseInt(data.progress?.percentage || 0);
                download.speed = data.progress?.speed || '';

                this.renderActiveDownload(download);

                // Check if complete or failed
                if (data.status === 'Complete!' && data.filepath) {
                    clearInterval(interval);
                    this.handleDownloadComplete(downloadId, data);
                } else if (data.error) {
                    clearInterval(interval);
                    this.handleDownloadError(downloadId, data);
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 1000);
    }

    handleDownloadComplete(downloadId, data) {
        const download = this.activeDownloads.get(downloadId);
        if (!download) return;

        // Add to history
        this.downloadHistory.unshift({
            id: downloadId,
            title: data.title || 'Unknown',
            format: download.format,
            quality: download.quality,
            timestamp: Date.now(),
            filesize: data.filesize
        });

        // Keep only last 50 items
        if (this.downloadHistory.length > 50) {
            this.downloadHistory = this.downloadHistory.slice(0, 50);
        }

        localStorage.setItem('downloadHistory', JSON.stringify(this.downloadHistory));
        this.updateHistoryUI();

        // Trigger download
        const link = document.createElement('a');
        link.href = `${this.API_URL}/api/download-file/${downloadId}`;
        link.download = data.filename || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast(`✅ ${data.title} downloaded successfully!`, 'success');

        // Remove from active after delay
        setTimeout(() => this.removeActiveDownload(downloadId), 3000);
    }

    handleDownloadError(downloadId, data) {
        this.showToast(`❌ Download failed: ${data.status || 'Unknown error'}`, 'error');
        this.removeActiveDownload(downloadId);
    }

    removeActiveDownload(downloadId) {
        this.activeDownloads.delete(downloadId);
        const element = document.getElementById(`download-${downloadId}`);
        if (element) element.remove();

        if (this.activeDownloads.size === 0) {
            this.activeDownloadsCard.style.display = 'none';
        }
    }

    cancelDownload(downloadId) {
        fetch(`${this.API_URL}/api/cancel/${downloadId}`, { method: 'POST' });
        this.removeActiveDownload(downloadId);
        this.showToast('Download cancelled', 'info');
    }

    updateHistoryUI() {
        if (!this.historyList) return;

        if (this.downloadHistory.length === 0) {
            this.historyList.innerHTML = `
                <div class="empty">
                    <i class="fas fa-history"></i>
                    <p>No downloads yet</p>
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = this.downloadHistory.slice(0, 20).map(item => `
            <div class="download-item">
                <div class="download-info">
                    <h4>${item.title}</h4>
                    <p>
                        <i class="fas fa-file"></i> ${item.format?.toUpperCase() || 'MP4'} • 
                        <i class="fas fa-cog"></i> ${item.quality || '720p'} • 
                        <i class="fas fa-clock"></i> ${this.formatDate(item.timestamp)}
                        ${item.filesize ? ` • <i class="fas fa-weight"></i> ${this.formatFileSize(item.filesize)}` : ''}
                    </p>
                </div>
            </div>
        `).join('');
    }

    clearHistory() {
        if (this.downloadHistory.length === 0) {
            this.showToast('No history to clear', 'info');
            return;
        }

        if (confirm(`Are you sure you want to clear ${this.downloadHistory.length} items?`)) {
            this.downloadHistory = [];
            localStorage.setItem('downloadHistory', JSON.stringify(this.downloadHistory));
            this.updateHistoryUI();
            this.showToast('History cleared successfully', 'success');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span style="margin-left: 10px;">${message}</span>
        `;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return date.toLocaleDateString();
    }

    formatFileSize(bytes) {
        if (!bytes) return '';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
    }
}

// Initialize the app
const app = new YouTubeDownloader();
window.app = app;