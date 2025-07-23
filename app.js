// YouTube Segment Saver Application
class YouTubeSegmentSaver {
    constructor() {
        this.player = null;
        this.playerReady = false;
        this.currentSegment = null;
        this.currentPlaylist = null;
        this.playlistIndex = 0;
        this.isPlayingPlaylist = false;
        this.segments = [];
        this.playlists = [];
        this.currentUser = 'defaultUser';
        this.userProfiles = {};
        this.isDarkMode = false;
        
        this.init();
    }

    init() {
        // Load data from localStorage
        this.loadData();
        
        // Initialize UI
        this.initializeEventListeners();
        this.initializeTabs();
        this.initializeTheme();
        this.updateUI();
        
        // Initialize YouTube API when ready
        window.onYouTubeIframeAPIReady = () => {
            this.initializeYouTubePlayer();
        };
        
        // If API is already loaded
        if (window.YT && window.YT.Player) {
            this.initializeYouTubePlayer();
        }
    }

    // Data Management
    loadData() {
        const savedData = localStorage.getItem('ytSegmentSaver');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.currentUser = data.currentUser || 'defaultUser';
                this.userProfiles = data.profiles || {};
                
                // Ensure current user profile exists
                if (!this.userProfiles[this.currentUser]) {
                    this.userProfiles[this.currentUser] = this.createDefaultProfile();
                }
                
                const profile = this.userProfiles[this.currentUser];
                this.segments = profile.segments || [];
                this.playlists = profile.playlists || [];
                this.isDarkMode = profile.preferences?.darkMode || false;
                
                // Update user name display
                document.getElementById('userName').textContent = profile.name || 'User';
            } catch (error) {
                console.error('Error loading data:', error);
                this.createDefaultProfile();
            }
        } else {
            this.userProfiles[this.currentUser] = this.createDefaultProfile();
        }
    }

    saveData() {
        const profile = this.userProfiles[this.currentUser];
        profile.segments = this.segments;
        profile.playlists = this.playlists;
        profile.preferences = { darkMode: this.isDarkMode };
        
        const data = {
            currentUser: this.currentUser,
            profiles: this.userProfiles
        };
        
        localStorage.setItem('ytSegmentSaver', JSON.stringify(data));
    }

    createDefaultProfile() {
        return {
            name: 'User',
            segments: [],
            playlists: [],
            preferences: { darkMode: false }
        };
    }

    // YouTube Player
    initializeYouTubePlayer() {
        this.player = new YT.Player('ytPlayer', {
            height: '400',
            width: '100%',
            playerVars: {
                'playsinline': 1,
                'rel': 0,
                'modestbranding': 1
            },
            events: {
                'onReady': () => {
                    this.playerReady = true;
                    this.showToast('YouTube player ready!', 'success');
                },
                'onStateChange': (event) => {
                    this.onPlayerStateChange(event);
                }
            }
        });
    }

    onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            this.monitorSegmentPlayback();
        }
    }

    monitorSegmentPlayback() {
        if (!this.currentSegment || !this.playerReady) return;
        
        const checkTime = () => {
            if (!this.player || this.player.getPlayerState() !== YT.PlayerState.PLAYING) {
                return;
            }
            
            const currentTime = this.player.getCurrentTime();
            
            if (currentTime >= this.currentSegment.end) {
                if (this.isPlayingPlaylist) {
                    this.playNextInPlaylist();
                } else {
                    this.player.pauseVideo();
                }
                return;
            }
            
            requestAnimationFrame(checkTime);
        };
        
        requestAnimationFrame(checkTime);
    }

    playSegment(segment) {
        if (!this.playerReady) {
            this.showToast('Player not ready yet', 'error');
            return;
        }
        
        this.currentSegment = segment;
        this.isPlayingPlaylist = false;
        
        // Update UI
        document.getElementById('currentSegmentName').textContent = segment.name;
        this.updateSegmentPlayingState(segment.id);
        
        // Load and play video
        this.player.loadVideoById({
            videoId: segment.videoId,
            startSeconds: segment.start,
            endSeconds: segment.end
        });
        
        this.showToast(`Playing: ${segment.name}`, 'info');
    }

    playPlaylist(playlist) {
        if (!this.playerReady || playlist.segmentIds.length === 0) {
            this.showToast('Cannot play empty playlist', 'error');
            return;
        }
        
        this.currentPlaylist = playlist;
        this.playlistIndex = 0;
        this.isPlayingPlaylist = true;
        
        const firstSegmentId = playlist.segmentIds[0];
        const firstSegment = this.segments.find(s => s.id === firstSegmentId);
        
        if (firstSegment) {
            this.updatePlaylistPlayingState(playlist.id);
            this.playSegment(firstSegment);
            document.getElementById('currentSegmentName').textContent = 
                `${playlist.name} - ${firstSegment.name} (1/${playlist.segmentIds.length})`;
        }
    }

    playNextInPlaylist() {
        if (!this.isPlayingPlaylist || !this.currentPlaylist) return;
        
        this.playlistIndex++;
        
        if (this.playlistIndex >= this.currentPlaylist.segmentIds.length) {
            this.showToast('Playlist finished!', 'success');
            this.isPlayingPlaylist = false;
            this.currentPlaylist = null;
            this.updatePlaylistPlayingState(null);
            return;
        }
        
        const nextSegmentId = this.currentPlaylist.segmentIds[this.playlistIndex];
        const nextSegment = this.segments.find(s => s.id === nextSegmentId);
        
        if (nextSegment) {
            this.playSegment(nextSegment);
            document.getElementById('currentSegmentName').textContent = 
                `${this.currentPlaylist.name} - ${nextSegment.name} (${this.playlistIndex + 1}/${this.currentPlaylist.segmentIds.length})`;
        }
    }

    playPreviousInPlaylist() {
        if (!this.isPlayingPlaylist || !this.currentPlaylist) return;
        
        this.playlistIndex = Math.max(0, this.playlistIndex - 1);
        
        const prevSegmentId = this.currentPlaylist.segmentIds[this.playlistIndex];
        const prevSegment = this.segments.find(s => s.id === prevSegmentId);
        
        if (prevSegment) {
            this.playSegment(prevSegment);
            document.getElementById('currentSegmentName').textContent = 
                `${this.currentPlaylist.name} - ${prevSegment.name} (${this.playlistIndex + 1}/${this.currentPlaylist.segmentIds.length})`;
        }
    }

    // Segment Management
    addSegment(data) {
        // Extract values and validate
        const videoUrl = data.videoUrl?.trim();
        const segmentName = data.segmentName?.trim();
        const startTime = parseFloat(data.startTime);
        const endTime = parseFloat(data.endTime);

        if (!videoUrl) {
            this.showToast('Please enter a YouTube URL', 'error');
            return;
        }

        if (!segmentName) {
            this.showToast('Please enter a segment name', 'error');
            return;
        }

        if (isNaN(startTime) || startTime < 0) {
            this.showToast('Please enter a valid start time', 'error');
            return;
        }

        if (isNaN(endTime) || endTime <= 0) {
            this.showToast('Please enter a valid end time', 'error');
            return;
        }

        const videoId = this.extractVideoId(videoUrl);
        if (!videoId) {
            this.showToast('Invalid YouTube URL', 'error');
            return;
        }

        if (startTime >= endTime) {
            this.showToast('End time must be greater than start time', 'error');
            return;
        }

        const segment = {
            id: 'seg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: segmentName,
            videoId: videoId,
            start: parseInt(startTime),
            end: parseInt(endTime),
            dateCreated: new Date().toISOString()
        };

        this.segments.push(segment);
        this.saveData();
        this.updateUI();
        this.showToast('Segment saved successfully!', 'success');
        
        // Reset form
        document.getElementById('segmentForm').reset();
    }

    deleteSegment(segmentId) {
        this.segments = this.segments.filter(s => s.id !== segmentId);
        
        // Remove from playlists
        this.playlists.forEach(playlist => {
            playlist.segmentIds = playlist.segmentIds.filter(id => id !== segmentId);
        });
        
        this.saveData();
        this.updateUI();
        this.showToast('Segment deleted', 'info');
    }

    extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }

    // Playlist Management
    createPlaylist(data) {
        const playlistName = data.playlistName?.trim();
        const selectedSegments = data.selectedSegments || [];

        if (!playlistName) {
            this.showToast('Please enter a playlist name', 'error');
            return;
        }

        if (selectedSegments.length === 0) {
            this.showToast('Please select at least one segment', 'error');
            return;
        }

        const playlist = {
            id: 'playlist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: playlistName,
            segmentIds: selectedSegments,
            dateCreated: new Date().toISOString()
        };

        this.playlists.push(playlist);
        this.saveData();
        this.updateUI();
        this.showToast('Playlist created successfully!', 'success');
        
        // Reset form
        document.getElementById('playlistForm').reset();
    }

    deletePlaylist(playlistId) {
        this.playlists = this.playlists.filter(p => p.id !== playlistId);
        this.saveData();
        this.updateUI();
        this.showToast('Playlist deleted', 'info');
    }

    // UI Management
    initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Forms
        document.getElementById('segmentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get form values directly from inputs
            const videoUrl = document.getElementById('videoUrl').value;
            const segmentName = document.getElementById('segmentName').value;
            const startTime = document.getElementById('startTime').value;
            const endTime = document.getElementById('endTime').value;
            
            this.addSegment({
                videoUrl: videoUrl,
                segmentName: segmentName,
                startTime: startTime,
                endTime: endTime
            });
        });

        document.getElementById('playlistForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const selectedSegments = Array.from(document.querySelectorAll('input[name="segments"]:checked'))
                .map(cb => cb.value);
            
            this.createPlaylist({
                playlistName: document.getElementById('playlistName').value,
                selectedSegments: selectedSegments
            });
        });

        // Player controls
        document.getElementById('nextSegment').addEventListener('click', () => {
            this.playNextInPlaylist();
        });

        document.getElementById('prevSegment').addEventListener('click', () => {
            this.playPreviousInPlaylist();
        });

        // Dark mode toggle
        document.getElementById('darkModeToggle').addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // User settings
        document.getElementById('userSettings').addEventListener('click', () => {
            this.openUserModal();
        });

        document.getElementById('saveUserSettings').addEventListener('click', () => {
            this.saveUserSettings();
        });

        // Modals
        document.getElementById('closeShareModal').addEventListener('click', () => {
            this.closeModal('shareModal');
        });

        document.getElementById('closeUserModal').addEventListener('click', () => {
            this.closeModal('userModal');
        });

        // Share functionality
        document.getElementById('copyLink').addEventListener('click', () => {
            this.copyToClipboard();
        });

        document.querySelectorAll('.share-social').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.shareToSocial(e.target.dataset.platform);
            });
        });

        // Data management
        document.getElementById('exportSegments').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('importSegmentsBtn').addEventListener('click', () => {
            document.getElementById('importSegments').click();
        });

        document.getElementById('importSegments').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        document.getElementById('backupData').addEventListener('click', () => {
            this.backupAllData();
        });

        document.getElementById('clearData').addEventListener('click', () => {
            this.clearAllData();
        });

        // Modal click outside to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    initializeTabs() {
        this.switchTab('segments');
    }

    switchTab(tabName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.toggle('active', tab.id === tabName + 'Tab');
        });

        // Update playlist form if switching to playlists
        if (tabName === 'playlists') {
            this.updateSegmentSelection();
        }
    }

    updateUI() {
        this.renderSegments();
        this.renderPlaylists();
        this.updateSegmentSelection();
    }

    renderSegments() {
        const container = document.getElementById('segmentsList');
        
        if (this.segments.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No segments saved yet. Add your first segment above!</p></div>';
            return;
        }

        container.innerHTML = this.segments.map(segment => `
            <div class="segment-item" data-segment-id="${segment.id}" tabindex="0">
                <div class="segment-info">
                    <div class="segment-name">${this.escapeHtml(segment.name)}</div>
                    <div class="segment-details">
                        <span class="segment-duration">${this.formatTime(segment.start)} - ${this.formatTime(segment.end)}</span>
                        <span style="margin-left: 12px; color: var(--color-text-secondary);">
                            ${new Date(segment.dateCreated).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                <div class="segment-actions">
                    <button class="action-btn" onclick="app.playSegment(app.segments.find(s => s.id === '${segment.id}'))">▶️ Play</button>
                    <button class="action-btn" onclick="app.shareSegment('${segment.id}')">📤 Share</button>
                    <button class="action-btn action-btn--danger" onclick="app.deleteSegment('${segment.id}')">🗑️ Delete</button>
                </div>
            </div>
        `).join('');

        // Add click listeners for segment items
        container.querySelectorAll('.segment-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.segment-actions')) {
                    const segmentId = item.dataset.segmentId;
                    const segment = this.segments.find(s => s.id === segmentId);
                    if (segment) this.playSegment(segment);
                }
            });
        });
    }

    renderPlaylists() {
        const container = document.getElementById('playlistsList');
        
        if (this.playlists.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No playlists created yet. Create your first playlist above!</p></div>';
            return;
        }

        container.innerHTML = this.playlists.map(playlist => `
            <div class="playlist-item" data-playlist-id="${playlist.id}" tabindex="0">
                <div class="playlist-info">
                    <div class="playlist-name">
                        ${this.escapeHtml(playlist.name)}
                        <span class="playlist-counter">${playlist.segmentIds.length}</span>
                    </div>
                    <div class="playlist-details">
                        ${playlist.segmentIds.length} segment${playlist.segmentIds.length !== 1 ? 's' : ''} • 
                        ${new Date(playlist.dateCreated).toLocaleDateString()}
                    </div>
                </div>
                <div class="playlist-actions">
                    <button class="action-btn" onclick="app.playPlaylist(app.playlists.find(p => p.id === '${playlist.id}'))">▶️ Play All</button>
                    <button class="action-btn" onclick="app.sharePlaylist('${playlist.id}')">📤 Share</button>
                    <button class="action-btn action-btn--danger" onclick="app.deletePlaylist('${playlist.id}')">🗑️ Delete</button>
                </div>
            </div>
        `).join('');

        // Add click listeners for playlist items
        container.querySelectorAll('.playlist-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.playlist-actions')) {
                    const playlistId = item.dataset.playlistId;
                    const playlist = this.playlists.find(p => p.id === playlistId);
                    if (playlist) this.playPlaylist(playlist);
                }
            });
        });
    }

    updateSegmentSelection() {
        const container = document.getElementById('segmentSelection');
        
        if (this.segments.length === 0) {
            container.innerHTML = '<p class="text-secondary">No segments available. Create some segments first!</p>';
            return;
        }

        container.innerHTML = this.segments.map(segment => `
            <label class="segment-checkbox">
                <input type="checkbox" name="segments" value="${segment.id}">
                <span>${this.escapeHtml(segment.name)} (${this.formatTime(segment.start)} - ${this.formatTime(segment.end)})</span>
            </label>
        `).join('');
    }

    updateSegmentPlayingState(playingSegmentId) {
        document.querySelectorAll('.segment-item').forEach(item => {
            item.classList.toggle('playing', item.dataset.segmentId === playingSegmentId);
        });
    }

    updatePlaylistPlayingState(playingPlaylistId) {
        document.querySelectorAll('.playlist-item').forEach(item => {
            item.classList.toggle('playing', item.dataset.playlistId === playingPlaylistId);
        });
    }

    // Theme Management
    initializeTheme() {
        document.body.setAttribute('data-color-scheme', this.isDarkMode ? 'dark' : 'light');
        this.updateDarkModeButton();
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        document.body.setAttribute('data-color-scheme', this.isDarkMode ? 'dark' : 'light');
        this.updateDarkModeButton();
        this.saveData();
        this.showToast(`${this.isDarkMode ? 'Dark' : 'Light'} mode enabled`, 'info');
    }

    updateDarkModeButton() {
        const button = document.getElementById('darkModeToggle');
        button.textContent = this.isDarkMode ? '☀️' : '🌙';
        button.title = `Switch to ${this.isDarkMode ? 'light' : 'dark'} mode`;
    }

    // Modal Management
    openShareModal(title, shareUrl) {
        document.getElementById('shareTitle').textContent = title;
        document.getElementById('shareLink').value = shareUrl;
        document.getElementById('shareModal').classList.add('active');
    }

    openUserModal() {
        document.getElementById('userNameInput').value = this.userProfiles[this.currentUser].name;
        document.getElementById('userModal').classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    // Sharing
    shareSegment(segmentId) {
        const segment = this.segments.find(s => s.id === segmentId);
        if (!segment) return;

        const shareUrl = `${window.location.origin}${window.location.pathname}?segment=${segmentId}`;
        this.openShareModal(`Share Segment: ${segment.name}`, shareUrl);
    }

    sharePlaylist(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) return;

        const shareUrl = `${window.location.origin}${window.location.pathname}?playlist=${playlistId}`;
        this.openShareModal(`Share Playlist: ${playlist.name}`, shareUrl);
    }

    copyToClipboard() {
        const input = document.getElementById('shareLink');
        input.select();
        document.execCommand('copy');
        this.showToast('Link copied to clipboard!', 'success');
    }

    shareToSocial(platform) {
        const shareLink = document.getElementById('shareLink').value;
        const title = document.getElementById('shareTitle').textContent;
        
        let url;
        switch (platform) {
            case 'twitter':
                url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareLink)}`;
                break;
            case 'facebook':
                url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`;
                break;
            case 'reddit':
                url = `https://reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(shareLink)}`;
                break;
        }
        
        if (url) {
            window.open(url, '_blank', 'width=600,height=400');
        }
    }

    // Data Import/Export
    exportData() {
        const data = {
            segments: this.segments,
            playlists: this.playlists,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube-segments-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Data exported successfully!', 'success');
    }

    importData(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.segments && Array.isArray(data.segments)) {
                    this.segments = [...this.segments, ...data.segments];
                }
                
                if (data.playlists && Array.isArray(data.playlists)) {
                    this.playlists = [...this.playlists, ...data.playlists];
                }
                
                this.saveData();
                this.updateUI();
                this.showToast('Data imported successfully!', 'success');
            } catch (error) {
                this.showToast('Error importing data: Invalid file format', 'error');
            }
        };
        reader.readAsText(file);
    }

    backupAllData() {
        const allData = {
            currentUser: this.currentUser,
            profiles: this.userProfiles,
            backupDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube-segment-saver-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Full backup created!', 'success');
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            localStorage.removeItem('ytSegmentSaver');
            this.segments = [];
            this.playlists = [];
            this.userProfiles = { [this.currentUser]: this.createDefaultProfile() };
            this.updateUI();
            this.closeModal('userModal');
            this.showToast('All data cleared', 'info');
        }
    }

    saveUserSettings() {
        const newName = document.getElementById('userNameInput').value.trim();
        if (newName) {
            this.userProfiles[this.currentUser].name = newName;
            document.getElementById('userName').textContent = newName;
            this.saveData();
            this.showToast('Settings saved!', 'success');
        }
        this.closeModal('userModal');
    }

    // Toast Notifications
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Utility Functions
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Handle shared URLs
    handleSharedContent() {
        const urlParams = new URLSearchParams(window.location.search);
        const segmentId = urlParams.get('segment');
        const playlistId = urlParams.get('playlist');
        
        if (segmentId) {
            const segment = this.segments.find(s => s.id === segmentId);
            if (segment) {
                setTimeout(() => this.playSegment(segment), 1000);
                this.showToast('Playing shared segment', 'info');
            }
        } else if (playlistId) {
            const playlist = this.playlists.find(p => p.id === playlistId);
            if (playlist) {
                this.switchTab('playlists');
                setTimeout(() => this.playPlaylist(playlist), 1000);
                this.showToast('Playing shared playlist', 'info');
            }
        }
    }
}

// Initialize the application
const app = new YouTubeSegmentSaver();

// Handle shared content after initialization
document.addEventListener('DOMContentLoaded', () => {
    app.handleSharedContent();
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
    app.handleSharedContent();
});

// Global error handling
window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    app.showToast('An error occurred. Please try again.', 'error');
});

// Service Worker registration for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Can register a service worker here for offline functionality
        console.log('App loaded - ready for service worker registration');
    });
}