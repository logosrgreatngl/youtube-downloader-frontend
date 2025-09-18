class YouTubeDownloaderPro {
    constructor() {
        this.activeDownloads = new Map();
        this.downloadHistory = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
        this.playlistVideos = [];
        this.searchResults = [];
        this.gifVideoInfo = null;
        this.downloadQueue = [];
        this.maxConcurrentDownloads = 3;
        this.activeDownloadCount = 0;

        
        this.initializeElements();
        this.bindEvents();
        this.updateHistoryUI();
    }

    initializeElements() {
        // Single download
        this.urlInput = document.getElementById('urlInput');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.qualitySelect = document.getElementById('qualitySelect');
        
        // Search
        this.searchQuery = document.getElementById('searchQuery');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResultsEl = document.getElementById('searchResults');
        
        // Batch
        this.batchUrls = document.getElementById('batchUrls');
        this.batchFormat = document.getElementById('batchFormat');
        this.batchQuality = document.getElementById('batchQuality');
        
        // Playlist
        this.playlistUrl = document.getElementById('playlistUrl');
        this.playlistVideos = document.getElementById('playlistVideos');
        this.playlistInfo = document.getElementById('playlistInfo');
        this.playlistFormat = document.getElementById('playlistFormat');
        this.playlistQuality = document.getElementById('playlistQuality');
        
        // GIF
        this.gifUrl = document.getElementById('gifUrl');
        this.loadVideoBtn = document.getElementById('loadVideoBtn');
        this.gifSettings = document.getElementById('gifSettings');
        this.gifStartTime = document.getElementById('gifStartTime');
        this.gifDuration = document.getElementById('gifDuration');
        this.gifQuality = document.getElementById('gifQuality');
        
        // Common
        this.activeDownloadsContainer = document.getElementById('activeDownloads');
        this.downloadsList = document.getElementById('downloadsList');
        this.historyList = document.getElementById('historyList');
        this.toastContainer = document.getElementById('toastContainer');
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                const tabName = tab.dataset.tab;
                document.getElementById(`${tabName}Tab`)?.classList.add('active');
            });
        });

        // Format buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const format = btn.dataset.format;
                if (this.qualitySelect) {
                    this.qualitySelect.disabled = (format === 'mp3');
                    this.qualitySelect.style.opacity = format === 'mp3' ? '0.5' : '1';
                }
            });
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

        // Search
        if (this.searchBtn) {
            this.searchBtn.addEventListener('click', () => this.performSearch());
        }
        
        if (this.searchQuery) {
            this.searchQuery.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
        }

        // GIF
        if (this.loadVideoBtn) {
            this.loadVideoBtn.addEventListener('click', () => this.loadVideoForGif());
        }
    }

    // === SINGLE DOWNLOAD ===
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
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, format, quality })
            });

            const data = await response.json();
            if (data.download_id) {
                this.addActiveDownload(data.download_id, { url, format, quality });
                this.startPolling(data.download_id);
                this.showToast('Download started!', 'success');
                this.urlInput.value = '';
            }
        } catch (error) {
            this.showToast('Download failed: ' + error.message, 'error');
        } finally {
            this.downloadBtn.disabled = false;
            this.downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
        }
    }

    // === SEARCH ===
    async performSearch() {
        const query = this.searchQuery?.value.trim();
        if (!query) {
            this.showToast('Please enter a search query', 'error');
            return;
        }

        this.searchBtn.disabled = true;
        this.searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        this.searchResultsEl.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #ff0000;"></i>
                <p style="margin-top: 10px;">Searching...</p>
            </div>
        `;

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            if (data.results && data.results.length > 0) {
                this.searchResults = data.results;
                this.displaySearchResults();
                this.showToast(`Found ${data.results.length} videos`, 'success');
            } else {
                this.searchResultsEl.innerHTML = `
                    <div class="empty">
                        <i class="fas fa-search-minus"></i>
                        <p>No results found</p>
                    </div>
                `;
            }
        } catch (error) {
            this.showToast('Search failed', 'error');
        } finally {
            this.searchBtn.disabled = false;
            this.searchBtn.innerHTML = '<i class="fas fa-search"></i>';
        }
    }

    displaySearchResults() {
        this.searchResultsEl.innerHTML = this.searchResults.map((video, index) => `
            <div class="search-result-item">
                <img src="${video.thumbnail || ''}" class="search-result-thumbnail" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"180\" height=\"100\"><rect fill=\"%23333\" width=\"180\" height=\"100\"/></svg>'">
                
                <div class="search-result-info">
                    <h3 class="search-result-title">${video.title || 'Unknown'}</h3>
                    
                    <div class="search-result-meta">
                        <span><i class="fas fa-user"></i> ${video.uploader || 'Unknown'}</span>
                        <span><i class="fas fa-eye"></i> ${this.formatNumber(video.view_count || 0)} views</span>
                        <span><i class="fas fa-clock"></i> ${this.formatDuration(video.duration || 0)}</span>
                    </div>
                    
                    <div class="search-result-actions">
                        <button onclick="app.downloadFromSearch(${index})" class="btn btn-primary btn-sm">
                            <i class="fas fa-download"></i> MP4
                        </button>
                        <button onclick="app.downloadFromSearch(${index}, 'mp3')" class="btn btn-secondary btn-sm">
                            <i class="fas fa-music"></i> MP3
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async downloadFromSearch(index, format = 'mp4') {
        const video = this.searchResults[index];
        if (!video) return;

        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: video.url,
                    format,
                    quality: '720p'
                })
            });

            const data = await response.json();
            if (data.download_id) {
                this.addActiveDownload(data.download_id, { url: video.url, format, quality: '720p' });
                this.startPolling(data.download_id);
                this.showToast(`Downloading: ${video.title}`, 'success');
            }
        } catch (error) {
            this.showToast('Download failed', 'error');
        }
    }

    // === BATCH DOWNLOAD ===
    async startBatchDownload() {
        const urls = this.batchUrls?.value.trim().split('\n').filter(u => u.trim());
        if (!urls.length) {
            this.showToast('Please enter at least one URL', 'error');
            return;
        }

        const format = this.batchFormat?.value || 'mp4';
        const quality = this.batchQuality?.value || '720p';

        for (const url of urls) {
            try {
                const response = await fetch('/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: url.trim(), format, quality })
                });

                const data = await response.json();
                if (data.download_id) {
                    this.addActiveDownload(data.download_id, { url, format, quality });
                    this.startPolling(data.download_id);
                }
            } catch (error) {
                console.error('Batch download error:', error);
            }
        }

        this.showToast(`Started ${urls.length} downloads`, 'success');
        this.batchUrls.value = '';
    }

    // === PLAYLIST ===
    async loadPlaylist() {
        const url = this.playlistUrl?.value.trim();
        if (!url) {
            this.showToast('Please enter a playlist URL', 'error');
            return;
        }

        try {
            const response = await fetch('/api/playlist-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await response.json();
            if (data.videos) {
                this.playlistVideosData = data.videos;
                this.displayPlaylistVideos(data);
                this.playlistInfo.classList.remove('hidden');
                this.showToast(`Loaded ${data.videos.length} videos`, 'success');
            }
        } catch (error) {
            this.showToast('Failed to load playlist', 'error');
        }
    }

    displayPlaylistVideos(data) {
        this.playlistVideos.innerHTML = data.videos.map((video, index) => `
            <div class="video-item">
                <input type="checkbox" value="${index}" checked>
                <img src="${video.thumbnail || ''}" alt="${video.title}">
                <div class="video-info">
                    <div class="video-title">${video.title}</div>
                    <div class="video-meta">Duration: ${this.formatDuration(video.duration)}</div>
                </div>
            </div>
        `).join('');
    }

    selectAllVideos() {
        document.querySelectorAll('#playlistVideos input[type="checkbox"]').forEach(cb => cb.checked = true);
    }

    deselectAllVideos() {
        document.querySelectorAll('#playlistVideos input[type="checkbox"]').forEach(cb => cb.checked = false);
    }

    async downloadSelectedVideos() {
        const checkboxes = document.querySelectorAll('#playlistVideos input[type="checkbox"]:checked');
        const format = this.playlistFormat?.value || 'mp4';
        const quality = this.playlistQuality?.value || '720p';

        for (const checkbox of checkboxes) {
            const video = this.playlistVideosData[checkbox.value];
            if (video) {
                try {
                    const response = await fetch('/api/download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: video.url, format, quality })
                    });

                    const data = await response.json();
                    if (data.download_id) {
                        this.addActiveDownload(data.download_id, { url: video.url, format, quality });
                        this.startPolling(data.download_id);
                    }
                } catch (error) {
                    console.error('Playlist download error:', error);
                }
            }
        }

        this.showToast(`Started downloading ${checkboxes.length} videos`, 'success');
    }

    // === GIF MAKER ===
    async loadVideoForGif() {
        const url = this.gifUrl?.value.trim();
        if (!url) {
            this.showToast('Please enter a YouTube URL', 'error');
            return;
        }

        this.loadVideoBtn.disabled = true;
        this.loadVideoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

        try {
            const response = await fetch('/api/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await response.json();
            if (data) {
                this.gifVideoInfo = data;
                this.gifSettings.classList.remove('hidden');
                this.showToast('Video loaded! Configure your GIF settings', 'success');
            }
        } catch (error) {
            this.showToast('Failed to load video', 'error');
        } finally {
            this.loadVideoBtn.disabled = false;
            this.loadVideoBtn.innerHTML = '<i class="fas fa-video"></i> Load Video';
        }
    }

    async createGif() {
        if (!this.gifVideoInfo) {
            this.showToast('Please load a video first', 'error');
            return;
        }

        const startTime = parseInt(this.gifStartTime?.value || 0);
        const duration = parseInt(this.gifDuration?.value || 5);
        const quality = this.gifQuality?.value || 'medium';

        try {
            const response = await fetch('/api/create-gif', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: this.gifUrl.value,
                    start_time: startTime,
                    end_time: startTime + duration,
                    quality,
                    fps: quality === 'high' ? 20 : quality === 'low' ? 10 : 15,
                    width: quality === 'high' ? 640 : quality === 'low' ? 320 : 480
                })
            });

            const data = await response.json();
            if (data.download_id) {
                this.addActiveDownload(data.download_id, { 
                    url: this.gifUrl.value, 
                    format: 'gif', 
                    quality 
                });
                this.startPolling(data.download_id);
                this.showToast('Creating GIF...', 'success');
            }
        } catch (error) {
            this.showToast('Failed to create GIF', 'error');
        }
    }
