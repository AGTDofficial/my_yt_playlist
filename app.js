// YouTube Segment Saver Application

// Compression Utilities
const DataCompressor = {
    // Simple compression using JSON.stringify and base64 encoding
    compress: function(data) {
        try {
            const jsonString = JSON.stringify(data);
            // Simple base64 encoding as a basic compression
            const base64 = btoa(unescape(encodeURIComponent(jsonString)));
            // Add version marker
            return `C1${base64}`; // C1 = Compression version 1
        } catch (error) {
            console.error('Compression error:', error);
            return JSON.stringify(data); // Fallback to regular JSON
        }
    },
    
    decompress: function(compressedData) {
        try {
            // Check if data is compressed (starts with C1)
            if (compressedData.startsWith('C1')) {
                const base64 = compressedData.substring(2);
                const jsonString = decodeURIComponent(escape(atob(base64)));
                return JSON.parse(jsonString);
            }
            // If not compressed, parse as regular JSON
            return JSON.parse(compressedData);
        } catch (error) {
            console.error('Decompression error:', error);
            try {
                // Try to parse as regular JSON if decompression fails
                return JSON.parse(compressedData);
            } catch (e) {
                console.error('Failed to parse data:', e);
                return null;
            }
        }
    }
};
class YouTubeSegmentSaver {
    // ... existing code ...
    
    /**
     * Updates the pagination UI (shows/hides the Load More button)
     */
    updatePagination() {
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (!loadMoreContainer) {
            console.warn('Load More container not found in DOM');
            return;
        }
        
        const totalSegments = this.segments.length;
        const displayedSegments = document.querySelectorAll('#segmentsList .segment-item').length;
        
        console.log(`Update Pagination - Total: ${totalSegments}, Displayed: ${displayedSegments}, Current Page: ${this.currentPage}`);
        
        if (totalSegments === 0 || displayedSegments >= totalSegments) {
            console.log('Hiding Load More - All segments are displayed or no segments exist');
            loadMoreContainer.style.display = 'none';
        } else {
            console.log('Showing Load More - More segments available');
            loadMoreContainer.style.display = 'block';
        }
    }
    
    /**
     * Loads more segments when the Load More button is clicked
     */
    loadMoreSegments() {
        console.group('loadMoreSegments');
        console.log('Initial state - Current page:', this.currentPage, 'Loading:', this.isLoading);
        
        if (this.isLoading) {
            console.log('Load more already in progress');
            console.groupEnd();
            return;
        }
        
        this.isLoading = true;
        
        // Show loading indicator
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (!loadMoreBtn) {
            console.error('Load More button not found in DOM');
            this.isLoading = false;
            console.groupEnd();
            return;
        }
        
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (!loadMoreContainer) {
            console.error('Load More container not found in DOM');
            this.isLoading = false;
            console.groupEnd();
            return;
        }
        
        console.log('DOM elements found, proceeding with load more');
        
        const originalText = loadMoreBtn.textContent;
        loadMoreBtn.disabled = true;
        loadMoreBtn.classList.add('loading');
        loadMoreBtn.textContent = 'Loading...';
        
        // Small delay to show loading state and allow UI to update
        requestAnimationFrame(() => {
            try {
                // Get current segment count before render
                const segmentsBefore = document.querySelectorAll('#segmentsList .segment-item').length;
                console.log('Segments before render:', segmentsBefore);
                
                // Increment page before rendering
                this.currentPage++;
                console.log('Page incremented to:', this.currentPage);
                
                // Only render segments, don't call updateUI() as it would reset pagination
                console.log('Calling renderSegments()');
                this.renderSegments();
                
                // Get segment count after render
                const segmentsAfter = document.querySelectorAll('#segmentsList .segment-item').length;
                console.log('Segments after render:', segmentsAfter, 'New segments:', segmentsAfter - segmentsBefore);
                
                // Update pagination controls
                console.log('Updating pagination');
                this.updatePagination();
                
                // Scroll to show newly loaded items after a small delay to allow DOM to update
                requestAnimationFrame(() => {
                    const segmentsList = document.getElementById('segmentsList');
                    if (segmentsList) {
                        const segments = segmentsList.querySelectorAll('.segment-item');
                        console.log('Total segments found after render:', segments.length);
                        
                        if (segments.length > 0) {
                            // Only scroll if we have new segments
                            if (segments.length > segmentsBefore) {
                                console.log('Scrolling to last segment');
                                segments[segments.length - 1].scrollIntoView({ 
                                    behavior: 'smooth', 
                                    block: 'nearest' 
                                });
                            } else {
                                console.log('No new segments to scroll to');
                            }
                        }
                    }
                });
                
            } catch (error) {
                console.error('Error in loadMoreSegments:', error);
                // Revert page increment on error
                this.currentPage = Math.max(1, this.currentPage - 1);
                console.error('Reverted to page:', this.currentPage);
                
                // Show error to user
                this.showToast('Failed to load more segments', 'error');
                
            } finally {
                // Always restore button state
                if (loadMoreBtn) {
                    loadMoreBtn.disabled = false;
                    loadMoreBtn.textContent = 'Load More Segments';
                    loadMoreBtn.classList.remove('loading');
                }
                
                this.isLoading = false;
                
                // Debug: Log final state
                console.log('Load more completed. Final state:');
                console.log('- Current page:', this.currentPage);
                console.log('- Total segments in DOM:', document.querySelectorAll('#segmentsList .segment-item').length);
                console.log('- Total segments in memory:', this.segments.length);
                console.groupEnd();
            }
        });
    }
    
