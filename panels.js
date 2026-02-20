// ========== پنل مدیریت ==========
// این فایل شامل همه پنل‌های مقام‌هاست

// ===== توابع کمکی =====
function showNotification(message, isBan = false) {
    if (window.app) {
        window.app.showNotification(message, isBan);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// ===== پنل ادمین (تیک قهوه‌ای) =====
function openAdminPanel(app, playerId) {
    if (app.userRole !== 'admin') return;

    const player = app.playersData[playerId];
    if (!player) return;

    app.selectedPlayerId = playerId;
    app.selectedPlayerData = player;

    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    
    document.getElementById('adminPanelTitle').textContent = 'پنل ادمین (تیک قهوه‌ای)';
    document.getElementById('adminPlayerAvatar').innerHTML = `<img src="${app.getAvatarImage(player.avatar)}">`;
    document.getElementById('adminPlayerName').innerHTML = player.name;
    document.getElementById('adminPlayerId').innerHTML = player.id;
    
    const adminBan = app.adminBannedUsers.find(b => b.userId === playerId);
    const warning = document.getElementById('adminWarning');
    if (adminBan) {
        warning.style.display = 'block';
        warning.innerHTML = `⚠️ این کاربر توسط ادمین ${adminBan.bannedByName} بن شده تا ${new Date(adminBan.expiry).toLocaleString('fa-IR')}`;
    } else {
        warning.style.display = 'none';
    }

    const actions = document.getElementById('adminActions');
    let actionsHTML = '';

    actionsHTML += `<div class="admin-action-btn profile" onclick="window.app.viewOtherProfileFromAdmin()">👤 پروفایل</div>`;
    actionsHTML += `<div class="admin-action-btn report" onclick="window.app.openReportModalFromAdmin()">🚨 گزارش</div>`;

    if (playerId !== app.userId && player.role !== 'creator' && player.role !== 'support') {
        if (adminBan) {
            actionsHTML += `<div class="admin-action-btn transfer" onclick="unbanAdminPlayer()">✅ رفع بن ادمین</div>`;
        } else {
            actionsHTML += `<div class="admin-action-btn ban" onclick="openAdminBanModal()">🚫 بن ادمین</div>`;
        }
    }

    actions.innerHTML = actionsHTML;
    panel.classList.add('visible');
}

function openAdminBanModal() {
    if (!window.app || window.app.userRole !== 'admin') return;
    
    if (!window.app.selectedPlayerId) {
        showNotification('❌ ابتدا یک کاربر را انتخاب کنید');
        return;
    }

    const modal = document.getElementById('banModal');
    if (modal) {
        modal.style.display = 'block';
        
        const durationSelect = document.getElementById('banDuration');
        if (durationSelect) {
            durationSelect.innerHTML = `
                <option value="600">۱۰ دقیقه</option>
                <option value="3600">۱ ساعت</option>
                <option value="86400">۱ روز</option>
                <option value="259200">۳ روز</option>
                <option value="604800">۷ روز</option>
            `;
        }
        
        // تغییر تابع confirmBan به confirmAdminBan
        document.querySelector('.ban-confirm').onclick = confirmAdminBan;
    }
}

async function confirmAdminBan() {
    const app = window.app;
    if (!app || app.userRole !== 'admin') return;

    if (!app.selectedPlayerId) {
        showNotification('❌ کاربری انتخاب نشده است');
        closeModal('banModal');
        return;
    }

    if (app.selectedPlayerId === app.userId) {
        showNotification('❌ نمی‌توانید خودتان را بن کنید');
        closeModal('banModal');
        return;
    }

    const player = app.selectedPlayerData;
    if (player.role === 'creator' || player.role === 'support') {
        showNotification('❌ نمی‌توانید سازنده یا پشتیبانی را بن کنید');
        closeModal('banModal');
        return;
    }

    const banMessage = document.getElementById('banMessageInput').value.trim() || 'تخلف';
    const duration = parseInt(document.getElementById('banDuration').value);
    
    const expiry = Date.now() + (duration * 1000);
    
    const adminBan = {
        userId: app.selectedPlayerId,
        userName: app.selectedPlayerData.name,
        reason: banMessage,
        expiry: expiry,
        bannedAt: Date.now(),
        bannedBy: app.userId,
        bannedByName: app.userName,
        duration: duration
    };

    app.adminBannedUsers = app.adminBannedUsers.filter(b => b.userId !== app.selectedPlayerId);
    app.adminBannedUsers.push(adminBan);

    if (app.currentLobby) {
        if (!app.currentLobby.bannedUsers) app.currentLobby.bannedUsers = [];
        if (!app.currentLobby.bannedUsers.includes(app.selectedPlayerId)) {
            app.currentLobby.bannedUsers.push(app.selectedPlayerId);
        }
        app.currentLobby.players = app.currentLobby.players.filter(p => p.id !== app.selectedPlayerId);
    }

    app.removePlayerFromLobby(app.selectedPlayerId);
    await app.saveLobbiesToServer();

    closeModal('banModal');
    document.getElementById('adminPanel').classList.remove('visible');

    const durationText = duration === 600 ? '۱۰ دقیقه' : 
                       duration === 3600 ? '۱ ساعت' :
                       duration === 86400 ? '۱ روز' :
                       duration === 259200 ? '۳ روز' : '۷ روز';
    
    sessionStorage.setItem('banInfo', JSON.stringify({
        ...adminBan,
        durationText: durationText
    }));
    
    if (app.selectedPlayerId === app.userId) {
        localStorage.removeItem('mafiaSun_loggedIn');
        localStorage.removeItem('mafiaSun_rememberMe');
        localStorage.removeItem('mafiaSun_currentUser');
        
        showNotification(`🚫 شما توسط ادمین ${app.userName} بن شدید: ${banMessage} (${durationText})`, true, 3000);
        setTimeout(() => {
            window.location.href = AUTH_PAGE_URL;
        }, 2000);
    } else {
        showNotification(`🚫 کاربر ${app.selectedPlayerData.name} توسط ادمین بن شد: ${banMessage} (${durationText})`, true, 5000);
    }
    
    app.selectedPlayerId = null;
    app.selectedPlayerData = null;
}

async function unbanAdminPlayer() {
    const app = window.app;
    if (!app || app.userRole !== 'admin') return;
    
    if (!app.selectedPlayerId) {
        showNotification('❌ کاربری انتخاب نشده است');
        return;
    }

    const ban = app.adminBannedUsers.find(b => b.userId === app.selectedPlayerId);
    if (!ban) {
        showNotification('❌ این کاربر توسط ادمین بن نشده است');
        return;
    }

    app.adminBannedUsers = app.adminBannedUsers.filter(b => b.userId !== app.selectedPlayerId);
    await app.saveLobbiesToServer();
    
    document.getElementById('adminPanel').classList.remove('visible');
    showNotification(`✅ بن ادمین کاربر ${app.selectedPlayerData.name} لغو شد`);
    
    app.selectedPlayerId = null;
    app.selectedPlayerData = null;
}

function viewAdminBanList() {
    const app = window.app;
    if (!app || (app.userRole !== 'admin' && app.userRole !== 'creator' && app.userRole !== 'support')) return;

    if (app.adminBannedUsers.length === 0) {
        showNotification('📋 لیست بن‌های ادمین خالی است');
        return;
    }

    let message = '🟫 لیست بن‌های ادمین:\n\n';
    app.adminBannedUsers.forEach((ban, index) => {
        const expiryDate = new Date(ban.expiry).toLocaleString('fa-IR');
        const durationText = ban.duration === 600 ? '۱۰ دقیقه' : 
                           ban.duration === 3600 ? '۱ ساعت' :
                           ban.duration === 86400 ? '۱ روز' :
                           ban.duration === 259200 ? '۳ روز' : '۷ روز';
        message += `${index + 1}. کاربر ${ban.userName} - ${ban.reason}\n`;
        message += `   توسط: ${ban.bannedByName} - مدت: ${durationText}\n`;
        message += `   تا ${expiryDate}\n\n`;
    });
    
    if (app.isGameCreator || app.userRole === 'support') {
        message += 'برای رفع بن، به پنل سازنده بروید.';
    }
    
    alert(message);
}

async function unbanAdminUserFromList(userId) {
    const app = window.app;
    if (!app || (!app.isGameCreator && app.userRole !== 'support')) return;
    
    const ban = app.adminBannedUsers.find(b => b.userId === userId);
    if (!ban) return;
    
    app.adminBannedUsers = app.adminBannedUsers.filter(b => b.userId !== userId);
    await app.saveLobbiesToServer();
    if (app.updateBlacklistList) app.updateBlacklistList();
    showNotification(`✅ بن ادمین کاربر ${ban.userName} لغو شد`);
}

async function unbanAdminPlayerFromCreator() {
    const app = window.app;
    if (!app || (!app.isGameCreator && app.userRole !== 'support')) return;
    
    if (!app.selectedPlayerId) {
        showNotification('❌ کاربری انتخاب نشده است');
        return;
    }

    app.adminBannedUsers = app.adminBannedUsers.filter(b => b.userId !== app.selectedPlayerId);
    await app.saveLobbiesToServer();
    
    document.getElementById('adminPanel').classList.remove('visible');
    showNotification(`✅ بن ادمین کاربر ${app.selectedPlayerData.name} لغو شد`);
    
    app.selectedPlayerId = null;
    app.selectedPlayerData = null;
}

// ===== پنل ناظر (تیک نارنجی) =====
function openObserverPanel(app, playerId) {
    if (app.userRole !== 'observer') return;

    const player = app.playersData[playerId];
    if (!player) return;

    app.selectedPlayerId = playerId;
    app.selectedPlayerData = player;

    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    
    document.getElementById('adminPanelTitle').textContent = 'پنل ناظر';
    document.getElementById('adminPlayerAvatar').innerHTML = `<img src="${app.getAvatarImage(player.avatar)}">`;
    document.getElementById('adminPlayerName').innerHTML = player.name;
    document.getElementById('adminPlayerId').innerHTML = player.id;
    document.getElementById('adminWarning').style.display = 'none';

    const actions = document.getElementById('adminActions');
    let actionsHTML = '';

    actionsHTML += `<div class="admin-action-btn profile" onclick="window.app.viewOtherProfileFromAdmin()">👤 پروفایل</div>`;
    actionsHTML += `<div class="admin-action-btn report" onclick="window.app.openReportModalFromAdmin()">🚨 گزارش</div>`;

    if (playerId !== app.userId) {
        actionsHTML += `<div class="admin-action-btn temp-ban" onclick="tempBanPlayerObserver()">⛔ بن ۱ روزه</div>`;
    }

    actions.innerHTML = actionsHTML;
    panel.classList.add('visible');
}

function tempBanPlayerObserver() {
    const app = window.app;
    if (!app || app.userRole !== 'observer') return;

    const playerName = app.selectedPlayerData.name;

    const expiry = Date.now() + (24 * 60 * 60 * 1000);
    const tempBan = {
        userId: app.selectedPlayerId,
        reason: 'بن توسط ناظر',
        expiry: expiry,
        bannedAt: Date.now(),
        bannedBy: app.userId,
        bannedByName: app.userName
    };

    app.tempBannedUsers = app.tempBannedUsers.filter(b => b.userId !== app.selectedPlayerId);
    app.tempBannedUsers.push(tempBan);
    app.saveLobbiesToServer();

    if (app.currentLobby) {
        if (!app.currentLobby.bannedUsers) app.currentLobby.bannedUsers = [];
        if (!app.currentLobby.bannedUsers.includes(app.selectedPlayerId)) {
            app.currentLobby.bannedUsers.push(app.selectedPlayerId);
        }
        app.currentLobby.players = app.currentLobby.players.filter(p => p.id !== app.selectedPlayerId);
    }

    app.removePlayerFromLobby(app.selectedPlayerId);
    app.saveLobbiesToServer();

    document.getElementById('adminPanel').classList.remove('visible');

    if (app.selectedPlayerId === app.userId) {
        showNotification(`🚫 شما توسط ${app.userName} به مدت ۱ روز بن شدید`, true, 5000);
        setTimeout(() => {
            window.location.href = AUTH_PAGE_URL;
        }, 3000);
    } else {
        showNotification(`⛔ ${playerName} به مدت ۱ روز بن شد`, true);
    }
}

// ===== پنل پشتیبانی و سازنده =====
function openGameCreatorAdminPanel(app, playerId) {
    if (!app.isGameCreator && app.userRole !== 'support') return;

    const player = app.playersData[playerId];
    if (!player) {
        showNotification('❌ کاربر یافت نشد');
        return;
    }

    app.selectedPlayerId = playerId;
    app.selectedPlayerData = player;

    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    
    document.getElementById('adminPanelTitle').textContent = 'پنل مدیریت بازی';
    document.getElementById('adminPlayerAvatar').innerHTML = `<img src="${app.getAvatarImage(player.avatar)}">`;
    document.getElementById('adminPlayerName').innerHTML = player.name;
    document.getElementById('adminPlayerId').innerHTML = player.id;

    const isPermanentlyBanned = app.isUserPermanentlyBanned(playerId);
    const tempBan = app.isUserTempBanned(playerId);
    const adminBan = app.isUserAdminBanned(playerId);

    const warning = document.getElementById('adminWarning');
    if (isPermanentlyBanned) {
        warning.style.display = 'block';
        warning.innerHTML = '⚠️ این کاربر در لیست سیاه دائمی است';
    } else if (tempBan) {
        warning.style.display = 'block';
        warning.innerHTML = `⚠️ این کاربر موقتاً بن شده: ${tempBan.reason} تا ${new Date(tempBan.expiry).toLocaleString('fa-IR')}`;
    } else if (adminBan) {
        warning.style.display = 'block';
        warning.innerHTML = `⚠️ این کاربر توسط ادمین بن شده: ${adminBan.reason} تا ${new Date(adminBan.expiry).toLocaleString('fa-IR')}`;
    } else {
        warning.style.display = 'none';
    }

    const actions = document.getElementById('adminActions');
    let actionsHTML = '';

    actionsHTML += `<div class="admin-action-btn profile" onclick="window.app.viewOtherProfileFromAdmin()">👤 پروفایل</div>`;
    actionsHTML += `<div class="admin-action-btn report" onclick="window.app.openReportModalFromAdmin()">🚨 گزارش</div>`;

    if (app.observer1 === playerId) {
        actionsHTML += `<div class="admin-action-btn remove-observer" onclick="app.removeFromObserver(1)">⬇️ حذف از ناظر ۱</div>`;
    } else if (!app.observer1 && app.observer1 !== playerId && app.observer2 !== playerId) {
        actionsHTML += `<div class="admin-action-btn observer" onclick="app.toggleObserver(1)">👁️ ناظر ۱</div>`;
    }

    if (app.observer2 === playerId) {
        actionsHTML += `<div class="admin-action-btn remove-observer" onclick="app.removeFromObserver(2)">⬇️ حذف از ناظر ۲</div>`;
    } else if (!app.observer2 && app.observer1 !== playerId && app.observer2 !== playerId) {
        actionsHTML += `<div class="admin-action-btn observer" onclick="app.toggleObserver(2)">👁️ ناظر ۲</div>`;
    }

    if (playerId !== app.userId) {
        actionsHTML += `<div class="admin-action-btn transfer" onclick="app.transferOwnership()">👑 انتقال مالکیت</div>`;
        actionsHTML += `<div class="admin-action-btn kick" onclick="app.kickPlayer()">👢 اخراج از لابی</div>`;

        if (isPermanentlyBanned) {
            actionsHTML += `<div class="admin-action-btn transfer" onclick="app.unbanPlayer()">✅ رفع بن دائمی</div>`;
        } else if (tempBan) {
            actionsHTML += `<div class="admin-action-btn transfer" onclick="app.unbanTempPlayer()">✅ رفع بن موقت</div>`;
        } else if (adminBan) {
            actionsHTML += `<div class="admin-action-btn transfer" onclick="unbanAdminPlayerFromCreator()">✅ رفع بن ادمین</div>`;
        } else {
            actionsHTML += `<div class="admin-action-btn ban" onclick="app.openBanModal()">🚫 بن دائمی</div>`;
        }
    }

    actions.innerHTML = actionsHTML;
    panel.classList.add('visible');
}

// ===== پنل سازنده بازی =====
function openGameCreatorPanel() {
    const app = window.app;
    if (!app || (!app.isGameCreator && app.userRole !== 'support')) return;

    document.getElementById('totalLobbiesCount').textContent = app.lobbies.length;

    let online = 0;
    app.lobbies.forEach(lobby => {
        online += lobby.players ? lobby.players.length : 0;
    });
    document.getElementById('onlineUsersCount').textContent = online;
    document.getElementById('newReportsCount').textContent = app.reports.length;
    document.getElementById('blacklistCount').textContent = app.blacklist.length + app.tempBannedUsers.length + app.adminBannedUsers.length;

    updateReportsList();
    updateBlacklistList();

    document.getElementById('gameCreatorPanel').classList.add('visible');
}

function switchCreatorTab(tab) {
    const tabs = document.querySelectorAll('.creator-tab');
    const contents = document.querySelectorAll('.creator-tab-content');

    tabs.forEach(t => t?.classList.remove('active'));
    contents.forEach(c => c?.classList.remove('active'));

    if (tab === 'stats') {
        if (tabs[0]) tabs[0].classList.add('active');
        document.getElementById('creator-stats-tab').classList.add('active');
    } else if (tab === 'reports') {
        if (tabs[1]) tabs[1].classList.add('active');
        document.getElementById('creator-reports-tab').classList.add('active');
        updateReportsList();
    } else if (tab === 'blacklist') {
        if (tabs[2]) tabs[2].classList.add('active');
        document.getElementById('creator-blacklist-tab').classList.add('active');
        updateBlacklistList();
    }
}

function updateReportsList() {
    const app = window.app;
    if (!app) return;
    
    const container = document.getElementById('reportsList');
    if (!container) return;

    if (app.reports.length === 0) {
        container.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">گزارشی وجود ندارد</div>';
        return;
    }

    let html = '';
    app.reports.slice().reverse().forEach((report, index) => {
        const reportDate = new Date(report.timestamp).toLocaleString('fa-IR');
        html += `
            <div class="report-item">
                <div class="report-header">
                    <span><i class="fas fa-user"></i> گزارش دهنده: ${report.reporterName} (🆔 ${report.reporterId})</span>
                    <span><i class="fas fa-clock"></i> ${reportDate}</span>
                </div>
                <div class="report-header" style="margin-top: 5px;">
                    <span><i class="fas fa-user-slash"></i> کاربر گزارش شده: ${report.reportedName} (🆔 ${report.reportedId})</span>
                </div>
                <div class="report-reason">🔴 دلیل: ${report.reason}</div>
                <div class="report-description">📝 توضیحات: ${report.description}</div>
                <div class="report-actions">
                    <button class="report-action-btn ban" onclick="banFromReport(${index})">
                        <i class="fas fa-ban"></i> بن کاربر
                    </button>
                    <button class="report-action-btn dismiss" onclick="dismissReport(${index})">
                        <i class="fas fa-check"></i> رد کردن گزارش
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function banFromReport(index) {
    const app = window.app;
    if (!app) return;
    
    const report = app.reports[index];
    if (!report) {
        showNotification('❌ گزارش یافت نشد');
        return;
    }

    let reportedUser = null;
    if (app.currentLobby && app.currentLobby.players) {
        reportedUser = app.currentLobby.players.find(p => p.id === report.reportedId);
    }
    
    if (!reportedUser) {
        reportedUser = {
            id: report.reportedId,
            name: report.reportedName,
            avatar: 'avatar1'
        };
    }

    app.selectedPlayerId = report.reportedId;
    app.selectedPlayerData = reportedUser;

    document.getElementById('gameCreatorPanel').classList.remove('visible');
    
    // باز کردن پنل بن
    const modal = document.getElementById('banModal');
    if (modal) {
        modal.style.display = 'block';
        
        // تنظیم گزینه‌های بن
        const durationSelect = document.getElementById('banDuration');
        if (durationSelect) {
            durationSelect.innerHTML = `
                <option value="3600">۱ ساعت</option>
                <option value="86400">۱ روز</option>
                <option value="604800">۱ هفته</option>
                <option value="2592000">۱ ماه</option>
                <option value="0">دائمی</option>
            `;
        }
        
        // تنظیم تابع confirmBan
        document.querySelector('.ban-confirm').onclick = function() {
            app.confirmBan();
        };
    }

    setTimeout(() => {
        dismissReport(index);
    }, 1000);
}

function dismissReport(index) {
    const app = window.app;
    if (!app) return;
    
    app.reports.splice(index, 1);
    app.saveReports();
    app.saveLobbiesToServer();
    updateReportsList();
    showNotification('✅ گزارش رد شد');
}

function refreshReports() {
    const app = window.app;
    if (!app) return;
    
    app.loadFromServer();
    updateReportsList();
    showNotification('🔄 گزارش‌ها بروزرسانی شدند');
}

function updateBlacklistList() {
    const app = window.app;
    if (!app) return;
    
    const container = document.getElementById('blacklistContainer');
    if (!container) return;

    let html = '<div class="banned-title">🚫 لیست سیاه دائمی:</div>';

    if (app.blacklist.length === 0) {
        html += '<div style="color: white; text-align: center; padding: 10px;">لیست سیاه دائمی خالی است</div>';
    } else {
        app.blacklist.forEach((id, index) => {
            html += `
                <div class="banned-user-item">
                    <span>کاربر ${id}</span>
                    <button class="unban-small-btn" onclick="unbanUserFromList(${id})">
                        <i class="fas fa-check"></i> رفع بن
                    </button>
                </div>
            `;
        });
    }

    html += '<div class="banned-title" style="margin-top: 15px;">⏳ لیست سیاه موقت:</div>';

    if (app.tempBannedUsers.length === 0) {
        html += '<div style="color: white; text-align: center; padding: 10px;">لیست سیاه موقت خالی است</div>';
    } else {
        app.tempBannedUsers.forEach((ban, index) => {
            const expiryDate = new Date(ban.expiry).toLocaleString('fa-IR');
            html += `
                <div class="banned-user-item">
                    <div style="flex: 1;">
                        <div><i class="fas fa-user"></i> ${ban.userName || 'کاربر ' + ban.userId}</div>
                        <div style="font-size: 10px; color: #ff9999;"><i class="fas fa-comment"></i> ${ban.reason}</div>
                        <div style="font-size: 10px; color: #ffaa00;"><i class="fas fa-clock"></i> تا ${expiryDate}</div>
                        <div style="font-size: 10px; color: #3b9eff;"><i class="fas fa-gavel"></i> توسط: ${ban.bannedByName || 'مدیریت'} (🆔 ${ban.bannedBy || '?'})</div>
                    </div>
                    <button class="unban-small-btn" onclick="unbanTempUserFromList(${ban.userId})">
                        <i class="fas fa-check"></i> رفع بن
                    </button>
                </div>
            `;
        });
    }

    html += '<div class="banned-title" style="margin-top: 15px;">🟫 لیست بن ادمین (تیک قهوه‌ای):</div>';

    if (app.adminBannedUsers.length === 0) {
        html += '<div style="color: white; text-align: center; padding: 10px;">لیست بن ادمین خالی است</div>';
    } else {
        app.adminBannedUsers.forEach((ban, index) => {
            const expiryDate = new Date(ban.expiry).toLocaleString('fa-IR');
            const durationText = ban.duration === 600 ? '۱۰ دقیقه' : 
                               ban.duration === 3600 ? '۱ ساعت' :
                               ban.duration === 86400 ? '۱ روز' :
                               ban.duration === 259200 ? '۳ روز' : '۷ روز';
            html += `
                <div class="banned-user-item">
                    <div style="flex: 1;">
                        <div><i class="fas fa-user"></i> ${ban.userName || 'کاربر ' + ban.userId}</div>
                        <div style="font-size: 10px; color: #ff9999;"><i class="fas fa-comment"></i> ${ban.reason}</div>
                        <div style="font-size: 10px; color: #8B4513;"><i class="fas fa-clock"></i> مدت: ${durationText}</div>
                        <div style="font-size: 10px; color: #ffaa00;"><i class="fas fa-clock"></i> تا ${expiryDate}</div>
                        <div style="font-size: 10px; color: #8B4513;"><i class="fas fa-gavel"></i> توسط ادمین: ${ban.bannedByName} (🆔 ${ban.bannedBy})</div>
                    </div>
                    <button class="unban-small-btn" onclick="unbanAdminUserFromList(${ban.userId})">
                        <i class="fas fa-check"></i> رفع بن
                    </button>
                </div>
            `;
        });
    }

    container.innerHTML = html;
}

async function unbanUserFromList(userId) {
    const app = window.app;
    if (!app || (!app.isGameCreator && app.userRole !== 'support')) return;
    
    const userName = app.findUserNameById ? app.findUserNameById(userId) : `کاربر ${userId}`;
    
    app.blacklist = app.blacklist.filter(id => id !== userId);
    await app.saveLobbiesToServer();
    updateBlacklistList();
    showNotification(`✅ بن دائمی کاربر ${userName} لغو شد`);
}

async function unbanTempUserFromList(userId) {
    const app = window.app;
    if (!app || (!app.isGameCreator && app.userRole !== 'support')) return;
    
    const userName = app.findUserNameById ? app.findUserNameById(userId) : `کاربر ${userId}`;
    
    app.tempBannedUsers = app.tempBannedUsers.filter(b => b.userId !== userId);
    await app.saveLobbiesToServer();
    updateBlacklistList();
    showNotification(`✅ بن موقت کاربر ${userName} لغو شد`);
}

// ===== اتصال به app =====
// این توابع به شیء app اضافه می‌شن
window.panelFunctions = {
    openAdminPanel,
    openObserverPanel,
    openGameCreatorAdminPanel,
    openGameCreatorPanel,
    switchCreatorTab,
    updateReportsList,
    banFromReport,
    dismissReport,
    refreshReports,
    updateBlacklistList,
    unbanUserFromList,
    unbanTempUserFromList,
    unbanAdminUserFromList,
    unbanAdminPlayerFromCreator,
    viewAdminBanList
};