async processDownloadQueue() {
    while (this.downloadQueue.length > 0 && this.activeDownloadCount < this.maxConcurrentDownloads) {
        const download = this.downloadQueue.shift();
        this.activeDownloadCount++;
        await this.startDownload(download);
    }
}

    // === DOWNLOAD MANAGEMENT ===
    addActiveDownload(downloadId, options) {
        const download = {
            id: downloadId,
            url: options.url,
            format: options.format,
            quality: options.quality,
            startTime: Date.now(),
            status: 'Initializing...',
            progress: 0
        };

        this.activeDownloads.set(downloadId, download);
        this.activeDownloadsContainer.classList.remove('hidden');
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
                    <h4>${download.title || 'Downloading...'}</h4>
                    <p>${download.format.toUpperCase()} • ${download.quality} • ${download.status}</p>
                </div>
                <button onclick="app.cancelDownload('${download.id}')" class="btn btn-secondary btn-sm">
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
                const response = await fetch(`/api/status/${downloadId}`);
                const data = await response.json();
                
                const download = this.activeDownloads.get(downloadId);
                if (!download) {
                    clearInterval(interval);
                    return;
                }

                download.status = data.status || 'Processing...';
                download.title = data.title || download.title;
                download.progress = parseInt(data.progress?.percentage || 0);
                download.speed = data.progress?.speed || '';

                this.renderActiveDownload(download);

                if (data.status === 'Complete!' && data.filepath) {
                    clearInterval(interval);
                    this.handleDownloadComplete(downloadId, data);
                } else if (data.error) {
                    clearInterval(interval);
                    this.showToast('Download failed', 'error');
                    this.removeActiveDownload(downloadId);
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
            title: data.title || 'Unknown',
            format: download.format,
            quality: download.quality,
            timestamp: Date.now()
        });

        if (this.downloadHistory.length > 50) {
            this.downloadHistory = this.downloadHistory.slice(0, 50);
        }

        localStorage.setItem('downloadHistory', JSON.stringify(this.downloadHistory));
        this.updateHistoryUI();

        // Download file
        window.open(`/api/download-file/${downloadId}`, '_blank');

        this.showToast(`✅ ${data.title} ready!`, 'success');
        setTimeout(() => this.removeActiveDownload(downloadId), 3000);
    }

    removeActiveDownload(downloadId) {
        this.activeDownloads.delete(downloadId);
        document.getElementById(`download-${downloadId}`)?.remove();
        
        if (this.activeDownloads.size === 0) {
            this.activeDownloadsContainer.classList.add('hidden');
        }
    }

    cancelDownload(downloadId) {
        fetch(`/api/cancel/${downloadId}`, { method: 'POST' });
        this.removeActiveDownload(downloadId);
        this.showToast('Download cancelled', 'info');
    }

    // === HISTORY ===
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
                    <p>${item.format?.toUpperCase()} • ${item.quality} • ${this.formatDate(item.timestamp)}</p>
                </div>
            </div>
        `).join('');
    }

    clearHistory() {
        if (confirm('Clear all history?')) {
            this.downloadHistory = [];
            localStorage.setItem('downloadHistory', JSON.stringify(this.downloadHistory));
            this.updateHistoryUI();
            this.showToast('History cleared', 'success');
        }
    }

    // === UTILITIES ===
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
            <span>${message}</span>
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
        return date.toLocaleDateString();
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    formatDuration(seconds) {
        if (!seconds) return 'N/A';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}

// Initialize
const app = new YouTubeDownloaderPro();
window.app = app;