    /**
     * Handles scroll events for infinite scrolling (optional)
     */
    handleScroll() {
        if (this.isLoading) return;
        
        // Check if we're near the bottom of the page
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
            const totalSegments = this.segments.length;
            const displayedSegments = document.querySelectorAll('#segmentsList .segment-item').length;
            
            if (displayedSegments < totalSegments) {
                this.loadMoreSegments();
            }
        }
    }
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
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.isLoading = false;
        
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
        
        // Add Load More button event listener
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadMoreSegments();
            });
            console.log('Load More button event listener added');
        } else {
            console.error('Load More button not found in DOM');
        }
        
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
                // Try to decompress the data first
                const data = DataCompressor.decompress(savedData);
                
                if (!data) {
                    throw new Error('Failed to decompress data');
                }
                
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
                this.itemsPerPage = profile.preferences?.itemsPerPage || 10;
                this.currentPage = 1;
                
                // Update user name display
                document.getElementById('userName').textContent = profile.name || 'User';
            } catch (error) {
                console.error('Error loading data:', error);
                this.createDefaultProfile();
                this.itemsPerPage = 10;
                this.currentPage = 1;
            }
        } else {
            this.userProfiles[this.currentUser] = this.createDefaultProfile();
            this.itemsPerPage = 10;
            this.currentPage = 1;
        }
        
        // Initialize pagination
        this.initializePagination();
    }

    saveData() {
        const profile = this.userProfiles[this.currentUser];
        profile.segments = this.segments;
        profile.playlists = this.playlists;
        profile.preferences = { 
            darkMode: this.isDarkMode,
            itemsPerPage: this.itemsPerPage || 10
        };
        
        const data = {
            currentUser: this.currentUser,
            profiles: this.userProfiles,
            _version: '1.1.0',
            _lastUpdated: new Date().toISOString()
        };
        
        // Compress data before saving
        const compressedData = DataCompressor.compress(data);
        localStorage.setItem('ytSegmentSaver', compressedData);
        
        // Update pagination if available
        if (this.updatePagination) {
            this.updatePagination();
        }
    }

    createDefaultProfile() {
        return {
            name: 'User',
            segments: [],
            playlists: [],
            preferences: { 
                darkMode: false,
                itemsPerPage: 10
            }
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
        if (!this.player) return;
        
        // Update the current segment
        this.currentSegment = segment;
        
        // Update the current segment name display
        const currentSegmentName = document.getElementById('currentSegmentName');
        if (currentSegmentName) {
            let displayText = segment.name;
            if (this.isPlayingPlaylist && this.currentPlaylist) {
                const currentIndex = this.currentPlaylist.segmentIds.findIndex(id => id === segment.id);
                if (currentIndex >= 0) {
                    displayText = `${this.currentPlaylist.name} - ${segment.name} (${currentIndex + 1}/${this.currentPlaylist.segmentIds.length})`;
                }
            }
            currentSegmentName.textContent = displayText;
        }
        
        // Load and play the segment
        this.player.loadVideoById({
            videoId: segment.videoId,
            startSeconds: segment.start,
            endSeconds: segment.end
        });
        
        // Show the player if it's hidden
        const playerContainer = document.getElementById('playerContainer');
        if (playerContainer) {
            playerContainer.style.display = 'block';
        }
        
        // Highlight the currently playing segment in the UI
        this.highlightPlayingSegment(segment.id);
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

        const nextIndex = this.playlistIndex + 1;

        if (nextIndex >= this.currentPlaylist.segmentIds.length) {
            // Don't leave playlist mode, just show finished message
            this.showToast('Playlist finished!', 'success');
            // Optionally, you can pause or stop the player here
            // e.g. this.player.pauseVideo();
            return;
        }

        this.playlistIndex = nextIndex;
        const nextSegmentId = this.currentPlaylist.segmentIds[nextIndex];
        const nextSegment = this.segments.find(s => s.id === nextSegmentId);
        
        if (nextSegment) {
            this.playSegment(nextSegment);
            document.getElementById('currentSegmentName').textContent = 
                `${this.currentPlaylist.name} - ${nextSegment.name} (${nextIndex + 1}/${this.currentPlaylist.segmentIds.length})`;
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

    /**
     * Parse time string (HH:MM:SS, MM:SS, or SS) to seconds
     * @param {string} timeStr - Time string to parse
     * @returns {number} Time in seconds
     */
    parseTimeToSeconds(timeStr) {
        // Handle empty or invalid input
        if (!timeStr || typeof timeStr !== 'string') {
            return NaN;
        }

        // Check if it's just a number (seconds)
        if (/^\d+$/.test(timeStr)) {
            return parseInt(timeStr, 10);
        }

        // Handle MM:SS or HH:MM:SS format
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            // MM:SS format
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);
            return (minutes * 60) + seconds;
        } else if (parts.length === 3) {
            // HH:MM:SS format
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            const seconds = parseInt(parts[2], 10);
            return (hours * 3600) + (minutes * 60) + seconds;
        }

        return NaN;
    }

    // Segment Management
    editSegment(segmentId) {
        const segment = this.segments.find(s => s.id === segmentId);
        if (!segment) {
            this.showToast('Segment not found', 'error');
            return;
        }

        // Populate form with segment data
        document.getElementById('segmentForm').dataset.editMode = 'true';
        document.getElementById('segmentForm').dataset.segmentId = segmentId;
        document.getElementById('videoUrl').value = `https://www.youtube.com/watch?v=${segment.videoId}`;
        document.getElementById('segmentName').value = segment.name;
        document.getElementById('startTime').value = this.formatTime(segment.start);
        document.getElementById('endTime').value = this.formatTime(segment.end);
        
        // Update form title and button text
        document.getElementById('segmentFormTitle').textContent = 'Edit Segment';
        document.getElementById('submitSegmentBtn').textContent = 'Update Segment';
        
        // Show cancel button
        document.getElementById('cancelEditBtn').style.display = 'inline-block';
        
        // Scroll to form
        document.getElementById('segmentForm').scrollIntoView({ behavior: 'smooth' });
    }

    cancelEdit() {
        // Reset form
        document.getElementById('segmentForm').reset();
        document.getElementById('segmentForm').dataset.editMode = 'false';
        delete document.getElementById('segmentForm').dataset.segmentId;
        
        // Update form title and button text
        document.getElementById('segmentFormTitle').textContent = 'Add New Segment';
        document.getElementById('submitSegmentBtn').textContent = 'Add Segment';
        
        // Hide cancel button
        document.getElementById('cancelEditBtn').style.display = 'none';
    }

    addSegment(data) {
        // Extract values and validate
        const videoUrl = data.videoUrl?.trim();
        const segmentName = data.segmentName?.trim();
        
        // Parse time strings to seconds
        const startTime = this.parseTimeToSeconds(data.startTime);
        const endTime = this.parseTimeToSeconds(data.endTime);

        if (!videoUrl) {
            this.showToast('Please enter a YouTube URL', 'error');
            return;
        }

        if (!segmentName) {
            this.showToast('Please enter a segment name', 'error');
            return;
        }

        if (isNaN(startTime) || startTime < 0) {
            this.showToast('Please enter a valid start time (e.g., 30, 1:30, or 1:05:30)', 'error');
            return;
        }

        if (isNaN(endTime) || endTime <= 0) {
            this.showToast('Please enter a valid end time (e.g., 90, 2:30, or 1:06:30)', 'error');
            return;
        }

        const videoId = this.extractVideoId(videoUrl);
        if (!videoId) {
            this.showToast('Invalid YouTube URL', 'error');
            return;
        }

        // Convert to numbers to ensure proper comparison
        const start = Number(startTime);
        const end = Number(endTime);
        
        if (start >= end) {
            this.showToast('End time must be greater than start time', 'error');
            return;
        }

        const isEditMode = document.getElementById('segmentForm').dataset.editMode === 'true';
        let segment;

        if (isEditMode) {
            // Update existing segment
            const segmentId = document.getElementById('segmentForm').dataset.segmentId;
            const segmentIndex = this.segments.findIndex(s => s.id === segmentId);
            
            if (segmentIndex === -1) {
                this.showToast('Error: Segment not found', 'error');
                return;
            }
            
            this.segments[segmentIndex] = {
                ...this.segments[segmentIndex],
                name: segmentName,
                videoId: videoId,
                start: parseInt(startTime),
                end: parseInt(endTime),
                dateModified: new Date().toISOString()
            };
            
            this.saveData();
            this.updateUI();
            this.showToast('Segment updated successfully!', 'success');
            
            // Reset form and exit edit mode
            this.cancelEdit();
            return;
        } else {
            // Create new segment
            segment = {
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
    editPlaylist(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) {
            this.showToast('Playlist not found', 'error');
            return;
        }

        // Get segment checkboxes
        const segmentCheckboxes = document.querySelectorAll('#segmentSelection input[type="checkbox"]');
        
        // Check the segments that are in the playlist
        segmentCheckboxes.forEach(checkbox => {
            checkbox.checked = playlist.segmentIds.includes(checkbox.value);
        });

        // Populate form with playlist data
        document.getElementById('playlistForm').dataset.editMode = 'true';
        document.getElementById('playlistForm').dataset.playlistId = playlistId;
        document.getElementById('playlistName').value = playlist.name;
        document.getElementById('playlistDescription').value = playlist.description || '';
        
        // Update form title and button text
        document.getElementById('playlistFormTitle').textContent = 'Edit Playlist';
        document.getElementById('submitPlaylistBtn').textContent = 'Update Playlist';
        
        // Show cancel button
        document.getElementById('cancelPlaylistEditBtn').style.display = 'inline-block';
        
        // Switch to playlists tab and scroll to form
        this.switchTab('playlists');
        setTimeout(() => {
            document.getElementById('playlistForm').scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }

    cancelPlaylistEdit() {
        // Reset form
        document.getElementById('playlistForm').reset();
        document.getElementById('playlistForm').dataset.editMode = 'false';
        delete document.getElementById('playlistForm').dataset.playlistId;
        
        // Uncheck all segment checkboxes
        document.querySelectorAll('#segmentSelection input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Update form title and button text
        document.getElementById('playlistFormTitle').textContent = 'Create New Playlist';
        document.getElementById('submitPlaylistBtn').textContent = 'Create Playlist';
        
        // Hide cancel button
        document.getElementById('cancelPlaylistEditBtn').style.display = 'none';
    }

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

        // Check if we're in edit mode
        const isEditMode = document.getElementById('playlistForm').dataset.editMode === 'true';
        
        if (isEditMode) {
            // Update existing playlist
            const playlistId = document.getElementById('playlistForm').dataset.playlistId;
            const playlistIndex = this.playlists.findIndex(p => p.id === playlistId);
            
            if (playlistIndex === -1) {
                this.showToast('Error: Playlist not found', 'error');
                return;
            }
            
            this.playlists[playlistIndex] = {
                ...this.playlists[playlistIndex],
                name: data.playlistName,
                description: data.playlistDescription || '',
                segmentIds: selectedSegments,
                dateModified: new Date().toISOString()
            };
            
            this.saveData();
            this.updateUI();
            this.showToast('Playlist updated successfully!', 'success');
            
            // Reset form and exit edit mode
            this.cancelPlaylistEdit();
        } else {
            // Create new playlist
            const playlist = {
                id: 'pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: data.playlistName,
                description: data.playlistDescription || '',
                segmentIds: selectedSegments,
                dateCreated: new Date().toISOString()
            };

            this.playlists.push(playlist);
            this.saveData();
            this.updateUI();
            this.showToast('Playlist created successfully!', 'success');
            
            // Reset form
            document.getElementById('playlistForm').reset();
            document.querySelectorAll('#segmentSelection input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
    }

    deletePlaylist(playlistId) {
        this.playlists = this.playlists.filter(p => p.id !== playlistId);
        this.saveData();
        this.updateUI();
        this.showToast('Playlist deleted', 'info');
    }

    // UI Management
    // Pagination and Lazy Loading
    initializePagination() {
        // Initialize Intersection Observer for lazy loading
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadMoreItems();
                    }
                });
            }, { threshold: 0.5 });
        }
        
        // Add scroll event for older browsers
        window.addEventListener('scroll', this.handleScroll.bind(this));
    }
    
    handleScroll() {
        // Load more items when user scrolls to bottom
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
            this.loadMoreItems();
        }
    }
    
    loadMoreItems() {
        // Prevent multiple simultaneous loads
        if (this.isLoading) return;
        
        const activeTab = document.querySelector('.tab-content.active').id;
        const totalItems = activeTab === 'segments' ? this.segments.length : this.playlists.length;
        const loadedItems = document.querySelectorAll(`#${activeTab} .segment-item, #${activeTab} .playlist-item`).length;
        
        if (loadedItems < totalItems) {
            this.isLoading = true;
            this.currentPage++;
            this.updateUI();
            this.isLoading = false;
        }
    }
    
    getPaginatedItems(items) {
        const start = 0; // always start slice from 0 to show all pages cumulatively
        const end = this.currentPage * this.itemsPerPage; // cumulative count of items till current page
        console.log(`Paginating: showing items 0 to ${end} of ${items.length}`);
        return items.slice(start, end);
    }
    
    /**
     * Updates the pagination UI (shows/hides the Load More button)
     */
    updatePagination() {
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (!loadMoreContainer) {
            console.warn('Load More container not found in DOM');
            return;
        }
        
        const totalSegments = this.segments.length;
        const displayedSegments = document.querySelectorAll('#segmentsList .segment-item').length;
        
        console.log(`Update Pagination - Total: ${totalSegments}, Displayed: ${displayedSegments}, Current Page: ${this.currentPage}`);
        
        if (totalSegments === 0 || displayedSegments >= totalSegments) {
            console.log('Hiding Load More - All segments are displayed or no segments exist');
            loadMoreContainer.style.display = 'none';
        } else {
            console.log('Showing Load More - More segments available');
            loadMoreContainer.style.display = 'block';
        }
    }

    /**
     * Validate time input and update UI feedback
     * @param {HTMLInputElement} input - The input element to validate
     * @returns {boolean} True if input is valid, false otherwise
     */
    validateTimeInput(input) {
        const value = input.value.trim();
        const isValid = value === '' || !isNaN(this.parseTimeToSeconds(value));
        
        if (isValid) {
            input.classList.remove('input-error');
            const hint = input.nextElementSibling;
            if (hint && hint.classList.contains('form-hint')) {
                hint.textContent = hint.textContent.replace(/^⚠\s*/, '');
            }
        } else {
            input.classList.add('input-error');
            const hint = input.nextElementSibling;
            if (hint && hint.classList.contains('form-hint')) {
                if (!hint.textContent.startsWith('⚠')) {
                    hint.textContent = '⚠ ' + hint.textContent;
                }
            }
        }
        
        return isValid;
    }

    initializeEventListeners() {
        // Add Load More button click handler
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreSegments());
        }
        
        // Add scroll handler for infinite scrolling (optional)
        window.addEventListener('scroll', () => this.handleScroll());
        // Swipe navigation
        const appContainer = document.getElementById('app');
        let touchStartX = 0;
        let touchEndX = 0;
        const minSwipeDistance = 50; // Minimum distance for a swipe to be detected

        appContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        appContainer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const swipeDistance = touchEndX - touchStartX;
            
            // Only detect horizontal swipes
            if (Math.abs(swipeDistance) < minSwipeDistance) return;
            
            if (swipeDistance < 0) {
                // Swipe left - go to playlists tab
                if (document.querySelector('.nav-btn[data-tab="segments"]').classList.contains('active')) {
                    this.switchTab('playlists');
                    this.currentPage = 1;
                    this.updateUI();
                }
            } else {
                // Swipe right - go to segments tab
                if (document.querySelector('.nav-btn[data-tab="playlists"]').classList.contains('active')) {
                    this.switchTab('segments');
                    this.currentPage = 1;
                    this.updateUI();
                }
            }
        }, { passive: true });

        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
                // Reset pagination when switching tabs
                this.currentPage = 1;
                this.updateUI();
            });
        });

        // Time input validation
        const timeInputs = ['startTime', 'endTime'];
        timeInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.validateTimeInput(e.target);
                });
                input.addEventListener('blur', (e) => {
                    this.validateTimeInput(e.target);
                });
            }
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

        // Player controls - Removed duplicate event listeners

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

        // Import data button and file input
        document.getElementById('importDataBtn').addEventListener('click', () => {
            document.getElementById('importDataFile').click();
        });

        document.getElementById('importDataFile').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(e.target.files[0]);
                // Reset the file input so the same file can be imported again if needed
                e.target.value = '';
            }
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

        // Next/Previous buttons
        const nextBtn = document.getElementById('nextSegment');
        const prevBtn = document.getElementById('prevSegment');
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.isPlayingPlaylist && this.currentPlaylist) {
                    this.playNextInPlaylist();
                } else if (this.currentSegment) {
                    // If not in a playlist but a segment is playing, find the next segment in the list
                    const currentIndex = this.segments.findIndex(s => s.id === this.currentSegment.id);
                    if (currentIndex >= 0 && currentIndex < this.segments.length - 1) {
                        this.playSegment(this.segments[currentIndex + 1]);
                    } else {
                        this.showToast('No more segments available', 'info');
                    }
                }
            });
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.isPlayingPlaylist && this.currentPlaylist) {
                    this.playPreviousInPlaylist();
                } else if (this.currentSegment) {
                    // If not in a playlist but a segment is playing, find the previous segment in the list
                    const currentIndex = this.segments.findIndex(s => s.id === this.currentSegment.id);
                    if (currentIndex > 0) {
                        this.playSegment(this.segments[currentIndex - 1]);
                    } else {
                        this.showToast('This is the first segment', 'info');
                    }
                }
            });
        }
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
        this.updatePagination();
    }

    renderSegments() {
        console.group('renderSegments');
        console.log('Starting renderSegments. Current page:', this.currentPage, 'Total segments:', this.segments.length);
        
        const container = document.getElementById('segmentsList');
        if (!container) {
            console.error('Segments container not found');
            console.groupEnd();
            return;
        }
        
        if (!this.segments || this.segments.length === 0) {
            console.log('No segments to render');
            container.innerHTML = '<div class="empty-state"><p>No segments saved yet. Add your first segment above!</p></div>';
            const loadMoreContainer = document.getElementById('loadMoreContainer');
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 'none';
                console.log('Hiding Load More container - no segments');
            }
            console.groupEnd();
            return;
        }
        
        console.log('Getting paginated segments');
        const paginatedSegments = this.getPaginatedItems(this.segments);
        console.log(`Paginated segments: ${paginatedSegments.length} of ${this.segments.length} total`);
        
        // Clear container only on first page load or when segments array is refreshed
        if (this.currentPage === 1 || container.querySelectorAll('.segment-item').length === 0) {
            console.log('First page or empty container - clearing container');
            container.innerHTML = '';
        }
        
        // Count how many items are already rendered
        const existingCount = container.querySelectorAll('.segment-item').length;
        console.log(`Existing segments in DOM: ${existingCount}`);
        
        // Only render new segments not yet rendered
        const segmentsToAdd = paginatedSegments.slice(existingCount);
        console.log(`New segments to add: ${segmentsToAdd.length}`);
        
        if (segmentsToAdd.length === 0 && existingCount > 0) {
            console.log('No new segments to add and there are existing segments');
            console.groupEnd();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        console.log('Creating document fragment for new segments');
        
        segmentsToAdd.forEach((segment, index) => {
            console.log(`Rendering segment ${index + 1}/${segmentsToAdd.length}:`, segment.id);
            const segmentElement = document.createElement('div');
            segmentElement.className = 'segment-item';
            segmentElement.dataset.segmentId = segment.id;
            
            const displayDate = segment.dateModified || segment.dateCreated;
            const formattedDate = new Date(displayDate).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Calculate the actual serial number (1-based)
            const serialNumber = existingCount + index + 1;
            
            segmentElement.innerHTML = `
                <div class="segment-serial">${serialNumber}</div>
                <div class="segment-info">
                    <h3 class="segment-name">${this.escapeHtml(segment.name)}</h3>
                    <div class="segment-details">
                        <span class="segment-time">${this.formatTime(segment.start)} - ${this.formatTime(segment.end)}</span>
                        <span class="segment-video-id">${segment.videoId}</span>
                        <span class="segment-date" title="${segment.dateModified ? 'Updated' : 'Created'} on ${new Date(displayDate).toLocaleString()}">
                            ${segment.dateModified ? '📅 Updated: ' : '📅 '}${formattedDate}
                        </span>
                    </div>
                </div>
                <div class="segment-actions">
                    <button class="action-btn" onclick="app.playSegment(${JSON.stringify(segment).replace(/"/g, '&quot;')})" title="Play">▶️</button>
                    <button class="action-btn" onclick="app.editSegment('${segment.id}')" title="Edit">✏️</button>
                    <button class="action-btn" onclick="app.shareSegment('${segment.id}')" title="Share">📤</button>
                    <button class="action-btn action-btn--danger" onclick="app.deleteSegment('${segment.id}')" title="Delete">🗑️</button>
                </div>`;
            
            fragment.appendChild(segmentElement);
        });
        
        container.appendChild(fragment);

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
    
    updateSegmentPlayingState(segmentId) {
        // Remove active class from all segments
        document.querySelectorAll('.segment-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to the current segment
        const currentSegment = document.querySelector(`.segment-item[data-segment-id="${segmentId}"]`);
        if (currentSegment) {
            currentSegment.classList.add('active');
            currentSegment.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    highlightPlayingSegment(segmentId) {
        // Remove playing class from all segments
        document.querySelectorAll('.segment-item, .playlist-segment').forEach(item => {
            item.classList.remove('playing');
        });
        
        // Add playing class to the current segment in both segment list and any playlist dropdowns
        const segments = document.querySelectorAll(`.segment-item[data-segment-id="${segmentId}"], .playlist-segment[data-segment-id="${segmentId}"]`);
        segments.forEach(segment => {
            segment.classList.add('playing');
        });
    }

    renderPlaylists() {
        const container = document.getElementById('playlistsList');
        
        if (this.playlists.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No playlists created yet. Create your first playlist above!</p></div>';
            return;
        }
        
        // Get paginated playlists
        const paginatedPlaylists = this.getPaginatedItems(this.playlists);
        
        // Only update the container if we're not on the first page
        if (this.currentPage > 1) {
            const existingPlaylists = container.querySelectorAll('.playlist-item');
            if (existingPlaylists.length >= this.playlists.length) return;
        } else {
            container.innerHTML = ''; // Clear container only on first page
        }
        
        // Append new playlists
        const fragment = document.createDocumentFragment();
        paginatedPlaylists.slice(container.children.length).forEach(playlist => {
            const playlistElement = document.createElement('div');
            playlistElement.className = 'playlist-item';
            playlistElement.dataset.playlistId = playlist.id;
            playlistElement.tabIndex = 0;
            playlistElement.style.position = 'relative';
            playlistElement.style.paddingLeft = '4.5rem'; // Make space for the serial number
            
            const displayDate = playlist.dateModified || playlist.dateCreated;
            const formattedDate = new Date(displayDate).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Create dropdown menu with segment list
            const segmentList = playlist.segmentIds.map(segmentId => {
                const segment = this.segments.find(s => s.id === segmentId);
                return segment ? `
                    <div class="playlist-segment" data-segment-id="${segmentId}">
                        <span>${this.escapeHtml(segment.name)}</span>
                        <span class="segment-time">(${this.formatTime(segment.start)} - ${this.formatTime(segment.end)})</span>
                    </div>` : '';
            }).join('');

            const playlistIndex = this.playlists.findIndex(p => p.id === playlist.id) + 1;
            playlistElement.innerHTML = `
                <div class="playlist-serial">${playlistIndex}</div>
                <div class="playlist-info">
                    <h3 class="playlist-name">${this.escapeHtml(playlist.name)}</h3>
                    <div class="playlist-details">
                        <span class="playlist-count">${playlist.segmentIds.length} ${playlist.segmentIds.length === 1 ? 'segment' : 'segments'}</span>
                        <span class="playlist-date" title="${playlist.dateModified ? 'Updated' : 'Created'} on ${new Date(displayDate).toLocaleString()}">
                            ${playlist.dateModified ? '📅 Updated: ' : '📅 '}${formattedDate}
                        </span>
                    </div>
                    <div class="playlist-segments-dropdown" style="display: none;">
                        ${segmentList}
                    </div>
                </div>
                <div class="playlist-actions">
                    <button class="action-btn dropdown-toggle" data-playlist-id="${playlist.id}" title="Show segments">▼</button>
                    <button class="action-btn" onclick="app.playPlaylist(${JSON.stringify(playlist).replace(/"/g, '&quot;')})">▶️ Play</button>
                    <button class="action-btn" onclick="app.editPlaylist('${playlist.id}')">✏️ Edit</button>
                    <button class="action-btn" onclick="app.sharePlaylist('${playlist.id}')">📤 Share</button>
                    <button class="action-btn action-btn--danger" onclick="app.deletePlaylist('${playlist.id}')">🗑️ Delete</button>
                </div>`;
            
            fragment.appendChild(playlistElement);
        });
        
        container.appendChild(fragment);

        // Add click listeners for playlist items and dropdown toggles
        container.querySelectorAll('.playlist-item').forEach(item => {
            // Handle main playlist item click (play on click)
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking on actions or dropdown toggle
                if (!e.target.closest('.playlist-actions') && !e.target.closest('.dropdown-toggle')) {
                    const playlistId = item.dataset.playlistId;
                    const playlist = this.playlists.find(p => p.id === playlistId);
                    if (playlist) this.playPlaylist(playlist);
                }
            });
            
            // Store references to the current playlist and its elements
            const currentPlaylist = this.playlists.find(p => p.id === item.dataset.playlistId);
            const toggleBtn = item.querySelector('.dropdown-toggle');
            const dropdown = item.querySelector('.playlist-segments-dropdown');
            
            if (toggleBtn && dropdown && currentPlaylist) {
                // Toggle dropdown visibility
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering parent click
                    const isVisible = dropdown.style.display !== 'none';
                    dropdown.style.display = isVisible ? 'none' : 'block';
                    toggleBtn.textContent = isVisible ? '▼' : '▲';
                });
                
                // Handle segment clicks in the dropdown
                dropdown.addEventListener('click', (e) => {
                    const segmentEl = e.target.closest('.playlist-segment');
                    if (!segmentEl) return; // Click was not on a segment
                    
                    e.stopPropagation(); // Prevent triggering parent click
                    
                    const segmentId = segmentEl.dataset.segmentId;
                    const segment = this.segments.find(s => s.id === segmentId);
                    
                    if (!segment) {
                        console.error('Segment not found:', segmentId);
                        this.showToast('Error: Segment not found', 'error');
                        return;
                    }
                    
                    try {
                        // Update current playlist state
                        this.currentPlaylist = JSON.parse(JSON.stringify(currentPlaylist));
                        this.playlistIndex = this.currentPlaylist.segmentIds.findIndex(id => id === segmentId);
                        this.isPlayingPlaylist = true;
                        
                        // Update UI
                        this.updatePlaylistPlayingState(currentPlaylist.id);
                        document.getElementById('currentSegmentName').textContent = 
                            `${this.currentPlaylist.name} - ${segment.name} (${this.playlistIndex + 1}/${this.currentPlaylist.segmentIds.length})`;
                        
                        // Play the selected segment
                        this.playSegment(segment);
                    } catch (error) {
                        console.error('Error playing segment:', error);
                        this.showToast('Error playing segment', 'error');
                    }
                });
            }
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

    // Export data to JSON file
    exportData() {
        try {
            const data = {
                version: this.version,
                currentUser: this.currentUser,
                userProfiles: this.userProfiles,
                preferences: this.preferences
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `youtube-segment-saver-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('Backup exported successfully', 'success');
            }, 100);
            
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showToast('Error exporting backup', 'error');
        }
    }

    // Helper function to process data in chunks
    async processInChunks(items, chunkSize, processFn) {
        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            await processFn(chunk);
        }
    }

    // Import data from JSON file
    async importData(file) {
        if (!file) {
            this.showToast('No file selected', 'error');
            return Promise.resolve();
        }

        // Check file size (limit to 4MB for mobile)
        const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
        if (file.size > MAX_FILE_SIZE) {
            this.showToast('File is too large for import', 'error');
            return Promise.reject(new Error('File too large'));
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    let importedCount = 0;
                    
                    // Show loading indicator
                    this.showToast('Importing data...', 'info');
                    
                    // Handle different import formats
                    if (data.profiles && data.currentUser) {
                        // Full backup with profiles
                        await this.importProfilesData(data);
                        // After importing profiles, update current segments and playlists
                        const profile = this.userProfiles[this.currentUser];
                        this.segments = profile.segments || [];
                        this.playlists = profile.playlists || [];
                        importedCount = this.segments.length + this.playlists.length;
                    } else if (data.segments || data.playlists) {
                        // Simple segments/playlists import
                        importedCount = await this.importSegmentsAndPlaylists(data);
                    } else {
                        throw new Error('Invalid file format');
                    }
                    
                    // Save data to storage
                    this.saveData();
                    
                    // Force a complete UI refresh
                    this.currentPage = 1; // Reset to first page
                    this.updateUI();
                    
                    // Switch to the appropriate tab based on the imported content
                    if (data.segments && data.segments.length > 0) {
                        this.switchTab('segments');
                    } else if (data.playlists && data.playlists.length > 0) {
                        this.switchTab('playlists');
                    }
                    
                    this.showToast(`Successfully imported ${importedCount} items`, 'success');
                    resolve(importedCount);
                    
                } catch (error) {
                    console.error('Import error:', error);
                    this.showToast(`Import failed: ${error.message}`, 'error');
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error('File read error:', error);
                this.showToast('Error reading file', 'error');
                reject(error);
            };
            
            reader.readAsText(file);
        });
    }
    
    // Helper method to import profiles data
    async importProfilesData(data) {
        // Implementation for importing profiles data
        // This is a simplified version - you may need to expand this
        // based on your exact data structure
        if (data.profiles) {
            Object.assign(this.userProfiles, data.profiles);
        }
        if (data.currentUser) {
            this.currentUser = data.currentUser;
        }
    }
    
    // Helper method to import segments and playlists
    async importSegmentsAndPlaylists(data) {
        let importedCount = 0;
        
        if (data.segments && Array.isArray(data.segments)) {
            const existingIds = new Set(this.segments.map(s => s.id));
            const newSegments = data.segments.filter(s => !existingIds.has(s.id));
            this.segments.push(...newSegments);
            importedCount += newSegments.length;
            console.log('Imported segments:', newSegments);
        }
        
        if (data.playlists && Array.isArray(data.playlists)) {
            const existingPlaylistIds = new Set(this.playlists.map(p => p.id));
            const newPlaylists = data.playlists.filter(p => !existingPlaylistIds.has(p.id));
            this.playlists.push(...newPlaylists);
            importedCount += newPlaylists.length;
            console.log('Imported playlists:', newPlaylists);
        }
        
        // Update the current user's data
        if (this.userProfiles[this.currentUser]) {
            this.userProfiles[this.currentUser].segments = this.segments;
            this.userProfiles[this.currentUser].playlists = this.playlists;
        }
        
        return importedCount;
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
            default:
                this.showToast('Invalid platform', 'error');
                return;
        }
        
        window.open(url, '_blank', 'noopener,noreferrer');
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